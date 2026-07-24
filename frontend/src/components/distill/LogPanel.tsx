import { useEffect, useRef, useState } from 'react';
import type { DistillLog } from '@/types';
import { ChevronDown, ChevronUp, Info, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';

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
}

interface LogPanelProps {
  logs: DistillLog[];
  streamEvents?: StreamEvent[];
}

const EVENT_TYPE_LABELS: Record<string, string> = {
  chapter_start: '章节开始',
  chapter_progress: '章节处理',
  chapter_done: '章节完成',
  progress: '进度',
  phase: '阶段',
  error: '错误',
};

function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${h}:${m}:${s}`;
  } catch {
    return '--:--:--';
  }
}

function LevelIcon({ level }: { level: DistillLog['level'] }) {
  const size = 13;
  switch (level) {
    case 'info':
      return <Info size={size} style={{ color: 'var(--color-ks-secondary)' }} className="shrink-0" />;
    case 'warn':
      return <AlertTriangle size={size} style={{ color: 'var(--color-ks-warning)' }} className="shrink-0" />;
    case 'error':
      return <XCircle size={size} style={{ color: 'var(--color-ks-error)' }} className="shrink-0" />;
    case 'success':
      return <CheckCircle2 size={size} style={{ color: 'var(--color-ks-success)' }} className="shrink-0" />;
  }
}

function getLevelTextColor(level: DistillLog['level']): string {
  switch (level) {
    case 'info': return 'var(--color-ks-text-secondary)';
    case 'warn': return 'var(--color-ks-warning)';
    case 'error': return 'var(--color-ks-error)';
    case 'success': return 'var(--color-ks-success-dark)';
  }
}

export default function LogPanel({ logs, streamEvents = [] }: LogPanelProps) {
  const [expanded, setExpanded] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs.length, streamEvents.length]);

  const totalCount = logs.length + streamEvents.length;

  return (
    <div
      className="rounded-[var(--radius-ks-md)] overflow-hidden font-mono text-xs"
      style={{
        border: '1px solid var(--color-ks-border)',
        backgroundColor: 'var(--color-ks-sidebar)',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className={[
          'flex items-center justify-between w-full px-4 py-2.5',
          'text-sm font-[var(--font-family-ks-heading)] font-medium',
          'cursor-pointer transition-colors duration-150 hover:opacity-80',
        ].join(' ')}
        style={{
          color: 'var(--color-ks-text-secondary)',
          backgroundColor: 'var(--color-ks-sidebar)',
        }}
      >
        <span>
          工作日志
          {totalCount > 0 && (
            <span className="ml-1.5 text-xs tabular-nums" style={{ color: 'var(--color-ks-text-muted)' }}>
              ({totalCount})
            </span>
          )}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {expanded && (
        <div
          ref={scrollRef}
          className="overflow-y-auto leading-relaxed"
          style={{ maxHeight: 280, backgroundColor: 'var(--color-ks-card)' }}
        >
          {totalCount === 0 ? (
            <div className="px-4 py-6 text-center" style={{ color: 'var(--color-ks-text-muted)' }}>
              等待操作...
            </div>
          ) : (
            <div className="flex flex-col">
              {streamEvents.map((evt, i) => {
                const time = evt.timestamp ? formatTime(evt.timestamp) : '';
                const typeLabel = EVENT_TYPE_LABELS[evt.type] || evt.type;
                const isError = evt.type === 'error' || evt.message?.includes('失败');
                const isSuccess = evt.type === 'chapter_done';
                
                return (
                  <div
                    key={`evt-${i}`}
                    className="flex items-start gap-2 px-3 py-1.5 hover:opacity-90"
                    style={{ borderBottom: '1px solid var(--color-ks-border)' }}
                  >
                    <span className="shrink-0 tabular-nums pt-px" style={{ color: 'var(--color-ks-text-disabled)', width: 60 }}>
                      {time}
                    </span>
                    <span
                      className="shrink-0 font-medium"
                      style={{ color: isError ? 'var(--color-ks-error)' : isSuccess ? 'var(--color-ks-success)' : 'var(--color-ks-primary)', minWidth: 64 }}
                    >
                      [{typeLabel}]
                    </span>
                    <div className="flex-1 min-w-0" style={{ color: 'var(--color-ks-text-secondary)' }}>
                      {evt.message}
                      {evt.points_found != null && evt.points_found > 0 && (
                        <span className="ml-2 inline-block px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-ks-success)', color: '#fff', fontSize: 10 }}>
                          +{evt.points_found}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}

              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 px-3 py-1.5 hover:opacity-90"
                  style={{ borderBottom: '1px solid var(--color-ks-border)' }}
                >
                  <span className="shrink-0 tabular-nums pt-px" style={{ color: 'var(--color-ks-text-disabled)', width: 60 }}>
                    {formatTime(log.timestamp)}
                  </span>
                  <span className="shrink-0 pt-px">
                    <LevelIcon level={log.level} />
                  </span>
                  <span className="flex-1 min-w-0" style={{ color: getLevelTextColor(log.level) }}>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
