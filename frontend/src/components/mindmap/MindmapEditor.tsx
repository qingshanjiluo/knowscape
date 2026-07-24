import { useState, useEffect, useCallback } from 'react';
import { Save, Plus, Trash2, Palette } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';

interface MindmapNode {
  name: string;
  summary?: string;
  children?: MindmapNode[];
}

interface MindmapEditorProps {
  content: MindmapNode;
  title?: string;
  mindmapId?: string;
  style?: string;
  onSave?: (id: string) => void;
  onExport?: (format: string) => void;
}

const STYLES = [
  { key: 'tree', label: '树形' },
  { key: 'mindmap', label: '思维导图' },
  { key: 'timeline', label: '时间线' },
  { key: 'classification', label: '分类' },
];

export default function MindmapEditor({ content: initialContent, title: initialTitle, mindmapId, style: initialStyle = 'tree', onSave }: MindmapEditorProps) {
  const [content, setContent] = useState<MindmapNode>(initialContent || { name: '根节点', children: [] });
  const [title, setTitle] = useState(initialTitle || '思维导图');
  const [editingNode, setEditingNode] = useState<{ path: number[]; field: 'name' | 'summary' } | null>(null);
  const [editValue, setEditValue] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(initialStyle);
  const [saving, setSaving] = useState(false);
  const [showStylePicker, setShowStylePicker] = useState(false);
  const selectedBookId = useBookStore((s) => s.selectedBookId);

  useEffect(() => {
    if (initialContent) setContent(initialContent);
    if (initialTitle) setTitle(initialTitle);
  }, [initialContent, initialTitle]);

  const getNodeAtPath = useCallback((root: MindmapNode, path: number[]): MindmapNode | null => {
    let node = root;
    for (const idx of path) {
      if (!node.children?.[idx]) return null;
      node = node.children[idx];
    }
    return node;
  }, []);

  const updateNodeAtPath = useCallback((root: MindmapNode, path: number[], updater: (n: MindmapNode) => void): MindmapNode => {
    const clone = JSON.parse(JSON.stringify(root));
    let node = clone;
    for (const idx of path) {
      if (!node.children) node.children = [];
      if (!node.children[idx]) node.children[idx] = { name: '', children: [] };
      node = node.children[idx];
    }
    updater(node);
    return clone;
  }, []);

  const deleteNodeAtPath = useCallback((root: MindmapNode, path: number[]): MindmapNode => {
    if (path.length === 0) return root;
    const clone = JSON.parse(JSON.stringify(root));
    let parent = clone;
    for (let i = 0; i < path.length - 1; i++) {
      parent = parent.children?.[path[i]] || parent;
    }
    parent.children?.splice(path[path.length - 1], 1);
    return clone;
  }, []);

  const handleNodeClick = useCallback((path: number[]) => {
    const node = getNodeAtPath(content, path);
    if (node) {
      setEditingNode({ path, field: 'name' });
      setEditValue(node.name);
    }
  }, [content, getNodeAtPath]);

  const handleAddChild = useCallback((path: number[]) => {
    const updated = updateNodeAtPath(content, path, (node) => {
      if (!node.children) node.children = [];
      node.children.push({ name: '新节点', children: [] });
    });
    setContent(updated);
  }, [content, updateNodeAtPath]);

  const handleDeleteNode = useCallback((path: number[]) => {
    if (path.length === 0) return;
    const updated = deleteNodeAtPath(content, path);
    setContent(updated);
  }, [content, deleteNodeAtPath]);

  const handleSaveConfirm = useCallback(() => {
    if (!editingNode) return;
    const updated = updateNodeAtPath(content, editingNode.path, (node) => {
      node[editingNode.field] = editValue;
    });
    setContent(updated);
    setEditingNode(null);
  }, [editingNode, editValue, content, updateNodeAtPath]);

  async function handleSave() {
    setSaving(true);
    try {
      const method = mindmapId ? 'PUT' : 'POST';
      const url = mindmapId ? `/api/v1/mindmaps/${mindmapId}` : '/api/v1/mindmaps';
      const resp = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId, title, content, style: selectedStyle }),
      });
      const data = await resp.json();
      onSave?.(data.id);
    } catch {}
    setSaving(false);
  }

  function renderTree(node: MindmapNode, path: number[] = [], depth: number = 0): React.ReactNode {
    const isRoot = path.length === 0;
    return (
      <div key={path.join('-')} className={`${isRoot ? '' : 'ml-4'}`}>
        <div
          className="flex items-center gap-1.5 py-1 px-2 rounded group cursor-pointer hover:opacity-80"
          style={{ borderLeft: `3px solid ${depth === 0 ? 'var(--color-ks-primary)' : depth === 1 ? '#91cc75' : depth === 2 ? '#fac858' : '#73c0de'}` }}
          onClick={() => handleNodeClick(path)}
        >
          <span className="text-xs font-medium" style={{ color: 'var(--color-ks-text)' }}>
            {node.name || '未命名'}
          </span>
          {node.summary && (
            <span className="text-[10px] truncate max-w-[200px]" style={{ color: 'var(--color-ks-text-muted)' }}>
              {node.summary}
            </span>
          )}
          <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 ml-auto">
            <button onClick={(e) => { e.stopPropagation(); handleAddChild(path); }} className="p-0.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-primary)' }}>
              <Plus size={10} />
            </button>
            {path.length > 0 && (
              <button onClick={(e) => { e.stopPropagation(); handleDeleteNode(path); }} className="p-0.5 rounded cursor-pointer" style={{ color: '#ef4444' }}>
                <Trash2 size={10} />
              </button>
            )}
          </div>
        </div>
        {node.children?.map((child, i) => renderTree(child, [...path, i], depth + 1))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="flex-1 text-xs font-semibold px-2 py-1 rounded outline-none"
          style={{ backgroundColor: 'transparent', color: 'var(--color-ks-text)', border: '1px solid transparent' }}
          onFocus={(e) => { e.currentTarget.style.borderColor = 'var(--color-ks-border)'; }}
          onBlur={(e) => { e.currentTarget.style.borderColor = 'transparent'; }}
        />
        <div className="relative">
          <button onClick={() => setShowStylePicker(!showStylePicker)} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)', border: '1px solid var(--color-ks-border)' }}>
            <Palette size={12} />
          </button>
          {showStylePicker && (
            <div className="absolute top-full right-0 mt-1 p-1 rounded-lg shadow-lg z-10" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
              {STYLES.map(s => (
                <button
                  key={s.key}
                  onClick={() => { setSelectedStyle(s.key); setShowStylePicker(false); }}
                  className="block w-full text-left px-2 py-1 text-[10px] rounded cursor-pointer"
                  style={{ color: selectedStyle === s.key ? 'var(--color-ks-primary)' : 'var(--color-ks-text-secondary)' }}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={handleSave} disabled={saving} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-primary)' }} title="保存">
          <Save size={12} />
        </button>
      </div>

      {editingNode && (
        <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ backgroundColor: 'var(--color-ks-hover)', borderBottom: '1px solid var(--color-ks-border)' }}>
          <input
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSaveConfirm(); if (e.key === 'Escape') setEditingNode(null); }}
            className="flex-1 text-xs px-2 py-1 rounded outline-none"
            style={{ backgroundColor: 'var(--color-ks-bg)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
            autoFocus
          />
          <button onClick={handleSaveConfirm} className="px-2 py-1 rounded text-[10px] text-white cursor-pointer" style={{ backgroundColor: 'var(--color-ks-primary)' }}>
            确定
          </button>
          <button onClick={() => setEditingNode(null)} className="px-2 py-1 rounded text-[10px] cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}>
            取消
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-3">
        {renderTree(content)}
      </div>
    </div>
  );
}
