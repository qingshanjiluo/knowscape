"""
知境 · 知识存储模块 CLI

Usage:
    python -m cloud.knowledge.main <command> [options]

Commands:
    init                    Initialize the storage database
    add <doc.json>          Add/import a document
    list                    List all documents
    search <query>          Search across knowledge base
    index <doc_id>          Rebuild FTS + vector index for a document
    stats                   Show storage statistics
    export <output>         Export to JSON/ZIP
    import <input>          Import from JSON/ZIP

Examples:
    python -m cloud.knowledge.main init
    python -m cloud.knowledge.main search "认知升级"
    python -m cloud.knowledge.main search "方法论" --mode vector
    python -m cloud.knowledge.main stats
    python -m cloud.knowledge.main export ./export.json
"""

import asyncio
import json
import sys
import argparse
import logging
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from cloud.knowledge.config import KnowledgeConfig
from cloud.knowledge.storage.sqlite_store import SQLiteStore
from cloud.knowledge.storage.pg_store import PGStore
from cloud.knowledge.search.engine import SearchEngine
from cloud.knowledge.indexer.vector_indexer import VectorIndexer, EmbeddingProvider
from cloud.knowledge.indexer.text_indexer import TextIndexer
from cloud.knowledge.export.package import KnowledgePackageIO


def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.INFO
    logging.basicConfig(
        level=level,
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
    )


def get_store(config: KnowledgeConfig):
    if config.backend.value == "postgresql":
        store = PGStore(config.pg_dsn, config.index.vector_dimension)
    else:
        store = SQLiteStore(config.db_path, config.index.vector_dimension)
    return store


async def cmd_init(args):
    config = KnowledgeConfig()
    store = get_store(config)
    await store.initialize()
    stats = await store.get_stats()
    print(f"Knowledge store initialized: {stats.backend.value}")
    print(f"  DB: {config.db_path}")
    print(f"  Vector dim: {config.index.vector_dimension}")
    print(f"  FTS: {'enabled' if config.index.enable_fts else 'disabled'}")
    print(f"  Vector: {'enabled' if config.index.enable_vector else 'disabled'}")
    await store.close()


async def cmd_add(args):
    config = KnowledgeConfig()
    store = get_store(config)
    await store.initialize()

    with open(args.file, "r", encoding="utf-8") as f:
        data = json.load(f)

    from cloud.knowledge.models import KnowledgeDocument
    doc = KnowledgeDocument(**data)
    await store.upsert_document(doc)
    print(f"Document added: {doc.title} ({doc.doc_id})")

    # Auto-index
    if args.index:
        provider = EmbeddingProvider(config.embedding_model)
        vi = VectorIndexer(store, config.index, provider)
        ti = TextIndexer(store, config.index)
        await ti.index_document(doc)
        await vi.index_document(doc)
        print("  Indexed for FTS and vector search")

    await store.close()


async def cmd_list(args):
    config = KnowledgeConfig()
    store = get_store(config)
    await store.initialize()

    docs = await store.list_documents(limit=100)
    print(f"{'ID':<40} {'Title':<30} {'Status':<12} {'Chapters':<8}")
    print("-" * 90)
    for d in docs:
        print(f"{d.doc_id:<40} {d.title:<30} "
              f"{d.indexing_status.value:<12} {d.total_chapters:<8}")

    print(f"\nTotal: {len(docs)} documents")
    await store.close()


async def cmd_search(args):
    config = KnowledgeConfig()
    store = get_store(config)
    await store.initialize()

    engine = SearchEngine(store, config.index)
    result = await engine.search(
        query=args.query,
        mode=args.mode,
        limit=args.limit,
    )

    print(f"Search: '{args.query}' | mode={args.mode} | {result['total']} hits\n")
    for i, r in enumerate(result["results"], 1):
        print(f"  [{i}] score={r.score:.3f} | {r.source}")
        print(f"      doc: {r.doc_title}")
        print(f"      type: {r.content_type}")
        if r.chapter_title:
            print(f"      chapter: {r.chapter_title}")
        if r.category:
            print(f"      category: {r.category}")
        print(f"      {r.content[:120]}...")
        print()

    await store.close()


async def cmd_index(args):
    config = KnowledgeConfig()
    store = get_store(config)
    await store.initialize()

    doc = await store.get_document(args.doc_id)
    if not doc:
        print(f"Document not found: {args.doc_id}")
        await store.close()
        return

    provider = EmbeddingProvider(config.embedding_model)
    vi = VectorIndexer(store, config.index, provider)
    ti = TextIndexer(store, config.index)

    await ti.index_document(doc)
    ft_count = await vi.index_document(doc)

    chapters = await store.get_chapters_by_doc(doc.doc_id)
    ch_count = await vi.index_chapters(chapters)

    entries = await store.get_distill_entries_by_doc(doc.doc_id)
    de_count = await vi.index_distill_entries(entries)

    await store.update_indexing_status(doc.doc_id, "completed")

    print(f"Indexed: {doc.title}")
    print(f"  Full-text chunks: 1")
    print(f"  Chapter vectors: {ch_count}")
    print(f"  Distill vectors: {de_count}")

    await store.close()


async def cmd_stats(args):
    config = KnowledgeConfig()
    store = get_store(config)
    await store.initialize()

    stats = await store.get_stats()
    print(f"Backend: {stats.backend.value}")
    print(f"Documents: {stats.total_documents}")
    print(f"Chapters: {stats.total_chapters}")
    print(f"Distill entries: {stats.total_distill_entries}")
    print(f"Embeddings: {stats.total_embeddings}")
    print(f"Indexed: {stats.indexed_documents}")
    if stats.db_size_bytes:
        size_mb = stats.db_size_bytes / 1024 / 1024
        print(f"DB size: {size_mb:.2f} MB")
    if stats.details:
        for k, v in stats.details.items():
            print(f"  {k}: {v}")

    await store.close()


async def cmd_export(args):
    config = KnowledgeConfig()
    store = get_store(config)
    await store.initialize()

    io = KnowledgePackageIO(store)
    out = args.output

    if out.endswith(".zip"):
        path = await io.export_to_zip(out)
    else:
        path = await io.export_to_json(out)

    print(f"Exported to: {path}")
    await store.close()


async def cmd_import(args):
    config = KnowledgeConfig()
    store = get_store(config)
    await store.initialize()

    io = KnowledgePackageIO(store)
    inp = args.input

    if inp.endswith(".zip"):
        count = await io.import_from_zip(inp)
    else:
        count = await io.import_from_json(inp)

    print(f"Imported {count} documents from {inp}")
    await store.close()


def main():
    parser = argparse.ArgumentParser(
        description="知境 · 知识存储模块",
    )
    parser.add_argument("-v", "--verbose", action="store_true",
                        help="Verbose logging")

    sub = parser.add_subparsers(dest="command")

    p_init = sub.add_parser("init", help="Initialize storage")

    p_add = sub.add_parser("add", help="Add a document")
    p_add.add_argument("file", help="JSON file with document data")
    p_add.add_argument("--index", action="store_true",
                       help="Auto-index after adding")

    p_list = sub.add_parser("list", help="List documents")

    p_search = sub.add_parser("search", help="Search knowledge base")
    p_search.add_argument("query", help="Search query")
    p_search.add_argument("--mode", choices=["fulltext", "vector", "hybrid"],
                          default="hybrid", help="Search mode")
    p_search.add_argument("--limit", type=int, default=10,
                          help="Max results")

    p_index = sub.add_parser("index", help="Index a document")
    p_index.add_argument("doc_id", help="Document ID to index")

    p_stats = sub.add_parser("stats", help="Storage statistics")

    p_export = sub.add_parser("export", help="Export knowledge base")
    p_export.add_argument("output", help="Output path (.json or .zip)")

    p_import = sub.add_parser("import", help="Import knowledge base")
    p_import.add_argument("input", help="Input path (.json or .zip)")

    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        return

    setup_logging(args.verbose)

    commands = {
        "init": cmd_init,
        "add": cmd_add,
        "list": cmd_list,
        "search": cmd_search,
        "index": cmd_index,
        "stats": cmd_stats,
        "export": cmd_export,
        "import": cmd_import,
    }

    asyncio.run(commands[args.command](args))


if __name__ == "__main__":
    main()
