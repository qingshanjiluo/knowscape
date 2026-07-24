// ─── 知境（KnowScape）类型定义 ───

// ─── 书籍相关 ───

export type BookStatus = 'idle' | 'importing' | 'parsing' | 'parsed' | 'distilling' | 'completed' | 'error';

export type DistillDepth = 'shallow' | 'medium' | 'deep';

export type DistillPhase = 'uploaded' | 'parsing' | 'parsed' | 'chapering' | 'distilling' | 'framing' | 'completed' | 'error';

export type DistillCategory =
  | 'methodology'
  | 'principles'
  | 'strategies'
  | 'models'
  | 'caseStudies'
  | 'dataEvidence'
  | 'perspectives';

export const DISTILL_CATEGORY_LABELS: Record<DistillCategory, string> = {
  methodology: '方法',
  principles: '原则',
  strategies: '策略',
  models: '模型',
  caseStudies: '案例',
  dataEvidence: '数据/证据',
  perspectives: '观点',
};

export const DISTILL_CATEGORY_COLORS: Record<DistillCategory, string> = {
  methodology: 'var(--color-ks-cat-method)',
  principles: 'var(--color-ks-cat-principle)',
  strategies: 'var(--color-ks-cat-strategy)',
  models: 'var(--color-ks-cat-model)',
  caseStudies: 'var(--color-ks-cat-case)',
  dataEvidence: 'var(--color-ks-cat-data)',
  perspectives: 'var(--color-ks-cat-perspective)',
};

export interface BookProgress {
  phase: DistillPhase;
  percent: number;
  currentChapter: number;
  totalChapters: number;
  message: string;
  estimatedRemainingMs?: number;
}

export interface BookStats {
  totalChapters: number;
  distilledPoints: number;
  categories: Record<DistillCategory, number>;
}

export interface BookInfo {
  id: string;
  title: string;
  author: string;
  coverColor?: string;
  sourceFormat: string;
  status: BookStatus;
  progress: BookProgress;
  stats: BookStats;
  createdAt: string;
  updatedAt: string;
}

// ─── 章节相关 ───

export interface ChapterBoundary {
  index: number;
  title: string;
  level: number;
  startPosition: number;
  endPosition: number;
}

export interface ChapterSummary {
  index: number;
  title: string;
  status: 'pending' | 'processing' | 'done' | 'error';
  tokenCount?: number;
  pointCount?: number;
  elapsed_ms?: number;
  retryCount?: number;
  categoryDistribution?: Partial<Record<DistillCategory, number>>;
}

// ─── 蒸馏内容 ───

export interface DistillPoint {
  id: string;
  summary: string;
  evidence?: string;
  citation?: string;
  originalRef: string;
  category: DistillCategory;
  chapterIndex: number;
}

export interface ChapterContent {
  bookId: string;
  chapterIndex: number;
  title: string;
  shallow: DistillPoint[];
  medium: (DistillPoint & { evidence: string })[];
  deep: (DistillPoint & { evidence: string; citation: string })[];
  originalText: string;
  annotations: Annotation[];
}

// ─── 引用相关 ───

export interface Citation {
  id: string;
  text: string;
  chapterIndex: number;
  position: { start: number; end: number };
  sourcePage?: number;
}

// ─── 批注相关 ───

export interface Annotation {
  id: string;
  text: string;
  note: string;
  color: string;
  chapterIndex: number;
  position: { start: number; end: number };
  createdAt: string;
}

// ─── 对话相关 ───

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Citation[];
  suggestions?: string[];
  timestamp: string;
  isStreaming?: boolean;
}

export interface ChatSession {
  id: string;
  bookId: string;
  title: string;
  messages: ChatMessage[];
  createdAt: string;
  updatedAt: string;
}

// ─── 深度生成 ───

export type GenerateTarget = 'byType' | 'crossChapter' | 'byTopic' | 'freeform';

export interface GenerateConfig {
  target: GenerateTarget;
  types: DistillCategory[];
  outputFormat: 'markdown' | 'pdf' | 'html';
  customPrompt?: string;
}

export interface GeneratedDocument {
  id: string;
  bookId: string;
  title: string;
  content: string;
  config: GenerateConfig;
  status: 'generating' | 'done' | 'error';
  progress: number;
  createdAt: string;
}

// ─── 蒸馏状态 ───

export interface DistillStatus {
  bookId: string;
  isRunning: boolean;
  overallProgress: number;
  currentPhase: DistillPhase;
  phases: PhaseStatus[];
  chapters: ChapterSummary[];
  logs: DistillLog[];
  startedAt?: string;
  estimatedCompletion?: string;
}

export interface PhaseStatus {
  name: string;
  label: string;
  status: 'pending' | 'active' | 'done' | 'error';
  detail?: string;
}

export interface DistillLog {
  id: string;
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'success';
  message: string;
}

// ─── 图谱相关 ───

export interface GraphNode {
  id: string;
  label: string;
  category: DistillCategory;
  chapterIndex: number;
  pointCount: number;
  size: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'citation' | 'category' | 'chapter';
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ─── 重新导出增强图谱类型 ───

export type {
  GraphNodeData,
  GraphEdgeData,
  GraphDataset,
  FrameworkNodeData,
  TypeMapCategory,
  TypeMapItem,
  NodeType,
  EdgeType,
  GraphViewState,
  GraphApiResponse,
} from './graph';

export {
  NODE_TYPE_COLORS,
  NODE_TYPE_LABELS,
  EDGE_TYPE_LABELS,
} from './graph';

// ─── 搜索相关 ───

export interface SearchResult {
  type: 'distill' | 'original' | 'annotation';
  bookId: string;
  chapterIndex: number;
  title: string;
  snippet: string;
  matchRange: { start: number; end: number };
}

// ─── UI 状态 ───

export type ViewMode = 'library' | 'distill' | 'reader' | 'graph' | 'deepgen' | 'mindmap' | 'folder' | 'framework';

export type ReaderPanel = 'distilled' | 'original' | 'both';

export type ChatPosition = 'right' | 'float';

// ─── API 响应 ───

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  citations?: Citation[];
  suggestions?: string[];
}

// ─── 设置 ───

export interface AppSettings {
  theme: 'light' | 'dark' | 'sepia';
  readerFontSize: number;
  sidebarCollapsed: boolean;
  chatPosition: ChatPosition;
  apiEndpoint: string;
  apiKey?: string;
  modelProvider: 'deepseek' | 'ollama' | 'openai';
  modelName: string;
}
