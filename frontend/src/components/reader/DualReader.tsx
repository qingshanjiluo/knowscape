import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Search,
  MessageSquare,
  Columns2,
  ArrowUpDown,
  Settings,
  BookOpen,
} from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import { ProgressBar } from '@/components/ui';
import type { ReaderPanel } from '@/types';
import DistillPanel from './DistillPanel';
import OriginalPanel from './OriginalPanel';
import ReadingSettingsPanel from '@/components/settings/ReadingSettingsPanel';

const PANEL_OPTIONS: { key: ReaderPanel; label: string; icon: React.ReactNode }[] = [
  { key: 'distilled', label: '蒸馏', icon: <BookOpen size={12} /> },
  { key: 'both', label: '双栏', icon: <Columns2 size={12} /> },
  { key: 'original', label: '原文', icon: <BookOpen size={12} /> },
];

export default function DualReader() {
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const chapters = useBookStore((s) => s.chapters);
  const loadChapter = useBookStore((s) => s.loadChapter);

  const activeChapterIndex = useUIStore((s) => s.activeChapterIndex);
  const setActiveChapter = useUIStore((s) => s.setActiveChapter);
  const readerPanel = useUIStore((s) => s.readerPanel);
  const setReaderPanel = useUIStore((s) => s.setReaderPanel);
  const toggleChat = useUIStore((s) => s.toggleChat);
  const chatOpen = useUIStore((s) => s.chatOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);

  const [syncScroll, setSyncScroll] = useState(true);
  const [showReadingSettings, setShowReadingSettings] = useState(false);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const scrollingFrom = useRef<'left' | 'right' | null>(null);

  const handleScroll = useCallback((source: 'left' | 'right') => (e: React.UIEvent<HTMLDivElement>) => {
    if (!syncScroll || scrollingFrom.current) return;
    scrollingFrom.current = source;
    const sourceEl = e.currentTarget;
    const targetEl = source === 'left' ? rightPanelRef.current : leftPanelRef.current;
    if (targetEl) {
      const pct = sourceEl.scrollTop / (sourceEl.scrollHeight - sourceEl.clientHeight || 1);
      targetEl.scrollTop = pct * (targetEl.scrollHeight - targetEl.clientHeight);
    }
    requestAnimationFrame(() => { scrollingFrom.current = null; });
  }, [syncScroll]);

  const totalChapters = chapters.length;
  const progressPercent = totalChapters > 0 ? ((activeChapterIndex + 1) / totalChapters) * 100 : 0;

  const goToPrev = useCallback(() => {
    if (activeChapterIndex > 0) setActiveChapter(activeChapterIndex - 1);
  }, [activeChapterIndex, setActiveChapter]);

  const goToNext = useCallback(() => {
    if (activeChapterIndex < totalChapters - 1) setActiveChapter(activeChapterIndex + 1);
  }, [activeChapterIndex, totalChapters, setActiveChapter]);

  useEffect(() => {
    if (selectedBookId && chapters.length > 0) {
      loadChapter(selectedBookId, activeChapterIndex);
    }
  }, [selectedBookId, activeChapterIndex, chapters.length, loadChapter]);

  return (
    <>
      <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
        {/* Top Toolbar */}
        <div
          className="shrink-0 flex items-center justify-between px-3 h-10"
          style={{
            backgroundColor: 'var(--color-ks-card)',
            borderBottom: '1px solid var(--color-ks-border)',
          }}
        >
          <div className="flex items-center gap-1">
            <button
              onClick={goToPrev}
              disabled={activeChapterIndex === 0}
              className="p-1 rounded cursor-pointer transition-opacity disabled:opacity-30 hover:opacity-70"
              style={{ color: 'var(--color-ks-text-secondary)' }}
            >
              <ChevronLeft size={14} />
            </button>
            <span
              className="text-[11px] font-medium min-w-[80px] text-center tabular-nums truncate max-w-[200px]"
              style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}
            >
              {chapters[activeChapterIndex]?.title
                ? `${activeChapterIndex + 1}/${totalChapters} ${chapters[activeChapterIndex].title}`
                : `第 ${activeChapterIndex + 1} 章`}
            </span>
            <button
              onClick={goToNext}
              disabled={activeChapterIndex >= totalChapters - 1}
              className="p-1 rounded cursor-pointer transition-opacity disabled:opacity-30 hover:opacity-70"
              style={{ color: 'var(--color-ks-text-secondary)' }}
            >
              <ChevronRight size={14} />
            </button>
          </div>

          <div
            className="flex items-center gap-0.5 p-0.5 rounded-md"
            style={{ backgroundColor: 'var(--color-ks-bg)' }}
          >
            {PANEL_OPTIONS.map((option) => (
              <button
                key={option.key}
                onClick={() => setReaderPanel(option.key)}
                className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded cursor-pointer transition-all"
                style={{
                  fontFamily: 'var(--font-family-ks-heading)',
                  color: readerPanel === option.key ? 'white' : 'var(--color-ks-text-muted)',
                  backgroundColor: readerPanel === option.key ? 'var(--color-ks-primary)' : 'transparent',
                }}
              >
                {option.icon}
                {option.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-0.5">
            {readerPanel === 'both' && (
              <button
                onClick={() => setSyncScroll(!syncScroll)}
                className="p-1 rounded cursor-pointer transition-all"
                style={{
                  color: syncScroll ? 'var(--color-ks-primary)' : 'var(--color-ks-text-muted)',
                  backgroundColor: syncScroll ? 'var(--color-ks-hover)' : 'transparent',
                }}
                title={syncScroll ? '关闭同步滚动' : '开启同步滚动'}
              >
                <ArrowUpDown size={12} />
              </button>
            )}
            <button
              onClick={() => setSearchOpen(true)}
              className="p-1 rounded cursor-pointer hover:opacity-70"
              style={{ color: 'var(--color-ks-text-muted)' }}
            >
              <Search size={13} />
            </button>
            <button
              onClick={() => setShowReadingSettings(true)}
              className="p-1 rounded cursor-pointer hover:opacity-70"
              style={{ color: 'var(--color-ks-text-muted)' }}
            >
              <Settings size={13} />
            </button>
            <button
              onClick={toggleChat}
              className="flex items-center gap-1 px-2 py-0.5 rounded cursor-pointer text-[10px] font-medium"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: chatOpen ? 'white' : 'var(--color-ks-primary)',
                backgroundColor: chatOpen ? 'var(--color-ks-primary)' : 'var(--color-ks-hover)',
              }}
            >
              <MessageSquare size={11} />
              对话
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 min-h-0 relative">
          {readerPanel === 'both' ? (
            <div className="flex h-full">
              <div
                ref={leftPanelRef}
                onScroll={handleScroll('left')}
                className="h-full overflow-y-auto"
                style={{ flex: '1 1 50%', borderRight: '1px solid var(--color-ks-border)' }}
              >
                <DistillPanel />
              </div>
              <div
                ref={rightPanelRef}
                onScroll={handleScroll('right')}
                className="h-full overflow-y-auto"
                style={{ flex: '1 1 50%' }}
              >
                <OriginalPanel />
              </div>
            </div>
          ) : readerPanel === 'distilled' ? (
            <div className="h-full overflow-y-auto">
              <DistillPanel />
            </div>
          ) : (
            <div className="h-full overflow-y-auto">
              <OriginalPanel />
            </div>
          )}
        </div>

        {/* Bottom: Chapter Progress + Navigation */}
        <div
          className="shrink-0 px-3 py-1.5"
          style={{
            backgroundColor: 'var(--color-ks-card)',
            borderTop: '1px solid var(--color-ks-border)',
          }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={goToPrev}
              disabled={activeChapterIndex === 0}
              className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium rounded cursor-pointer transition-opacity disabled:opacity-30 hover:opacity-80 shrink-0"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'var(--color-ks-text-secondary)',
                backgroundColor: 'var(--color-ks-hover)',
              }}
            >
              <ChevronLeft size={10} />
              上一章
            </button>
            <div className="flex-1 flex items-center gap-1.5">
              <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--color-ks-text-muted)', fontFamily: 'var(--font-family-ks-heading)' }}>
                {activeChapterIndex + 1}/{totalChapters}
              </span>
              <ProgressBar value={progressPercent} height={2} className="flex-1" />
              <span className="text-[10px] tabular-nums shrink-0" style={{ color: 'var(--color-ks-text-muted)', fontFamily: 'var(--font-family-ks-heading)' }}>
                {Math.round(progressPercent)}%
              </span>
            </div>
            <button
              onClick={goToNext}
              disabled={activeChapterIndex >= totalChapters - 1}
              className="flex items-center gap-0.5 px-2 py-0.5 text-[10px] font-medium rounded cursor-pointer transition-opacity disabled:opacity-30 hover:opacity-80 shrink-0"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'white',
                backgroundColor: activeChapterIndex >= totalChapters - 1 ? 'var(--color-ks-border)' : 'var(--color-ks-primary)',
              }}
            >
              下一章
              <ChevronRight size={10} />
            </button>
          </div>
        </div>
      </div>
      <ReadingSettingsPanel isOpen={showReadingSettings} onClose={() => setShowReadingSettings(false)} />
    </>
  );
}
