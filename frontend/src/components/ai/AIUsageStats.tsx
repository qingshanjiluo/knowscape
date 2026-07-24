import { useState, useEffect } from 'react';
import { Activity, Cpu, Database, Clock, Zap, ArrowUpRight, ArrowDownRight, RefreshCw } from 'lucide-react';

interface UsageOverview {
  total_calls: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_tokens: number;
  cache_hits: number;
  avg_duration_ms: number;
  avg_tokens_per_call: number;
}

interface ModelStats {
  model: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cache_hits: number;
  avg_duration_ms: number;
}

interface SourceStats {
  source: string;
  calls: number;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  cache_hits: number;
  percent: number;
}

interface DailyTrend {
  day: string;
  calls: number;
  tokens: number;
  cache_hits: number;
}

interface CacheStat {
  cache_hit: number;
  calls: number;
  tokens: number;
}

interface UsageStats {
  overview: UsageOverview;
  byModel: ModelStats[];
  bySource: SourceStats[];
  dailyTrend: DailyTrend[];
  cacheStats: CacheStat[];
}

const SOURCE_LABELS: Record<string, string> = {
  chat: '对话',
  distill: '蒸馏',
  framework: '框架',
  generate: '生成',
  agent: 'Agent',
  preprocess: '预处理',
  mindmap: '思维导图',
  knowledge_map: '知识地图',
};

const SOURCE_COLORS: Record<string, string> = {
  chat: '#3b82f6',
  distill: '#8b5cf6',
  framework: '#06b6d4',
  generate: '#10b981',
  agent: '#f59e0b',
  preprocess: '#6366f1',
  mindmap: '#ec4899',
  knowledge_map: '#14b8a6',
};

function formatNumber(n: number): string {
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n?.toString() || '0';
}

function formatDuration(ms: number): string {
  if (ms >= 60000) return (ms / 60000).toFixed(1) + ' min';
  if (ms >= 1000) return (ms / 1000).toFixed(1) + ' s';
  return Math.round(ms) + ' ms';
}

export default function AIUsageStats() {
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [period, setPeriod] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await fetch(`/api/v1/ai/usage-stats?period=${period}`);
      if (!resp.ok) throw new Error('Failed to fetch');
      const data = await resp.json();
      setStats(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStats(); }, [period]);

  if (loading && !stats) {
    return (
      <div className="flex items-center justify-center h-64" style={{ color: 'var(--color-ks-text-muted)' }}>
        <RefreshCw size={20} className="ks-animate-spin mr-2" />
        <span className="text-sm">加载中...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8" style={{ color: 'var(--color-ks-error)' }}>
        <p className="text-sm">{error}</p>
        <button onClick={fetchStats} className="mt-2 text-xs underline">重试</button>
      </div>
    );
  }

  if (!stats) return null;

  const { overview, byModel, bySource, dailyTrend, cacheStats } = stats;
  const cacheHitTotal = cacheStats.find(c => c.cache_hit === 1)?.tokens || 0;
  const cacheHitRate = overview.total_tokens > 0 ? ((cacheHitTotal / overview.total_tokens) * 100).toFixed(1) : '0';

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold font-[var(--font-family-ks-heading)]" style={{ color: 'var(--color-ks-text)' }}>
          AI 使用统计
        </h2>
        <div className="flex items-center gap-2">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="px-3 py-1.5 text-xs rounded-[var(--radius-ks-md)] outline-none"
            style={{
              backgroundColor: 'var(--color-ks-hover)',
              border: '1px solid var(--color-ks-border)',
              color: 'var(--color-ks-text)',
            }}
          >
            <option value="24h">最近 24 小时</option>
            <option value="7d">最近 7 天</option>
            <option value="30d">最近 30 天</option>
            <option value="all">全部</option>
          </select>
          <button
            onClick={fetchStats}
            className="p-1.5 rounded-[var(--radius-ks-sm)] transition-colors"
            style={{ color: 'var(--color-ks-text-muted)' }}
            title="刷新"
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={<Activity size={16} />} label="总调用" value={formatNumber(overview.total_calls)} color="var(--color-ks-primary)" />
        <StatCard icon={<Database size={16} />} label="总 Token" value={formatNumber(overview.total_tokens)} color="var(--color-ks-success)" />
        <StatCard icon={<Cpu size={16} />} label="缓存命中" value={`${cacheHitRate}%`} color="var(--color-ks-warning)" />
        <StatCard icon={<Clock size={16} />} label="平均耗时" value={formatDuration(overview.avg_duration_ms || 0)} color="var(--color-ks-secondary)" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-[var(--radius-ks-lg)] p-4" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <ArrowUpRight size={14} style={{ color: 'var(--color-ks-primary)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>输入 Token</span>
          </div>
          <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-ks-text)' }}>{formatNumber(overview.total_input_tokens || 0)}</p>
        </div>
        <div className="rounded-[var(--radius-ks-lg)] p-4" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
          <div className="flex items-center gap-2 mb-3">
            <ArrowDownRight size={14} style={{ color: 'var(--color-ks-success)' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--color-ks-text-secondary)' }}>输出 Token</span>
          </div>
          <p className="text-xl font-bold tabular-nums" style={{ color: 'var(--color-ks-text)' }}>{formatNumber(overview.total_output_tokens || 0)}</p>
        </div>
      </div>

      {byModel.length > 0 && (
        <div className="rounded-[var(--radius-ks-lg)] p-4" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-ks-text)' }}>分模型统计</h3>
          <div className="flex flex-col gap-2">
            {byModel.map((m) => (
              <div key={m.model} className="flex items-center gap-3 p-2 rounded-[var(--radius-ks-sm)]" style={{ backgroundColor: 'var(--color-ks-hover)' }}>
                <Zap size={12} style={{ color: 'var(--color-ks-primary)' }} />
                <span className="text-xs font-medium flex-1 truncate" style={{ color: 'var(--color-ks-text)' }}>{m.model}</span>
                <span className="text-xs tabular-nums" style={{ color: 'var(--color-ks-text-secondary)' }}>{m.calls} 次</span>
                <span className="text-xs tabular-nums" style={{ color: 'var(--color-ks-text-secondary)' }}>{formatNumber(m.total_tokens)} tokens</span>
                <span className="text-xs tabular-nums" style={{ color: 'var(--color-ks-text-muted)' }}>{formatDuration(m.avg_duration_ms)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {bySource.length > 0 && (
        <div className="rounded-[var(--radius-ks-lg)] p-4" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-ks-text)' }}>来源分布</h3>
          <div className="flex flex-col gap-2">
            {bySource.map((s) => (
              <div key={s.source} className="flex items-center gap-3">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SOURCE_COLORS[s.source] || 'var(--color-ks-text-muted)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--color-ks-text)' }}>{SOURCE_LABELS[s.source] || s.source}</span>
                </div>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--color-ks-border)' }}>
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.percent}%`, backgroundColor: SOURCE_COLORS[s.source] || 'var(--color-ks-primary)' }}
                  />
                </div>
                <span className="text-xs tabular-nums w-16 text-right" style={{ color: 'var(--color-ks-text-secondary)' }}>{formatNumber(s.total_tokens)}</span>
                <span className="text-xs tabular-nums w-12 text-right" style={{ color: 'var(--color-ks-text-muted)' }}>{s.percent}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {dailyTrend.length > 0 && (
        <div className="rounded-[var(--radius-ks-lg)] p-4" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-ks-text)' }}>每日趋势</h3>
          <div className="flex items-end gap-1 h-24">
            {dailyTrend.map((d) => {
              const maxTokens = Math.max(...dailyTrend.map(x => x.tokens || 1));
              const height = ((d.tokens || 0) / maxTokens) * 100;
              return (
                <div key={d.day} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t"
                    style={{
                      height: `${Math.max(height, 4)}%`,
                      backgroundColor: 'var(--color-ks-primary)',
                      opacity: 0.8,
                    }}
                    title={`${d.day}: ${formatNumber(d.tokens)} tokens`}
                  />
                  <span className="text-[9px] tabular-nums" style={{ color: 'var(--color-ks-text-muted)' }}>
                    {d.day.slice(5)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="rounded-[var(--radius-ks-lg)] p-3" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
      <div className="flex items-center gap-1.5 mb-2" style={{ color }}>
        {icon}
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="text-lg font-bold tabular-nums" style={{ color: 'var(--color-ks-text)' }}>{value}</p>
    </div>
  );
}
