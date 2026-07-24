import { useState, useEffect } from 'react';
import { Folder, FileText, ChevronRight, ChevronDown, Sparkles, ArrowLeft, Send, Loader2, FileUp, Network, File, Maximize2 } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import { useNavigate } from 'react-router-dom';
import KnowledgeMapPanel from '@/components/mindmap/KnowledgeMapPanel';

interface FolderChild {
  id: string;
  name: string;
  idx?: number;
  size?: number;
  hasDistilled?: boolean;
  preview?: string;
  type?: string;
}

interface Document {
  id: string;
  title: string;
  content: string;
  created_at: string;
  custom_prompt?: string;
}

export default function BookFolderView() {
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const [children, setChildren] = useState<FolderChild[]>([]);
  const [bookName, setBookName] = useState('');
  const [expanded, setExpanded] = useState(true);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const [suggestions, setSuggestions] = useState<{ id: string; idx: number; title: string }[]>([]);
  const [showMap, setShowMap] = useState(false);
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<Document | null>(null);
  const [expandedDocs, setExpandedDocs] = useState(true);
  const loadChapter = useBookStore((s) => s.loadChapter);
  const setReaderPanel = useUIStore((s) => s.setReaderPanel);
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedBookId) return;
    fetch('/api/v1/book-folder?book_id=' + selectedBookId)
      .then(function(r) { return r.json(); })
      .then(function(data) {
        setBookName(data.name || '');
        setChildren(data.children || []);
      })
      .catch(function() {});

    fetch('/api/v1/book-documents?book_id=' + selectedBookId)
      .then(function(r) { return r.json(); })
      .then(function(data) { setDocuments(data.documents || []); })
      .catch(function() {});
  }, [selectedBookId]);

  function handleChapterClick(ch: FolderChild) {
    setSelectedChapter(ch.id);
    if (selectedBookId && ch.idx !== undefined) {
      loadChapter(selectedBookId, ch.idx);
      setReaderPanel('original');
      useUIStore.getState().setViewMode('reader');
      navigate('/workspace/reader');
    }
  }

  function handleDocClick(doc: Document) {
    setSelectedDoc(doc);
    setGeneratedContent(doc.content);
    setSuggestions([]);
  }

  function handleGenerate() {
    if (!prompt.trim() || !selectedBookId) return;
    setGenerating(true);
    setGeneratedContent('');
    setSuggestions([]);
    fetch('/api/v1/folder-auto-add', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: selectedBookId, prompt: prompt }),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.success && data.answer) {
          setGeneratedContent(data.answer);
        } else if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
          setGeneratedContent(data.message || 'AI 已分析完成，请查看下方建议');
        } else {
          setGeneratedContent(data.message || '生成完成');
        }
      })
      .catch(function() {
        setGeneratedContent('生成失败，请重试');
      })
      .finally(function() {
        setGenerating(false);
      });
  }

  if (mapFullscreen) {
    return (
      <div className="fixed inset-0 z-50" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
        {selectedBookId && (
          <KnowledgeMapPanel
            bookId={selectedBookId}
            isFullscreen={true}
            onToggleFullscreen={() => setMapFullscreen(false)}
            onClose={() => { setMapFullscreen(false); setShowMap(false); }}
          />
        )}
      </div>
    );
  }

  if (!selectedBookId) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-ks-text-muted)' }}>
        <p className="text-sm">请选择一本书籍</p>
      </div>
    );
  }

  return (
    <div className="h-full flex" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-ks-border)' }}>
          <button onClick={function() { navigate('/workspace'); }} className="p-1 rounded hover:opacity-80 cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}>
            <ArrowLeft size={16} />
          </button>
          <Folder size={16} style={{ color: 'var(--color-ks-warning)' }} />
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
            {bookName || '文件夹'}
          </h2>
          <span className="text-[10px] ml-auto" style={{ color: 'var(--color-ks-text-muted)' }}>
            {children.length} 个章节 · {documents.length} 个文档
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {children.length > 0 && (
            <>
              <button
                onClick={function() { setExpanded(!expanded); }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded w-full text-left cursor-pointer"
                style={{ color: 'var(--color-ks-text-secondary)' }}
              >
                {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <Folder size={14} style={{ color: 'var(--color-ks-warning)' }} />
                <span className="text-xs font-medium">{bookName}</span>
                <span className="text-[10px] ml-auto" style={{ color: 'var(--color-ks-text-disabled)' }}>{children.length}</span>
              </button>
              {expanded && (
                <div className="ml-4">
                  {children.map(function(ch) {
                    return (
                      <button
                        key={ch.id}
                        onClick={function() { handleChapterClick(ch); }}
                        className="flex items-start gap-2 px-2 py-1.5 rounded w-full text-left cursor-pointer transition-colors"
                        style={{
                          backgroundColor: selectedChapter === ch.id ? 'var(--color-ks-hover)' : 'transparent',
                          color: 'var(--color-ks-text-secondary)',
                        }}
                      >
                        <FileText size={12} className="mt-0.5 shrink-0" style={{ color: ch.hasDistilled ? 'var(--color-ks-success)' : 'var(--color-ks-text-disabled)' }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate" style={{ color: 'var(--color-ks-text)' }}>{ch.name}</div>
                          {ch.preview && (
                            <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>{ch.preview}</div>
                          )}
                        </div>
                        {ch.hasDistilled && (
                          <Sparkles size={10} className="mt-0.5 shrink-0" style={{ color: 'var(--color-ks-warning)' }} />
                        )}
                        <ChevronRight size={10} style={{ color: 'var(--color-ks-text-disabled)', marginLeft: 'auto' }} />
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {documents.length > 0 && (
            <div className="mt-3">
              <button
                onClick={function() { setExpandedDocs(!expandedDocs); }}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded w-full text-left cursor-pointer"
                style={{ color: 'var(--color-ks-text-secondary)' }}
              >
                {expandedDocs ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                <File size={14} style={{ color: 'var(--color-ks-primary)' }} />
                <span className="text-xs font-medium">全书文档</span>
                <span className="text-[10px] ml-auto" style={{ color: 'var(--color-ks-text-disabled)' }}>{documents.length}</span>
              </button>
              {expandedDocs && (
                <div className="ml-4">
                  {documents.map(function(doc) {
                    return (
                      <button
                        key={doc.id}
                        onClick={function() { handleDocClick(doc); }}
                        className="flex items-start gap-2 px-2 py-1.5 rounded w-full text-left cursor-pointer transition-colors"
                        style={{
                          backgroundColor: selectedDoc?.id === doc.id ? 'var(--color-ks-hover)' : 'transparent',
                          color: 'var(--color-ks-text-secondary)',
                        }}
                      >
                        <FileText size={12} className="mt-0.5 shrink-0" style={{ color: 'var(--color-ks-primary)' }} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs truncate" style={{ color: 'var(--color-ks-text)' }}>{doc.title}</div>
                          <div className="text-[10px] truncate mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>
                            {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : ''}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          <div className="mt-3">
            <button
              onClick={function() { setShowMap(!showMap); }}
              className="flex items-center gap-1.5 px-2 py-1.5 rounded w-full text-left cursor-pointer"
              style={{ color: 'var(--color-ks-text-secondary)' }}
            >
              {showMap ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <Network size={14} style={{ color: 'var(--color-ks-success)' }} />
              <span className="text-xs font-medium">知识图谱</span>
              <button
                onClick={function(e) { e.stopPropagation(); setMapFullscreen(true); }}
                className="ml-auto p-1 rounded cursor-pointer hover:opacity-80"
                style={{ color: 'var(--color-ks-text-muted)' }}
              >
                <Maximize2 size={10} />
              </button>
            </button>
            {showMap && (
              <div className="ml-4 h-64 rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-ks-border)' }}>
                <KnowledgeMapPanel
                  bookId={selectedBookId}
                  isFullscreen={false}
                  onToggleFullscreen={() => setMapFullscreen(true)}
                />
              </div>
            )}
          </div>

          {children.length === 0 && documents.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4" style={{ color: 'var(--color-ks-text-muted)' }}>
              <FileUp size={40} style={{ color: 'var(--color-ks-text-disabled)' }} />
              <p className="text-sm font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>暂无数据</p>
              <p className="text-xs text-center max-w-xs">请先在工作台上传书籍并完成蒸馏</p>
            </div>
          )}
        </div>

        <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--color-ks-border)' }}>
          <div className="text-[10px] mb-1.5" style={{ color: 'var(--color-ks-text-muted)' }}>输入提示词生成内容</div>
          <div className="flex gap-1.5">
            <input
              type="text"
              value={prompt}
              onChange={function(e) { setPrompt(e.target.value); }}
              onKeyDown={function(e) { if (e.key === 'Enter' && !generating) handleGenerate(); }}
              placeholder="例如：帮我整理本书的章节结构..."
              className="flex-1 text-xs px-2 py-1.5 rounded outline-none"
              style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
              disabled={generating}
            />
            <button
              onClick={handleGenerate}
              disabled={!prompt.trim() || generating}
              className="px-2 py-1.5 rounded text-white text-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-ks-primary)' }}
            >
              {generating ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
            </button>
          </div>
          {generatedContent && (
            <div className="mt-2 p-2 rounded text-xs leading-relaxed max-h-48 overflow-y-auto" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)', whiteSpace: 'pre-wrap' }}>
              {generatedContent}
            </div>
          )}
          {suggestions.length > 0 && (
            <div className="mt-2 space-y-1">
              <div className="text-[10px] font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>推荐章节：</div>
              {suggestions.map(function(s) {
                return (
                  <button
                    key={s.id}
                    onClick={function() {
                      if (selectedBookId) {
                        loadChapter(selectedBookId, s.idx);
                        setReaderPanel('original');
                        useUIStore.getState().setViewMode('reader');
                        navigate('/workspace/reader');
                      }
                    }}
                    className="flex items-center gap-1.5 w-full text-left px-2 py-1 rounded text-xs cursor-pointer"
                    style={{ color: 'var(--color-ks-text-secondary)' }}
                    onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)'; }}
                    onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = 'transparent'; }}
                  >
                    <FileText size={10} style={{ color: 'var(--color-ks-primary)' }} />
                    <span>{s.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
