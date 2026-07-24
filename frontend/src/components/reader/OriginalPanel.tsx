import { useState, useCallback, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { MessageSquare, Highlighter, X } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import { useReadingStore } from '@/stores/readingStore';

interface AnnotationData {
  id: string;
  content: string;
  type: string;
  color: string;
  start_offset: number;
  end_offset: number;
  chapter_idx: number;
}

export default function OriginalPanel() {
  const currentChapter = useBookStore((s) => s.currentChapter);
  const highlightCitation = useUIStore((s) => s.highlightCitation);
  const bgColor = useReadingStore((s) => s.bgColor);
  const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
  const [showToolbar, setShowToolbar] = useState(false);
  const [toolbarPos, setToolbarPos] = useState({ x: 0, y: 0 });
  const [selectedText, setSelectedText] = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!currentChapter) return;
    fetch(`/api/v1/get-annotations?book_id=${useBookStore.getState().selectedBookId}&chapter_idx=${currentChapter.chapterIndex}`)
      .then(r => r.json())
      .then(data => setAnnotations(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, [currentChapter?.chapterIndex]);

  useEffect(() => {
    if (!highlightCitation || !panelRef.current) return;
    const text = panelRef.current.textContent || '';
    const idx = text.indexOf(highlightCitation.substring(0, 20));
    if (idx >= 0) {
      const walker = document.createTreeWalker(panelRef.current, NodeFilter.SHOW_TEXT);
      let charCount = 0;
      while (walker.nextNode()) {
        const node = walker.currentNode;
        charCount += (node.textContent || '').length;
        if (charCount >= idx) {
          const range = document.createRange();
          range.setStart(node, Math.max(0, idx - (charCount - (node.textContent || '').length)));
          range.setEnd(node, Math.min((node.textContent || '').length, idx + highlightCitation.substring(0, 20).length - (charCount - (node.textContent || '').length)));
          const rect = range.getBoundingClientRect();
          const panelRect = panelRef.current.getBoundingClientRect();
          if (rect.top < panelRect.top || rect.bottom > panelRect.bottom) {
            panelRef.current.scrollTop += rect.top - panelRect.top - 100;
          }
          break;
        }
      }
    }
    useUIStore.getState().setHighlightCitation(null);
  }, [highlightCitation]);

  const handleMouseUp = useCallback(() => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();
    if (!text || text.length < 2) { setShowToolbar(false); return; }

    const range = sel?.getRangeAt(0);
    if (!range || !panelRef.current?.contains(range.commonAncestorContainer)) {
      setShowToolbar(false);
      return;
    }

    const rect = range.getBoundingClientRect();
    const panelRect = panelRef.current.getBoundingClientRect();
    setToolbarPos({ x: rect.left - panelRect.left + rect.width / 2, y: rect.top - panelRect.top - 40 });
    setSelectedText(text);
    setShowToolbar(true);
    setShowNoteInput(false);
    setNoteInput('');
  }, []);

  const saveAnnotation = useCallback(async (type: string, color: string, note?: string) => {
    if (!currentChapter) return;
    const bookId = useBookStore.getState().selectedBookId;
    if (!bookId) return;
    const content = note || selectedText;
    try {
      const resp = await fetch('/api/v1/add-annotation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          book_id: bookId, chapter_idx: currentChapter.chapterIndex,
          content, type, color, start_offset: 0, end_offset: 0,
        }),
      });
      const data = await resp.json();
      setAnnotations(prev => [...prev, { id: data.id, content, type, color, start_offset: 0, end_offset: 0, chapter_idx: currentChapter.chapterIndex }]);
    } catch {}
    setShowToolbar(false);
    setShowNoteInput(false);
    setNoteInput('');
    setSelectedText('');
  }, [currentChapter, selectedText]);

  const deleteAnnotation = useCallback(async (id: string) => {
    try { await fetch(`/api/v1/delete-annotation?id=${id}`, { method: 'DELETE' }); } catch {}
    setAnnotations(prev => prev.filter(a => a.id !== id));
  }, []);

  if (!currentChapter) {
    return (
      <div className="flex-1 flex items-center justify-center h-full px-4">
        <div className="text-center" style={{ color: 'var(--color-ks-text-muted)' }}>
          <p className="text-sm font-[var(--font-family-ks-heading)]">未选择章节</p>
          <p className="text-xs mt-1">请从目录选择章节查看原文</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={panelRef} className="relative flex-1 overflow-y-auto px-4 py-4" style={{ userSelect: 'text', backgroundColor: bgColor }}>
      <div className="mb-4">
        <h3
          className="text-lg font-bold leading-tight"
          style={{ color: 'var(--ks-reader-text, var(--color-ks-text))', fontFamily: 'var(--font-family-ks-heading)' }}
        >
          {currentChapter.title}
        </h3>
      </div>

      {annotations.length > 0 && (
        <div className="mb-3 p-2 rounded-md" style={{ backgroundColor: 'var(--color-ks-hover)', border: '1px solid var(--color-ks-border)' }}>
          <div className="flex items-center gap-1 mb-1">
            <Highlighter size={11} style={{ color: 'var(--color-ks-warning)' }} />
            <span className="text-[10px] font-medium" style={{ color: 'var(--color-ks-text-muted)', fontFamily: 'var(--font-family-ks-heading)' }}>
              {annotations.length} 条批注
            </span>
          </div>
          <div className="flex flex-wrap gap-1">
            {annotations.map(a => (
              <span
                key={a.id}
                className="group inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded cursor-pointer"
                style={{ backgroundColor: a.color + '30', color: 'var(--color-ks-text-secondary)' }}
                title={a.content}
              >
                {a.type === 'highlight' ? a.content.substring(0, 20) : `📝 ${a.content.substring(0, 15)}`}
                <X size={8} className="opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => deleteAnnotation(a.id)} />
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="prose prose-sm max-w-none" style={{ color: 'var(--ks-reader-text, var(--color-ks-text))' }} onMouseUp={handleMouseUp}>
        <div style={{ fontSize: 'var(--ks-reader-font-size, 16px)', fontFamily: 'var(--ks-reader-font-family)', lineHeight: 'var(--ks-reader-line-height, 1.8)', maxWidth: 'var(--ks-reader-content-width, 720px)', margin: '0 auto' }}>
          <ReactMarkdown>{String(currentChapter.originalText || '')}</ReactMarkdown>
        </div>
      </div>

      {showToolbar && (
        <div
          className="absolute z-20 flex items-center gap-1 px-2 py-1 rounded-lg shadow-lg"
          style={{
            left: toolbarPos.x, top: toolbarPos.y,
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--color-ks-card)',
            border: '1px solid var(--color-ks-border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}
        >
          <button
            onClick={() => saveAnnotation('highlight', '#FFEB3B')}
            className="p-1 rounded hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-ks-warning)' }}
            title="高亮"
          >
            <Highlighter size={14} />
          </button>
          <button
            onClick={() => { setShowNoteInput(true); }}
            className="p-1 rounded hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-ks-primary)' }}
            title="添加批注"
          >
            <MessageSquare size={14} />
          </button>
          <button
            onClick={() => { setShowToolbar(false); setSelectedText(''); }}
            className="p-1 rounded hover:opacity-80 transition-opacity"
            style={{ color: 'var(--color-ks-text-muted)' }}
          >
            <X size={12} />
          </button>
        </div>
      )}

      {showNoteInput && (
        <div
          className="absolute z-20 p-2 rounded-lg shadow-lg"
          style={{
            left: toolbarPos.x, top: toolbarPos.y + 36,
            transform: 'translateX(-50%)',
            backgroundColor: 'var(--color-ks-card)',
            border: '1px solid var(--color-ks-border)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            minWidth: 220,
          }}
        >
          <div className="text-[10px] mb-1" style={{ color: 'var(--color-ks-text-muted)' }}>
            选中: "{selectedText.substring(0, 30)}..."
          </div>
          <input
            type="text"
            placeholder="输入批注内容..."
            value={noteInput}
            onChange={(e) => setNoteInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && noteInput.trim()) saveAnnotation('note', '#90CAF9', noteInput); }}
            className="w-full text-xs px-2 py-1 rounded outline-none"
            style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
            autoFocus
          />
          <div className="flex gap-1 mt-1">
            <button
              onClick={() => { if (noteInput.trim()) saveAnnotation('note', '#90CAF9', noteInput); }}
              className="flex-1 text-[10px] py-1 rounded"
              style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}
            >
              保存
            </button>
            <button
              onClick={() => { setShowNoteInput(false); setShowToolbar(false); }}
              className="text-[10px] px-2 py-1 rounded"
              style={{ color: 'var(--color-ks-text-muted)' }}
            >
              取消
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
