// ─── UI 状态 Store ───

import { create } from 'zustand';
import type { ViewMode, ChatPosition, ReaderPanel } from '@/types';

interface UIStore {
  viewMode: ViewMode;
  sidebarCollapsed: boolean;
  chatOpen: boolean;
  chatPosition: ChatPosition;
  readerPanel: ReaderPanel;
  searchOpen: boolean;
  settingsOpen: boolean;
  activeChapterIndex: number;
  highlightCitation: string | null;
  rightPanel: 'agent' | 'mindmap' | 'knowledge-map' | null;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleChat: () => void;
  setChatPosition: (pos: ChatPosition) => void;
  setReaderPanel: (panel: ReaderPanel) => void;
  setSearchOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;
  setActiveChapter: (index: number) => void;
  setHighlightCitation: (citation: string | null) => void;
  setRightPanel: (panel: 'agent' | 'mindmap' | 'knowledge-map' | null) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  viewMode: 'library',
  sidebarCollapsed: false,
  chatOpen: false,
  chatPosition: 'float',
  readerPanel: 'both',
  searchOpen: false,
  settingsOpen: false,
  activeChapterIndex: 0,
  highlightCitation: null,
  rightPanel: 'agent',

  setViewMode: (mode) => set({ viewMode: mode }),
  toggleSidebar: () => set(s => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  toggleChat: () => set(s => ({ chatOpen: !s.chatOpen })),
  setChatPosition: (pos) => set({ chatPosition: pos }),
  setReaderPanel: (panel) => set({ readerPanel: panel }),
  setSearchOpen: (open) => set({ searchOpen: open }),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setActiveChapter: (index) => set({ activeChapterIndex: index }),
  setHighlightCitation: (citation) => set({ highlightCitation: citation }),
  setRightPanel: (panel) => set({ rightPanel: panel }),
}));
