import { useState, useEffect, useCallback } from 'react';
import {
  Share2, TreePine, LayoutGrid, Search,
  Loader2, AlertCircle, RotateCcw,
} from 'lucide-react';
import { GraphViz } from './GraphViz';
import { FrameworkTree } from './FrameworkTree';
import { TypeMap } from './TypeMap';
import { GraphDetailPanel } from './GraphDetailPanel';
import { NODE_TYPE_COLORS } from '@/types/graph';
import type {
  GraphDataset, FrameworkNodeData, TypeMapCategory,
  GraphNodeData, GraphViewState, GraphApiResponse,
} from '@/types/graph';
import { contentApi } from '@/api';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';

const VIEW_MODES = [
  { key: 'graph' as const, label: '知识图谱', icon: Share2 },
  { key: 'tree' as const, label: '框架树', icon: TreePine },
  { key: 'typemap' as const, label: '类型地图', icon: LayoutGrid },
];

export function GraphWorkstation() {
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [graphData, setGraphData] = useState<GraphDataset>({ nodes: [], edges: [] });
  const [framework, setFramework] = useState<FrameworkNodeData | null>(null);
  const [typeMap, setTypeMap] = useState<TypeMapCategory[]>([]);

  const [state, setState] = useState<GraphViewState>({
    selectedNode: null,
    hoveredNode: null,
    viewMode: 'graph',
    zoom: 1,
    highlightCategory: null,
    searchQuery: '',
    filteredNodes: [],
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const bookId = selectedBookId || 'b001';
      const res = await contentApi.getGraphData(bookId);
      // Convert existing GraphData to rich format
      const apiRes = res as unknown as GraphApiResponse;
      setGraphData(apiRes.graph ?? { nodes: res.nodes.map(n => ({
        id: n.id, label: n.label, type: 'concept', group: n.category,
        chapterIndex: n.chapterIndex, pointCount: n.pointCount, importance: n.size / 10,
        color: NODE_TYPE_COLORS.concept,
      })), edges: res.edges.map(e => ({
        id: `${e.source}-${e.target}`, source: e.source, target: e.target, type: e.type as any,
      })) });
      setFramework(apiRes.framework ?? null);
      setTypeMap(apiRes.typeMap ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : '加载失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleNodeClick = useCallback((node: GraphNodeData) => {
    setState((prev) => ({ ...prev, selectedNode: node }));
    if (node.type === 'chapter' && node.chapterIndex != null) {
      const uiStore = useUIStore.getState();
      uiStore.setActiveChapter(node.chapterIndex);
      uiStore.setViewMode('reader');
    }
  }, []);

  const handleNodeHover = useCallback((node: GraphNodeData | null) => {
    setState((prev) => ({ ...prev, hoveredNode: node }));
  }, []);

  const handleCategoryClick = useCallback((cat: TypeMapCategory) => {
    setState((prev) => ({
      ...prev,
      highlightCategory: prev.highlightCategory === cat.id ? null : cat.id,
    }));
  }, []);

  const handleRelatedClick = useCallback((nodeId: string) => {
    const node = graphData.nodes.find((n) => n.id === nodeId);
    if (node) setState((prev) => ({ ...prev, selectedNode: node }));
  }, [graphData.nodes]);

  const handleFrameworkNodeClick = useCallback((node: FrameworkNodeData) => {
    if (node.keyPoints) {
      const fn: GraphNodeData = {
        id: node.id,
        label: node.title,
        type: 'chapter',
        group: 'chapter',
        chapterIndex: node.chapterIndex,
        description: node.keyPoints.join('；'),
      };
      setState((prev) => ({ ...prev, selectedNode: fn }));
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-[600px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4" style={{ color: 'var(--color-ks-text-muted)' }}>
        <AlertCircle size={48} style={{ color: 'var(--color-ks-error)' }} />
        <p className="text-sm">{error}</p>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm cursor-pointer"
          style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}
        >
          <RotateCcw size={14} />
          重试
        </button>
      </div>
    );
  }

  const isEmpty = graphData.nodes.length === 0 && !framework && typeMap.length === 0;

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center h-[600px] gap-4" style={{ color: 'var(--color-ks-text-muted)' }}>
        <Share2 size={48} style={{ color: 'var(--color-ks-text-disabled)' }} />
        <div className="text-center">
          <p className="text-sm font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>该书籍暂无图谱数据</p>
          <p className="text-xs mt-1">请先完成蒸馏</p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors text-sm cursor-pointer"
          style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
        >
          <RotateCcw size={14} />
          刷新
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-white shrink-0">
        {VIEW_MODES.map((mode) => (
          <button
            key={mode.key}
            onClick={() => setState((prev) => ({ ...prev, viewMode: mode.key }))}
            className={`
              flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors
              ${state.viewMode === mode.key
                ? 'bg-blue-500 text-white shadow-sm'
                : 'text-slate-500 hover:bg-slate-100'
              }
            `}
          >
            <mode.icon className="w-4 h-4" />
            {mode.label}
          </button>
        ))}

        <div className="ml-auto relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="搜索节点..."
            value={state.searchQuery}
            onChange={(e) => setState((prev) => ({ ...prev, searchQuery: e.target.value }))}
            className="pl-9 pr-3 py-1.5 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 w-48"
          />
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 relative">
          {state.viewMode === 'graph' && (
            <GraphViz
              data={graphData}
              onNodeClick={handleNodeClick}
              onNodeHover={handleNodeHover}
              highlightCategory={state.highlightCategory}
              searchQuery={state.searchQuery}
            />
          )}
          {state.viewMode === 'tree' && (
            <FrameworkTree
              root={framework}
              onNodeClick={handleFrameworkNodeClick}
              highlightId={state.selectedNode?.id}
            />
          )}
          {state.viewMode === 'typemap' && (
            <TypeMap
              categories={typeMap}
              onCategoryClick={handleCategoryClick}
              onItemClick={(item) => {
                const n = graphData.nodes.find((nd) => nd.id === item.id);
                if (n) handleNodeClick(n);
              }}
              highlightCategory={state.highlightCategory}
            />
          )}
        </div>

        {/* Detail panel */}
        {state.selectedNode && (
          <div className="w-72 border-l bg-white overflow-y-auto shrink-0">
            <GraphDetailPanel
              node={state.selectedNode}
              dataset={graphData}
              onClose={() => setState((prev) => ({ ...prev, selectedNode: null }))}
              onRelatedClick={handleRelatedClick}
            />
          </div>
        )}
      </div>
    </div>
  );
}
