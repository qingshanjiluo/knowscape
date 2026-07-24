import { useState, useEffect, useCallback } from 'react';
import { Network, ChevronRight, ChevronDown, Layers, FileText, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useNavigate } from 'react-router-dom';

interface TreeNode {
  id: string;
  label: string;
  type: 'volume' | 'chapter' | 'concept';
  hasDistilled?: boolean;
  children?: TreeNode[];
}

export default function BookFrameworkTree() {
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [hasVolumes, setHasVolumes] = useState(false);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [splitting, setSplitting] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedContent, setGeneratedContent] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!selectedBookId) return;
    setLoading(true);
    fetch('/api/v1/book-structure?book_id=' + selectedBookId)
      .then(function(r) { return r.json(); })
      .then(function(d) {
        setTree(d.tree || []);
        setHasVolumes(d.hasVolumes || false);
        setLoading(false);
      })
      .catch(function() { setLoading(false); });
  }, [selectedBookId]);

  var toggleNode = useCallback(function(id: string) {
    setExpandedNodes(function(prev) {
      var next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  function handleSplitVolumes() {
    if (!selectedBookId) return;
    setSplitting(true);
    fetch('/api/v1/split-as-volumes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: selectedBookId }),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if (data.hasVolumes) {
          setHasVolumes(true);
          fetch('/api/v1/book-structure?book_id=' + selectedBookId)
            .then(function(r2) { return r2.json(); })
            .then(function(s) { setTree(s.tree || []); });
        }
      })
      .catch(function() {})
      .finally(function() { setSplitting(false); });
  }

  function handleGenerate() {
    if (!prompt.trim() || !selectedBookId) return;
    setGenerating(true);
    setGeneratedContent('');
    fetch('/api/v1/ask-question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ book_id: selectedBookId, question: prompt }),
    })
      .then(function(r) { return r.json(); })
      .then(function(data) {
        setGeneratedContent(data.answer || '生成完成');
      })
      .catch(function() {
        setGeneratedContent('生成失败，请重试');
      })
      .finally(function() {
        setGenerating(false);
      });
  }

  function renderNode(node: TreeNode, depth: number) {
    var isExpanded = expandedNodes.has(node.id);
    var hasChildren = node.children && node.children.length > 0;
    var Icon = node.type === 'volume' ? Layers : FileText;

    return (
      <div key={node.id}>
        <div
          className="flex items-center gap-1.5 px-2 py-1 rounded cursor-pointer transition-colors"
          style={{ paddingLeft: depth * 16 + 8, color: 'var(--color-ks-text-secondary)' }}
          onMouseEnter={function(e) { e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)'; }}
          onMouseLeave={function(e) { e.currentTarget.style.backgroundColor = 'transparent'; }}
          onClick={function() { if (hasChildren) toggleNode(node.id); }}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />
          ) : (
            <span className="w-[10px]" />
          )}
          <Icon size={12} style={{
            color: node.type === 'volume' ? 'var(--color-ks-primary)' :
                   node.hasDistilled ? 'var(--color-ks-success)' : 'var(--color-ks-text-disabled)'
          }} />
          <span className="text-xs truncate" style={{ color: 'var(--color-ks-text)' }}>{node.label}</span>
          {node.hasDistilled && (
            <span className="ml-auto text-[8px] px-1 py-0.5 rounded" style={{ backgroundColor: 'rgba(81, 207, 102, 0.15)', color: 'var(--color-ks-success)' }}>
              已蒸馏
            </span>
          )}
        </div>
        {hasChildren && isExpanded && node.children!.map(function(child) { return renderNode(child, depth + 1); })}
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
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: 'var(--color-ks-border)' }}>
        <button onClick={function() { navigate('/workspace'); }} className="p-1 rounded hover:opacity-80 cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}>
          <ArrowLeft size={16} />
        </button>
        <Network size={16} style={{ color: 'var(--color-ks-primary)' }} />
        <h2 className="text-sm font-semibold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
          书籍框架图
        </h2>
        {!hasVolumes && (
          <button
            onClick={handleSplitVolumes}
            disabled={splitting}
            className="ml-auto text-[10px] px-2 py-1 rounded cursor-pointer"
            style={{
              backgroundColor: 'var(--color-ks-hover)',
              color: 'var(--color-ks-text-secondary)',
              border: '1px solid var(--color-ks-border)',
              opacity: splitting ? 0.5 : 1,
            }}
          >
            {splitting ? '分析中...' : '智能分卷'}
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <div className="flex items-center justify-center py-8" style={{ color: 'var(--color-ks-text-muted)' }}>
            <p className="text-xs">加载中...</p>
          </div>
        ) : tree.length > 0 ? (
          <div>
            {tree.map(function(node) { return renderNode(node, 0); })}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 gap-4" style={{ color: 'var(--color-ks-text-muted)' }}>
            <Network size={40} style={{ color: 'var(--color-ks-text-disabled)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>暂无框架数据</p>
            <p className="text-xs text-center max-w-xs">书籍尚未蒸馏或未检测到框架结构</p>
            <button
              onClick={handleSplitVolumes}
              disabled={splitting}
              className="text-[11px] px-3 py-1.5 rounded cursor-pointer"
              style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}
            >
              {splitting ? '分析中...' : '尝试智能分卷'}
            </button>
          </div>
        )}
      </div>

      <div className="px-3 py-2 border-t" style={{ borderColor: 'var(--color-ks-border)' }}>
        <div className="text-[10px] mb-1.5" style={{ color: 'var(--color-ks-text-muted)' }}>
          输入提示词生成框架内容
        </div>
        <div className="flex gap-1.5">
          <input
            type="text"
            value={prompt}
            onChange={function(e) { setPrompt(e.target.value); }}
            onKeyDown={function(e) { if (e.key === 'Enter' && !generating) handleGenerate(); }}
            placeholder="例如：帮我分析本书的知识框架..."
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
      </div>
    </div>
  );
}
