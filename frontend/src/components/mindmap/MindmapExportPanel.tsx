import { useState, useEffect } from 'react';
import { Loader2, Sparkles, Layout, FileText, Trash2 } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import MindmapEditor from './MindmapEditor';

interface SavedMindmap {
  id: string;
  title: string;
  style: string;
  created_at: string;
  updated_at: string;
}

const FORMAT_OPTIONS = [
  { key: 'json', label: 'JSON' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'html', label: 'HTML' },
  { key: 'opml', label: 'OPML' },
  { key: 'freemind', label: 'FreeMind' },
];

export default function MindmapExportPanel() {
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const [view, setView] = useState<'list' | 'editor' | 'export'>('list');
  const [mindmaps, setMindmaps] = useState<SavedMindmap[]>([]);
  const [activeMap, setActiveMap] = useState<any>(null);
  const [generating, setGenerating] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [exportStyle] = useState('tree');

  useEffect(() => {
    if (selectedBookId) loadMindmaps();
  }, [selectedBookId]);

  async function loadMindmaps() {
    try {
      const resp = await fetch(`/api/v1/mindmaps?book_id=${selectedBookId}`);
      const data = await resp.json();
      setMindmaps(data);
    } catch {}
  }

  async function handleGenerate() {
    if (!selectedBookId) return;
    setGenerating(true);
    try {
      const resp = await fetch('/api/v1/mindmaps/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId, prompt: genPrompt || undefined, style: exportStyle }),
      });
      const data = await resp.json();
      if (data.content) {
        setActiveMap({ id: data.mindmap_id, title: data.content.name || '思维导图', content: data.content, style: exportStyle });
        setView('editor');
        loadMindmaps();
      }
    } catch {}
    setGenerating(false);
  }

  async function handleOpenMap(mapId: string) {
    try {
      const resp = await fetch(`/api/v1/mindmaps/${mapId}`);
      const data = await resp.json();
      setActiveMap(data);
      setView('editor');
    } catch {}
  }

  async function handleDeleteMap(mapId: string) {
    try {
      await fetch(`/api/v1/mindmaps/${mapId}`, { method: 'DELETE' });
      setMindmaps(prev => prev.filter(m => m.id !== mapId));
      if (activeMap?.id === mapId) { setActiveMap(null); setView('list'); }
    } catch {}
  }

  async function handleExport(format: string) {
    if (!selectedBookId) return;
    const url = `/api/v1/mindmap/export?book_id=${selectedBookId}&format=${format}&style=${exportStyle}`;
    if (format === 'html') {
      window.open(url, '_blank');
    } else {
      const resp = await fetch(url);
      const blob = await resp.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const ext = format === 'freemind' ? 'mm' : format;
      a.download = `mindmap.${ext}`;
      a.click();
      URL.revokeObjectURL(blobUrl);
    }
  }

  if (view === 'editor' && activeMap) {
    return (
      <div className="h-full flex flex-col">
        <div className="px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
          <button onClick={() => { setView('list'); setActiveMap(null); }} className="text-[10px] cursor-pointer" style={{ color: 'var(--color-ks-primary)' }}>
            ← 返回列表
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <MindmapEditor
            content={activeMap.content}
            title={activeMap.title}
            mindmapId={activeMap.id}
            style={activeMap.style}
            onSave={() => loadMindmaps()}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <div className="flex items-center gap-2 mb-2">
        <Layout size={16} style={{ color: 'var(--color-ks-primary)' }} />
        <span className="text-sm font-semibold" style={{ color: 'var(--color-ks-text)' }}>思维导图</span>
      </div>

      <div className="space-y-2">
        <div className="text-[10px] font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>AI 生成</div>
        <textarea
          value={genPrompt}
          onChange={(e) => setGenPrompt(e.target.value)}
          placeholder="描述你想要的导图内容（可选）..."
          className="w-full text-[11px] px-2 py-1.5 rounded resize-none outline-none"
          style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)', minHeight: '48px' }}
          rows={2}
        />
        <button
          onClick={handleGenerate}
          disabled={!selectedBookId || generating}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs text-white cursor-pointer disabled:opacity-40"
          style={{ backgroundColor: 'var(--color-ks-primary)' }}
        >
          {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
          {generating ? '生成中...' : 'AI 生成导图'}
        </button>
      </div>

      {mindmaps.length > 0 && (
        <div className="space-y-1.5">
          <div className="text-[10px] font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>已保存 ({mindmaps.length})</div>
          {mindmaps.map(m => (
            <div
              key={m.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer group"
              style={{ backgroundColor: 'var(--color-ks-hover)', border: '1px solid var(--color-ks-border)' }}
              onClick={() => handleOpenMap(m.id)}
            >
              <FileText size={12} style={{ color: 'var(--color-ks-primary)' }} />
              <span className="flex-1 text-[11px] truncate" style={{ color: 'var(--color-ks-text)' }}>{m.title}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteMap(m.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 cursor-pointer"
                style={{ color: '#ef4444' }}
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2 pt-2" style={{ borderTop: '1px solid var(--color-ks-border)' }}>
        <div className="text-[10px] font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>快速导出</div>
        <div className="grid grid-cols-3 gap-1.5">
          {FORMAT_OPTIONS.map(f => (
            <button
              key={f.key}
              onClick={() => handleExport(f.key)}
              disabled={!selectedBookId}
              className="px-2 py-1.5 rounded text-[10px] cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
