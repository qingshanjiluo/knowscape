// ─── 图数据模型 ───

export type NodeType = 'chapter' | 'concept' | 'person' | 'event' | 'method' | 'principle' | 'strategy' | 'model' | 'case' | 'data' | 'perspective';

export type EdgeType = 'contains' | 'relates' | 'references' | 'influences' | 'example_of' | 'part_of' | 'contradicts' | 'supports' | 'category';

export interface GraphNodeData {
  id: string;
  label: string;
  type: NodeType;
  group: string;
  chapterIndex?: number;
  chapterTitle?: string;
  pointCount?: number;
  importance?: number;
  description?: string;
  evidence?: string;
  quote?: string;
  color?: string;
  ref?: string;
  filePath?: string;
  children?: GraphNodeData[];
}

export interface GraphEdgeData {
  id: string;
  source: string;
  target: string;
  type: EdgeType;
  label?: string;
  weight?: number;
}

export interface GraphDataset {
  nodes: GraphNodeData[];
  edges: GraphEdgeData[];
  metadata?: {
    bookId: string;
    bookTitle: string;
    totalChapters: number;
    totalPoints: number;
  };
}

// ─── 框架树模型 ───

export interface FrameworkNodeData {
  id: string;
  title: string;
  level: number;
  children?: FrameworkNodeData[];
  keyPoints?: string[];
  chapterIndex?: number;
  collapsed?: boolean;
}

// ─── 类型地图模型 ───

export interface TypeMapCategory {
  id: string;
  label: string;
  color: string;
  count: number;
  items: TypeMapItem[];
}

export interface TypeMapItem {
  id: string;
  label: string;
  point: string;
  chapterIndex: number;
  chapterTitle: string;
}

// ─── 图谱交互状态 ───

export interface GraphViewState {
  selectedNode: GraphNodeData | null;
  hoveredNode: GraphNodeData | null;
  viewMode: 'graph' | 'tree' | 'typemap';
  zoom: number;
  highlightCategory: string | null;
  searchQuery: string;
  filteredNodes: string[];
}

// ─── 图谱API响应 ───

export interface GraphApiResponse {
  graph: GraphDataset;
  framework: FrameworkNodeData;
  typeMap: TypeMapCategory[];
}

// ─── 颜色方案 ───

export const NODE_TYPE_COLORS: Record<NodeType, string> = {
  chapter: '#3b82f6',
  concept: '#8b5cf6',
  person: '#f59e0b',
  event: '#ef4444',
  method: '#10b981',
  principle: '#06b6d4',
  strategy: '#f97316',
  model: '#6366f1',
  case: '#ec4899',
  data: '#14b8a6',
  perspective: '#a855f7',
};

export const NODE_TYPE_LABELS: Record<NodeType, string> = {
  chapter: '章节',
  concept: '概念',
  person: '人物',
  event: '事件',
  method: '方法',
  principle: '原则',
  strategy: '策略',
  model: '模型',
  case: '案例',
  data: '数据/证据',
  perspective: '观点/立场',
};

export const EDGE_TYPE_LABELS: Record<EdgeType, string> = {
  contains: '包含',
  relates: '关联',
  references: '引用',
  influences: '影响',
  example_of: '示例',
  part_of: '组成部分',
  contradicts: '矛盾',
  supports: '支持',
  category: '分类',
};
