import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Play, XCircle, Settings2, BookOpen, Loader2, FileText, Folder, Network, Download, Layout, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { DistillDepth } from '@/types';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import { Button, ProgressBar } from '@/components/ui';
import PhaseStepper from './PhaseStepper';
import ChapterProgressList from './ChapterProgressList';
import LogPanel from './LogPanel';

interface StreamEvent {
  type: string;
  phase?: string;
  chapter_index?: number;
  chapter_title?: string;
  progress?: number;
  overall_progress?: number;
  message?: string;
  total?: number;
  points_found?: number;
  level?: string;
  timestamp?: string;
  event?: string;
  start_time?: number;
  total_elapsed_ms?: number;
  elapsed_ms?: number;
}

const DEPTH_OPTIONS: { value: DistillDepth; label: string; desc: string }[] = [
  { value: 'shallow', label: '浅度', desc: '快速提取核心观点' },
  { value: 'medium', label: '中度', desc: '深入分析与论证' },
  { value: 'deep', label: '深度', desc: '完整引用与交叉分析' },
];

export default function DistillWorkstation() {
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const books = useBookStore((s) => s.books);
  const chapters = useBookStore((s) => s.chapters);
  const distillStatus = useBookStore((s) => s.distillStatus);
  const logs = useBookStore((s) => s.logs);
  const selectedDepth = useBookStore((s) => s.selectedDepth);
  const setSelectedDepth = useBookStore((s) => s.setSelectedDepth);
  const startDistillation = useBookStore((s) => s.startDistillation);
  const cancelDistillation = useBookStore((s) => s.cancelDistillation);
  const selectBook = useBookStore((s) => s.selectBook);
  const wholeBookDoc = useBookStore((s) => s.wholeBookDoc);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const navigate = useNavigate();

  const [streamEvents, setStreamEvents] = useState<StreamEvent[]>([]);
  const [_currentPhase, setCurrentPhase] = useState('');
  const [currentChapter, setCurrentChapter] = useState<{ index: number; title: string; total: number } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [timerStart, setTimerStart] = useState<number | null>(null);
  const [totalElapsed, setTotalElapsed] = useState<number | null>(null);
  const [elapsedMap, setElapsedMap] = useState<Record<number, number>>({});
  const streamRef = useRef<EventSource | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [now, setNow] = useState(Date.now());
  const [workflowPhase, setWorkflowPhase] = useState<'idle' | 'extracting' | 'distilling' | 'generating_map' | 'completed'>('idle');

  const book = books.find((b) => b.id === selectedBookId);
  const isRunning = (distillStatus?.isRunning ?? false) || isStreaming;
  const canStart = !isRunning && (book?.status === 'parsed' || book?.status === 'completed' || book?.status === 'idle');
  const canCancel = isRunning;

  useEffect(() => {
    if (selectedBookId && isRunning) {
      connectSSE(selectedBookId);
    }
    return () => { streamRef.current?.close(); };
  }, [selectedBookId, isRunning]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length, streamEvents.length]);

  const connectSSE = useCallback((bookId: string) => {
    streamRef.current?.close();
    const es = new EventSource(`/api/v1/distill-progress?book_id=${bookId}`);
    streamRef.current = es;
    setIsStreaming(true);
    setTimerStart(Date.now());
    setTotalElapsed(null);
    setElapsedMap({});

    es.onmessage = (ev) => {
      try {
        const data: StreamEvent = JSON.parse(ev.data);
        if (data.type === 'done') {
          es.close();
          setIsStreaming(false);
          return;
        }
        if (data.type === 'log') return;
        if (data.type === 'timer') {
          if (data.event === 'start' && data.start_time) {
            setTimerStart(data.start_time);
          } else if (data.event === 'end' && data.total_elapsed_ms) {
            setTotalElapsed(data.total_elapsed_ms);
            if (timerRef.current) clearInterval(timerRef.current);
          }
          return;
        }
        if (data.type === 'chapter_elapsed') {
          setElapsedMap(prev => ({ ...prev, [data.chapter_index!]: data.elapsed_ms! }));
          return;
        }
        setStreamEvents(prev => [...prev, data]);
        if (data.phase) setCurrentPhase(data.phase);
        if (data.chapter_index != null && data.chapter_title && data.total) {
          setCurrentChapter({ index: data.chapter_index, title: data.chapter_title, total: data.total });
        }
      } catch {}
    };

    es.onerror = () => { es.close(); setIsStreaming(false); };
  }, []);

  useEffect(() => {
    if (timerStart && isStreaming && !totalElapsed) {
      timerRef.current = setInterval(() => setNow(Date.now()), 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [timerStart, isStreaming, totalElapsed]);

  const displayElapsed = totalElapsed ?? (timerStart ? now - timerStart : 0);

  function formatElapsed(ms: number): string {
    if (ms <= 0) return '0s';
    const s = Math.floor(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    return `${m}m ${s % 60}s`;
  }

  if (!book) {
    return (
      <div className="flex items-center justify-center h-full" style={{ color: 'var(--color-ks-text-muted)' }}>
        <p className="text-sm font-[var(--font-family-ks-heading)]">请选择一本书籍</p>
      </div>
    );
  }

  const handleBack = () => { selectBook(null); setViewMode('library'); };
  const handleStart = async () => {
    if (!selectedBookId) return;
    setStreamEvents([]);
    setCurrentPhase('');
    setCurrentChapter(null);
    setWorkflowPhase('extracting');
    
    try {
      await fetch('/api/v1/auto-clean-chapters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId }),
      });
    } catch {}
    
    setWorkflowPhase('distilling');
    startDistillation(selectedBookId, selectedDepth, customPrompt || undefined);
  };
  const handleCancel = () => { 
    if (selectedBookId) cancelDistillation(selectedBookId);
    setWorkflowPhase('idle');
  };

  const overallProgress = book?.progress?.percent ?? distillStatus?.overallProgress ?? 0;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="flex items-center gap-3 px-6 py-3 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
        <button onClick={handleBack} className="p-1.5 rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity hover:opacity-70" style={{ color: 'var(--color-ks-text-muted)' }} title="返回书架">
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-semibold font-[var(--font-family-ks-heading)] truncate" style={{ color: 'var(--color-ks-text)' }}>{book.title}</h2>
          <p className="text-xs truncate" style={{ color: 'var(--color-ks-text-muted)' }}>{book.author}</p>
        </div>
        {isRunning && (
          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-mono tabular-nums flex items-center gap-1" style={{ color: 'var(--color-ks-text-muted)' }}>
              <Clock size={12} />
              {formatElapsed(displayElapsed)}
            </span>
            <ProgressBar value={overallProgress} height={4} className="w-32" />
            <span className="text-sm font-[var(--font-family-ks-heading)] tabular-nums" style={{ color: 'var(--color-ks-text-secondary)' }}>
              {Math.round(overallProgress)}%
            </span>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto flex flex-col gap-6">
          {/* Workflow Phase Indicator */}
          {workflowPhase !== 'idle' && (
            <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
              <div className="flex items-center gap-2">
                {workflowPhase === 'extracting' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-ks-primary)' }} />}
                {workflowPhase === 'distilling' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-ks-success)' }} />}
                {workflowPhase === 'generating_map' && <Loader2 size={14} className="animate-spin" style={{ color: 'var(--color-ks-warning)' }} />}
                {workflowPhase === 'completed' && <span style={{ color: 'var(--color-ks-success)' }}>✓</span>}
                <span className="text-xs font-medium" style={{ color: 'var(--color-ks-text)' }}>
                  {workflowPhase === 'extracting' && '正在提取和清理章节...'}
                  {workflowPhase === 'distilling' && '正在蒸馏分析...'}
                  {workflowPhase === 'generating_map' && '正在生成知识图谱...'}
                  {workflowPhase === 'completed' && '工作流已完成'}
                </span>
              </div>
              <div className="flex-1" />
              <span className="text-[10px]" style={{ color: 'var(--color-ks-text-muted)' }}>
                {workflowPhase === 'extracting' && '步骤 1/3'}
                {workflowPhase === 'distilling' && '步骤 2/3'}
                {workflowPhase === 'generating_map' && '步骤 3/3'}
                {workflowPhase === 'completed' && '完成'}
              </span>
            </div>
          )}

          {distillStatus && distillStatus.phases && distillStatus.phases.length > 0 && (
            <section className="rounded-[var(--radius-ks-lg)] p-5" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
              <h3 className="text-sm font-semibold font-[var(--font-family-ks-heading)] mb-4" style={{ color: 'var(--color-ks-text)' }}>蒸馏进度</h3>
              <PhaseStepper phases={distillStatus.phases} />
            </section>
          )}

          {isStreaming && currentChapter && (
            <section className="rounded-[var(--radius-ks-lg)] p-4" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
              <div className="flex items-center gap-2">
                <Loader2 size={14} className="ks-animate-spin" style={{ color: 'var(--color-ks-primary)' }} />
                <span className="text-xs font-medium font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text-secondary)' }}>
                  处理中: 第{currentChapter.index + 1}章 / {currentChapter.total}章
                </span>
                <span className="text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>{currentChapter.title}</span>
              </div>
            </section>
          )}

          <section className="rounded-[var(--radius-ks-lg)] p-5" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Settings2 size={16} style={{ color: 'var(--color-ks-text-secondary)' }} />
              <h3 className="text-sm font-semibold font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text)' }}>蒸馏设置</h3>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-xs font-medium font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text-secondary)' }}>蒸馏深度</label>
              <div className="flex gap-3">
                {DEPTH_OPTIONS.map((opt) => {
                  const isActive = selectedDepth === opt.value;
                  return (
                    <label key={opt.value} className="flex-1 flex flex-col items-center gap-1 p-3 rounded-[var(--radius-ks-md)] cursor-pointer transition-all duration-150" style={{ backgroundColor: isActive ? 'var(--color-ks-hover)' : 'transparent', border: `1px solid ${isActive ? 'var(--color-ks-primary)' : 'var(--color-ks-border)'}`, opacity: isRunning ? 0.5 : 1, pointerEvents: isRunning ? 'none' : 'auto' }}>
                      <input type="radio" name="depth" value={opt.value} checked={isActive} onChange={() => setSelectedDepth(opt.value)} className="sr-only" />
                      <span className="text-sm font-semibold font-[var(--font-family-ks-heading)]" style={{ color: isActive ? 'var(--color-ks-primary)' : 'var(--color-ks-text)' }}>{opt.label}</span>
                      <span className="text-[11px] text-center leading-tight" style={{ color: 'var(--color-ks-text-muted)' }}>{opt.desc}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2 mb-4">
              <label className="text-xs font-medium font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text-secondary)' }}>自定义提示词（可选）</label>
              <textarea
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="例如：重点关注技术实现细节，忽略营销内容..."
                rows={3}
                disabled={isRunning}
                className="w-full px-3 py-2 text-xs rounded-[var(--radius-ks-md)] resize-none outline-none transition-colors"
                style={{
                  backgroundColor: 'var(--color-ks-hover)',
                  border: '1px solid var(--color-ks-border)',
                  color: 'var(--color-ks-text)',
                }}
              />
            </div>

            <div className="flex items-center gap-3">
              {canStart && (
                <Button variant="primary" size="md" icon={<Play size={14} />} onClick={handleStart}>开始蒸馏</Button>
              )}
              {canCancel && (
                <Button variant="danger" size="md" icon={<XCircle size={14} />} onClick={handleCancel}>取消蒸馏</Button>
              )}
              {(book.status === 'completed' || book.status === 'parsed') && chapters.length > 0 && (
                <Button variant="secondary" size="md" icon={<BookOpen size={14} />} onClick={() => setViewMode('reader')}>进入阅读</Button>
              )}
              <button
                onClick={() => { useUIStore.getState().setViewMode('folder'); navigate('/workspace/folder'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
              >
                <Folder size={12} />
                文件夹
              </button>
              <button
                onClick={() => { useUIStore.getState().setViewMode('framework'); navigate('/workspace/framework'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
              >
                <Network size={12} />
                框架图
              </button>
              <button
                onClick={async () => {
                  if (!selectedBookId) return;
                  try {
                    const resp = await fetch(`/api/v1/export-book?book_id=${selectedBookId}&format=markdown`);
                    if (!resp.ok) throw new Error('导出失败');
                    const blob = await resp.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = 'export.md';
                    a.click();
                    URL.revokeObjectURL(url);
                  } catch {}
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
              >
                <Download size={12} />
                导出
              </button>
              <button
                onClick={() => {
                  const { setRightPanel, rightPanel } = useUIStore.getState();
                  setRightPanel(rightPanel === 'mindmap' ? null : 'mindmap');
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors"
                style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
              >
                <Layout size={12} />
                导图
              </button>
            </div>
          </section>

          {wholeBookDoc && (
            <section className="rounded-[var(--radius-ks-lg)] p-5" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} style={{ color: 'var(--color-ks-primary)' }} />
                <h3 className="text-sm font-semibold font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text)' }}>全书蒸馏文档</h3>
              </div>
              <div className="text-xs leading-relaxed whitespace-pre-wrap max-h-96 overflow-y-auto" style={{ color: 'var(--color-ks-text-secondary)' }}>
                {wholeBookDoc}
              </div>
              <div className="mt-3">
                <Button variant="secondary" size="md" icon={<BookOpen size={14} />} onClick={() => setViewMode('reader')}>进入阅读</Button>
              </div>
            </section>
          )}

          {chapters.length > 0 && (
            <section className="rounded-[var(--radius-ks-lg)] p-5" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
              <h3 className="text-sm font-semibold font-[var(--font-family-ks-heading)] mb-3" style={{ color: 'var(--color-ks-text)' }}>
                章节进度
                <span className="ml-1.5 text-xs font-normal" style={{ color: 'var(--color-ks-text-muted)' }}>
                  ({chapters.filter((c) => c.status === 'done').length}/{chapters.length})
                </span>
              </h3>
              <ChapterProgressList chapters={chapters} elapsedMap={elapsedMap} />
            </section>
          )}

          {(workflowPhase === 'generating_map' || workflowPhase === 'completed') && (
            <section className="rounded-[var(--radius-ks-lg)] p-5" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
              <div className="flex items-center gap-2 mb-4">
                <Network size={16} style={{ color: 'var(--color-ks-primary)' }} />
                <h3 className="text-sm font-semibold font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text)' }}>知识图谱</h3>
              </div>
              <div className="h-96 rounded-lg overflow-hidden" style={{ border: '1px solid var(--color-ks-border)' }}>
                {selectedBookId && (
                  <iframe
                    src={`/workspace/mindmap?book_id=${selectedBookId}`}
                    className="w-full h-full border-0"
                    title="知识图谱"
                  />
                )}
              </div>
            </section>
          )}

          <section className="rounded-[var(--radius-ks-lg)] p-5" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
            <h3 className="text-sm font-semibold font-[var(--font-family-ks-heading)] mb-3" style={{ color: 'var(--color-ks-text)' }}>工作日志</h3>
            <div className="max-h-96 overflow-y-auto">
              <LogPanel logs={logs} streamEvents={streamEvents} />
              <div ref={logEndRef} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
