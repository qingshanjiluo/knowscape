// Auto-generated TypeScript declarations for Tauri IPC commands
// Usage: import { invoke } from '@tauri-apps/api/core';

export interface BookInfo {
  id: string;
  title: string;
  author: string;
  coverColor?: string;
  sourceFormat: string;
  status: string;
  progress: BookProgress;
  stats: BookStats;
  createdAt: string;
  updatedAt: string;
}

export interface BookProgress {
  phase: string;
  percent: number;
  currentChapter: number;
  totalChapters: number;
  message: string;
  estimatedRemainingMs?: number;
}

export interface BookStats {
  totalChapters: number;
  distilledPoints: number;
  categories: Record<string, number>;
}

export interface ChapterContent {
  bookId: string;
  chapterIndex: number;
  title: string;
  shallow: DistillPoint[];
  medium: DistillPoint[];
  deep: DistillPoint[];
  originalText: string;
}

export interface DistillPoint {
  id: string;
  summary: string;
  evidence?: string;
  citation?: string;
  originalRef: string;
  category: string;
  chapterIndex: number;
}

export interface FrameworkTree {
  bookId: string;
  title: string;
  children: FrameworkNode[];
}

export interface FrameworkNode {
  id: string;
  label: string;
  level: number;
  chapterIndex?: number;
  children: FrameworkNode[];
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface GraphNode {
  id: string;
  label: string;
  category: string;
  chapterIndex: number;
  pointCount: number;
  size: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  relationType: string;
}

export interface DistillStatus {
  bookId: string;
  isRunning: boolean;
  overallProgress: number;
  currentPhase: string;
  chapters: ChapterProgress[];
}

export interface ChapterProgress {
  index: number;
  title: string;
  status: string;
}

export declare function uploadBook(path: string, content?: string): Promise<string>;
export declare function listBooks(): Promise<BookInfo[]>;
export declare function startDistillation(bookId: string, depth: string): Promise<string>;
export declare function getDistillationStatus(bookId: string): Promise<DistillStatus>;
export declare function getChapter(bookId: string, chapterIndex: number): Promise<ChapterContent>;
export declare function getFramework(bookId: string): Promise<FrameworkTree>;
export declare function getGraphData(bookId: string): Promise<GraphData>;
export declare function deleteBook(bookId: string): Promise<void>;
