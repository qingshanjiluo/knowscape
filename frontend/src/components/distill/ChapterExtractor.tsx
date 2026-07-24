import { useState, useEffect } from 'react';
import { FileText, Trash2, Archive, Edit3, Check, X, ChevronDown, ChevronRight, GripVertical, Loader2, RefreshCw, ArrowRight } from 'lucide-react';

interface Chapter {
  id: string;
  idx: number;
  title: string;
  content: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  isHidden?: boolean;
  isArchived?: boolean;
}

interface Props {
  bookId: string;
  chapters: Chapter[];
  onChaptersUpdate: (chapters: Chapter[]) => void;
  onNext: () => void;
}

export default function ChapterExtractor({ bookId, chapters: initialChapters, onChaptersUpdate, onNext }: Props) {
  const [chapters, setChapters] = useState<Chapter[]>(initialChapters);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setChapters(initialChapters);
  }, [initialChapters]);

  function handleStartEdit(idx: number) {
    setEditingIdx(idx);
    setEditTitle(chapters[idx].title);
  }

  function handleSaveEdit(idx: number) {
    const updated = [...chapters];
    updated[idx] = { ...updated[idx], title: editTitle };
    setChapters(updated);
    setEditingIdx(null);
    onChaptersUpdate(updated);
    fetch('/api/v1/update-chapter-title', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId, chapter_idx: idx, title: editTitle }),
    }).catch(() => {});
  }

  function handleCancelEdit() {
    setEditingIdx(null);
    setEditTitle('');
  }

  function handleDelete(idx: number) {
    const updated = chapters.filter((_, i) => i !== idx).map((ch, i) => ({ ...ch, idx: i }));
    setChapters(updated);
    onChaptersUpdate(updated);
    fetch('/api/v1/delete-chapter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId, chapter_idx: idx }),
    }).catch(() => {});
  }

  function handleArchive(idx: number) {
    const updated = [...chapters];
    updated[idx] = { ...updated[idx], isArchived: true };
    setChapters(updated);
    onChaptersUpdate(updated);
  }

  function handleRestore(idx: number) {
    const updated = [...chapters];
    updated[idx] = { ...updated[idx], isArchived: false };
    setChapters(updated);
    onChaptersUpdate(updated);
  }

  function handleMoveUp(idx: number) {
    if (idx === 0) return;
    const updated = [...chapters];
    [updated[idx - 1], updated[idx]] = [updated[idx], updated[idx - 1]];
    const reindexed = updated.map((ch, i) => ({ ...ch, idx: i }));
    setChapters(reindexed);
    onChaptersUpdate(reindexed);
  }

  function handleMoveDown(idx: number) {
    if (idx >= chapters.length - 1) return;
    const updated = [...chapters];
    [updated[idx], updated[idx + 1]] = [updated[idx + 1], updated[idx]];
    const reindexed = updated.map((ch, i) => ({ ...ch, idx: i }));
    setChapters(reindexed);
    onChaptersUpdate(reindexed);
  }

  function handleAutoClean() {
    setLoading(true);
    fetch('/api/v1/auto-clean-chapters', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: bookId }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.chapters) {
          setChapters(data.chapters);
          onChaptersUpdate(data.chapters);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  const visibleChapters = chapters.filter(ch => !ch.isArchived);
  const archivedChapters = chapters.filter(ch => ch.isArchived);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText size={16} style={{ color: 'var(--color-ks-primary)' }} />
          <h3 className="text-sm font-semibold font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text)' }}>
            章节提取与编辑
          </h3>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)' }}>
            {visibleChapters.length} 章节
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleAutoClean}
            disabled={loading}
            className="flex items-center gap-1 px-2 py-1 rounded text-[11px] cursor-pointer disabled:opacity-50"
            style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
          >
            {loading ? <Loader2 size={10} className="animate-spin" /> : <RefreshCw size={10} />}
            自动清理
          </button>
          <button
            onClick={onNext}
            className="flex items-center gap-1 px-3 py-1.5 rounded text-xs font-medium cursor-pointer"
            style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}
          >
            下一步: 制作图谱
            <ArrowRight size={12} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        {visibleChapters.map((ch, i) => (
          <div
            key={`${ch.id}-${ch.idx}-${i}`}
            className="flex items-center gap-2 px-3 py-2 rounded-lg transition-colors"
            style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}
          >
            <div className="cursor-grab" style={{ color: 'var(--color-ks-text-disabled)' }}>
              <GripVertical size={12} />
            </div>

            <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--color-ks-text-disabled)', minWidth: 20 }}>
              {ch.idx + 1}.
            </span>

            {editingIdx === ch.idx ? (
              <div className="flex-1 flex items-center gap-2">
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSaveEdit(ch.idx); if (e.key === 'Escape') handleCancelEdit(); }}
                  className="flex-1 text-xs px-2 py-1 rounded outline-none"
                  style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-primary)' }}
                  autoFocus
                />
                <button onClick={() => handleSaveEdit(ch.idx)} className="p-1 rounded cursor-pointer" style={{ color: 'var(--color-ks-success)' }}>
                  <Check size={12} />
                </button>
                <button onClick={handleCancelEdit} className="p-1 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}>
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="text-xs font-medium truncate"
                    style={{ color: 'var(--color-ks-text)' }}
                  >
                    {ch.title}
                  </span>
                  {ch.isArchived && (
                    <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-ks-warning)', color: 'white' }}>
                      已归档
                    </span>
                  )}
                </div>
                {expandedIdx === ch.idx && (
                  <div className="text-[10px] mt-1 line-clamp-3" style={{ color: 'var(--color-ks-text-muted)' }}>
                    {ch.content?.substring(0, 200)}...
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={() => setExpandedIdx(expandedIdx === ch.idx ? null : ch.idx)}
                className="p-1 rounded cursor-pointer"
                style={{ color: 'var(--color-ks-text-muted)' }}
                title="展开预览"
              >
                {expandedIdx === ch.idx ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
              </button>
              <button
                onClick={() => handleStartEdit(ch.idx)}
                className="p-1 rounded cursor-pointer"
                style={{ color: 'var(--color-ks-text-muted)' }}
                title="编辑标题"
              >
                <Edit3 size={10} />
              </button>
              <button
                onClick={() => handleMoveUp(ch.idx)}
                disabled={ch.idx === 0}
                className="p-1 rounded cursor-pointer disabled:opacity-30"
                style={{ color: 'var(--color-ks-text-muted)' }}
                title="上移"
              >
                ↑
              </button>
              <button
                onClick={() => handleMoveDown(ch.idx)}
                disabled={ch.idx >= visibleChapters.length - 1}
                className="p-1 rounded cursor-pointer disabled:opacity-30"
                style={{ color: 'var(--color-ks-text-muted)' }}
                title="下移"
              >
                ↓
              </button>
              <button
                onClick={() => handleArchive(ch.idx)}
                className="p-1 rounded cursor-pointer"
                style={{ color: 'var(--color-ks-warning)' }}
                title="归档"
              >
                <Archive size={10} />
              </button>
              <button
                onClick={() => handleDelete(ch.idx)}
                className="p-1 rounded cursor-pointer"
                style={{ color: 'var(--color-ks-error)' }}
                title="删除"
              >
                <Trash2 size={10} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {archivedChapters.length > 0 && (
        <div className="mt-2">
          <div className="flex items-center gap-2 mb-2">
            <Archive size={12} style={{ color: 'var(--color-ks-text-muted)' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-ks-text-muted)' }}>
              已归档章节 ({archivedChapters.length})
            </span>
          </div>
          <div className="flex flex-col gap-1">
            {archivedChapters.map((ch) => (
              <div
                key={ch.id}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ backgroundColor: 'var(--color-ks-hover)', border: '1px solid var(--color-ks-border)', opacity: 0.7 }}
              >
                <span className="text-[10px] tabular-nums" style={{ color: 'var(--color-ks-text-disabled)' }}>
                  {ch.idx + 1}.
                </span>
                <span className="text-xs flex-1 truncate" style={{ color: 'var(--color-ks-text-muted)' }}>
                  {ch.title}
                </span>
                <button
                  onClick={() => handleRestore(ch.idx)}
                  className="text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                  style={{ color: 'var(--color-ks-primary)' }}
                >
                  恢复
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
