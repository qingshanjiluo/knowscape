import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Layers3, ChevronDown, ChevronUp, Loader2, RefreshCw, CircleDot, CheckCircle2, Target } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import { useReadingStore } from '@/stores/readingStore';
import { Button } from '@/components/ui';
import type { DistillDepth } from '@/types';

interface DistillPoint {
  id: string;
  summary: string;
  evidence?: string;
  citation?: string;
  category: string;
  originalRef: string;
}

const DEPTH_TABS: { value: DistillDepth; label: string }[] = [
  { value: 'shallow', label: '浅层' },
  { value: 'medium', label: '中层' },
  { value: 'deep', label: '深层' },
];

export default function DistillPanel() {
  const currentChapter = useBookStore((s) => s.currentChapter);
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const activeChapterIndex = useUIStore((s) => s.activeChapterIndex);
  const selectedDepth = useBookStore((s) => s.selectedDepth);
  const distillChapter = useBookStore((s) => s.distillChapter);
  const bgColor = useReadingStore((s) => s.bgColor);
  const [activeTab, setActiveTab] = useState<DistillDepth>('medium');
  const [expandedPoints, setExpandedPoints] = useState<Set<string>>(new Set());
  const [isDistilling, setIsDistilling] = useState(false);

  const points: DistillPoint[] = (() => {
    if (!currentChapter) return [];
    const raw = currentChapter[activeTab];
    const depthData = Array.isArray(raw) ? raw : (Array.isArray(currentChapter.shallow) ? currentChapter.shallow : []);
    return depthData as DistillPoint[];
  })();

  const toggleExpand = (pointId: string) => {
    setExpandedPoints(prev => {
      const next = new Set(prev);
      if (next.has(pointId)) next.delete(pointId);
      else next.add(pointId);
      return next;
    });
  };

  const handleDistillCurrent = async () => {
    if (!selectedBookId || isDistilling) return;
    setIsDistilling(true);
    try {
      await distillChapter(selectedBookId, activeChapterIndex, selectedDepth);
    } finally {
      setIsDistilling(false);
    }
  };

  const hasDistilledContent = currentChapter && (
    (currentChapter.shallow && currentChapter.shallow.length > 0) ||
    (currentChapter.medium && currentChapter.medium.length > 0) ||
    (currentChapter.deep && currentChapter.deep.length > 0)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
        <div className="flex items-center gap-2">
          <Layers3 size={14} style={{ color: 'var(--color-ks-primary)' }} />
          <span className="text-xs font-semibold font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text)' }}>
            蒸馏结果
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          {DEPTH_TABS.map(tab => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className="px-2 py-1 text-[10px] font-medium font-[var(--font-family-ks-heading)] rounded-[var(--radius-ks-sm)] transition-colors cursor-pointer"
              style={{
                color: activeTab === tab.value ? 'white' : 'var(--color-ks-text-secondary)',
                backgroundColor: activeTab === tab.value ? 'var(--color-ks-primary)' : 'var(--color-ks-hover)',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-4 py-2 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
        <Button
          variant="secondary"
          size="sm"
          icon={isDistilling ? <Loader2 size={12} className="ks-animate-spin" /> : <RefreshCw size={12} />}
          onClick={handleDistillCurrent}
          disabled={isDistilling || !selectedBookId}
          className="w-full"
        >
          {isDistilling ? '蒸馏中...' : hasDistilledContent ? '重新蒸馏当前章节' : '蒸馏当前章节'}
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3" style={{ backgroundColor: bgColor }}>
        {!currentChapter ? (
          <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-ks-text-muted)' }}>
            <Loader2 size={16} className="ks-animate-spin mr-2" />
            <span className="text-xs">加载中...</span>
          </div>
        ) : points.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <p className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>
              当前章节暂无蒸馏结果
            </p>
            <Button
              variant="primary"
              size="sm"
              icon={<RefreshCw size={12} />}
              onClick={handleDistillCurrent}
              disabled={isDistilling || !selectedBookId}
            >
              {isDistilling ? '蒸馏中...' : '开始蒸馏'}
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {currentChapter.shallow && currentChapter.shallow.length > 0 && (
              <div className="mb-3">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(74, 111, 165, 0.1)', color: 'var(--color-ks-primary)' }}>
                  <CircleDot size={8} />
                  浅层蒸馏 · {currentChapter.shallow.length} 条
                </div>
              </div>
            )}
            {currentChapter.medium && currentChapter.medium.length > 0 && (
              <div className="mb-3">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(76, 175, 80, 0.1)', color: '#4caf50' }}>
                  <CheckCircle2 size={8} />
                  中层蒸馏 · {currentChapter.medium.length} 条
                </div>
              </div>
            )}
            {currentChapter.deep && currentChapter.deep.length > 0 && (
              <div className="mb-3">
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: 'rgba(255, 152, 0, 0.1)', color: '#ff9800' }}>
                  <Target size={8} />
                  深层蒸馏 · {currentChapter.deep.length} 条
                </div>
              </div>
            )}
            {points.map((point, index) => {
              const isExpanded = expandedPoints.has(point.id || String(index));
              return (
                <div
                  key={point.id || index}
                  className="rounded-[var(--radius-ks-md)] p-3 cursor-pointer transition-all duration-200 ks-animate-slide-up"
                  style={{
                    backgroundColor: 'var(--color-ks-hover)',
                    border: '1px solid var(--color-ks-border)',
                  }}
                  onClick={() => toggleExpand(point.id || String(index))}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium font-[var(--font-family-ks-heading)]" style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}>
                          {point.category || '未分类'}
                        </span>
                      </div>
                      <div className="text-xs leading-relaxed font-medium" style={{ color: 'var(--ks-reader-text, var(--color-ks-text))', fontFamily: 'var(--ks-reader-font-family)', fontSize: 'var(--ks-reader-font-size, 16px)', lineHeight: 'var(--ks-reader-line-height, 1.8)' }}>
                        <ReactMarkdown>{String(point.summary || '')}</ReactMarkdown>
                      </div>
                    </div>
                    <div className="shrink-0 mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>
                      {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="pt-2 mt-2 transition-all duration-200" style={{ borderTop: '1px solid var(--color-ks-border)' }}>
                      {point.evidence && (
                        <div className="text-xs italic leading-relaxed mt-1.5" style={{ color: 'var(--color-ks-text-muted)' }}>
                          <ReactMarkdown>{point.evidence || ''}</ReactMarkdown>
                        </div>
                      )}
                      {point.citation && (
                        <div className="text-[10px] leading-relaxed mt-1" style={{ color: 'var(--color-ks-text-disabled)' }}>
                          <ReactMarkdown>{String(point.citation || '')}</ReactMarkdown>
                        </div>
                      )}
                      {point.originalRef && (
                        <p className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>
                          📍 {point.originalRef}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
