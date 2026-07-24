// ─── 知境（KnowScape）个人中心页面 ───

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  User,
  Pencil,
  BookOpen,
  Eye,
  EyeOff,
  Save,
  ChevronRight,
  Flame,
  CalendarDays,
  TrendingUp,
  CheckCircle2,
  FileText,
  Share2,
  Calendar,
} from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import { useSettingsStore } from '@/stores/settingsStore';

/* ═══════════════════════════════════════════
   Mock data
   ═══════════════════════════════════════════ */

const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日'];

function buildWeekDaysWithCheckins(checkins: string[]) {
  const today = new Date();
  const dayOfWeek = (today.getDay() + 6) % 7;
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - dayOfWeek + i);
    const dateStr = d.toISOString().split('T')[0];
    return {
      date: d,
      label: WEEKDAY_LABELS[i],
      isToday: i === dayOfWeek,
      isChecked: checkins.includes(dateStr),
    };
  });
}

/* ═══════════════════════════════════════════
   ProfilePage Component
   ═══════════════════════════════════════════ */

export default function ProfilePage() {
  const books = useBookStore((s) => s.books);
  const { providers, defaultProviderId, updateProvider, saveSettings } = useSettingsStore();

  const aiModelOptions = providers.length > 0
    ? providers.map(p => ({ value: p.model, label: p.name || p.model }))
    : [{ value: '', label: '未配置提供商' }];

  const [stats, setStats] = useState({ totalBooks: 0, distilledBooks: 0, totalChapters: 0, totalPoints: 0, studyDays: 0, streak: 0 });

  useEffect(() => {
    fetch('/api/v1/user/stats')
      .then(r => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  const [userProfile, setUserProfile] = useState({
    username: '知识探索者',
    bio: '热爱阅读，致力于将知识转化为可复用的思维工具',
    created_at: '',
  });

  useEffect(() => {
    fetch('/api/v1/auth/me')
      .then(r => r.json())
      .then((data) => {
        if (data && data.username) {
          const profile = {
            username: data.username || '知识探索者',
            bio: data.bio || '热爱阅读，致力于将知识转化为可复用的思维工具',
            created_at: data.created_at || '',
          };
          setUserProfile(profile);
          setDisplayName(profile.username);
          setEditNameInput(profile.username);
        }
      })
      .catch(() => {});
  }, []);

  const READING_STATS = [
    { label: '已导入书籍', value: stats.totalBooks, unit: '本', icon: BookOpen, color: 'var(--color-ks-primary)' },
    { label: '已蒸馏书籍', value: stats.distilledBooks, unit: '本', icon: CheckCircle2, color: 'var(--color-ks-success)' },
    { label: '总章节', value: stats.totalChapters, unit: '章', icon: FileText, color: 'var(--color-ks-info)' },
    { label: '知识要点', value: stats.totalPoints, unit: '条', icon: Share2, color: 'var(--color-ks-warning)' },
    { label: '学习天数', value: stats.studyDays, unit: '天', icon: Calendar, color: 'var(--color-ks-error)' },
    { label: '连续签到', value: stats.streak, unit: '天', icon: Flame, color: 'var(--color-ks-warning)' },
  ];

  // ── Inline edit state ──
  const [isEditingName, setIsEditingName] = useState(false);
  const [displayName, setDisplayName] = useState('知识探索者');
  const [editNameInput, setEditNameInput] = useState('知识探索者');

  // ── Check-in state ──
  const [checkedToday, setCheckedToday] = useState(false);
  const [weekDays, setWeekDays] = useState(() => buildWeekDaysWithCheckins([]));

  const handleCheckin = useCallback(async () => {
    try {
      await fetch('/api/v1/checkin', { method: 'POST' });
      setCheckedToday(true);
      fetch('/api/v1/user/stats').then(r => r.json()).then(setStats).catch(() => {});
    } catch {}
  }, []);

  const handleSaveName = () => {
    if (editNameInput.trim()) {
      setDisplayName(editNameInput.trim());
    }
    setIsEditingName(false);
  };

  // ── Settings state ──
  const [theme, setTheme] = useState<'light' | 'dark' | 'sepia'>('light');
  const [fontSize, setFontSize] = useState(15);
  const [showApiKey, setShowApiKey] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  const defaultProvider = useMemo(
    () => providers.find((p: { id: string }) => p.id === defaultProviderId) ?? providers[0],
    [providers, defaultProviderId],
  );
  const apiKey = defaultProvider?.api_key ?? '';

  const handleSaveSettings = useCallback(async () => {
    await saveSettings();
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  }, [saveSettings]);

  // ── Books for shelf (completed or distilling) ──
  const recentBooks = useMemo(
    () =>
      books
        .filter((b) => b.status === 'completed' || b.status === 'distilling')
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .slice(0, 4),
    [books],
  );

  const [checkinStats, setCheckinStats] = useState({ consecutiveDays: 0, monthDays: 0, totalDays: 0 });

  useEffect(() => {
    fetch('/api/v1/user/stats')
      .then(r => r.json())
      .then(d => {
        setCheckinStats({ consecutiveDays: d.streak || 0, monthDays: 0, totalDays: d.study_days || 0 });
        setWeekDays(buildWeekDaysWithCheckins(d.checkin_dates || []));
      })
      .catch(() => {});
  }, [checkedToday]);

  return (
    <div
      className="flex-1 overflow-y-auto"
      style={{ backgroundColor: 'var(--color-ks-bg)' }}
    >
      <div className="max-w-3xl mx-auto px-6 py-8 flex flex-col gap-8">
        {/* ═══ User Info Header ═══ */}
        <section
          className="flex items-start gap-5 p-6 rounded-[var(--radius-ks-lg)]"
          style={{
            backgroundColor: 'var(--color-ks-card)',
            border: '1px solid var(--color-ks-border)',
            boxShadow: '0 1px 3px var(--color-ks-shadow)',
          }}
        >
          {/* Avatar */}
          <div
            className="flex items-center justify-center w-20 h-20 rounded-full shrink-0 text-white"
            style={{
              background: 'linear-gradient(135deg, var(--color-ks-primary) 0%, var(--color-ks-secondary) 100%)',
            }}
          >
            <User size={36} strokeWidth={1.5} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            {/* Name */}
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <input
                  autoFocus
                  type="text"
                  value={editNameInput}
                  onChange={(e) => setEditNameInput(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveName();
                    if (e.key === 'Escape') {
                      setEditNameInput(displayName);
                      setIsEditingName(false);
                    }
                  }}
                  className="text-xl font-semibold px-2 py-0.5 rounded-[var(--radius-ks-sm)] outline-none"
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    color: 'var(--color-ks-text)',
                    backgroundColor: 'var(--color-ks-bg)',
                    border: '2px solid var(--color-ks-primary)',
                  }}
                />
              ) : (
                <h1
                  className="text-xl font-semibold"
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    color: 'var(--color-ks-text)',
                  }}
                >
                  {displayName}
                </h1>
              )}
              <button
                onClick={() => {
                  setEditNameInput(displayName);
                  setIsEditingName(!isEditingName);
                }}
                className="p-1 rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-70"
                style={{ color: 'var(--color-ks-text-muted)' }}
                aria-label="编辑昵称"
              >
                <Pencil size={14} />
              </button>
            </div>

            {/* Bio */}
            <p
              className="text-sm leading-relaxed"
              style={{ color: 'var(--color-ks-text-secondary)' }}
            >
              {userProfile.bio}
            </p>

            {/* Join date */}
            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--color-ks-text-muted)' }}
            >
              <CalendarDays size={12} />
              <span>{formatJoinDate(userProfile.created_at)}</span>
            </div>

            {/* Edit profile button */}
            <div className="mt-1">
              <button
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-80"
                style={{
                  fontFamily: 'var(--font-family-ks-heading)',
                  backgroundColor: 'transparent',
                  color: 'var(--color-ks-primary)',
                  border: '1px solid var(--color-ks-primary)',
                }}
              >
                <Pencil size={12} />
                编辑资料
              </button>
            </div>
          </div>
        </section>

        {/* ═══ Check-in Section (签到打卡) ═══ */}
        <section
          className="p-6 rounded-[var(--radius-ks-lg)]"
          style={{
            backgroundColor: 'var(--color-ks-card)',
            border: '1px solid var(--color-ks-border)',
            boxShadow: '0 1px 3px var(--color-ks-shadow)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-semibold"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'var(--color-ks-text)',
              }}
            >
              <Flame
                size={16}
                className="inline-block mr-1.5 -mt-0.5"
                style={{ color: 'var(--color-ks-accent)' }}
              />
              签到打卡
            </h2>
            <button
              onClick={handleCheckin}
              disabled={checkedToday || (weekDays.find((d) => d.isToday)?.isChecked ?? false)}
              className={[
                  'inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-[var(--radius-ks-sm)] transition-all duration-150',
                  (checkedToday || (weekDays.find((d) => d.isToday)?.isChecked ?? false))
                    ? 'cursor-not-allowed opacity-50'
                    : 'cursor-pointer hover:opacity-90',
                ].join(' ')}
                style={{
                  fontFamily: 'var(--font-family-ks-heading)',
                  backgroundColor: (checkedToday || (weekDays.find((d) => d.isToday)?.isChecked ?? false)) ? 'var(--color-ks-text-disabled)' : 'var(--color-ks-primary)',
                  color: 'white',
                }}
              >
                {(checkedToday || (weekDays.find((d) => d.isToday)?.isChecked ?? false)) ? '今日已签到' : '今日签到'}
            </button>
          </div>

          {/* Week grid */}
          <div
            className="grid grid-cols-7 gap-2 mb-4 p-3 rounded-[var(--radius-ks-md)]"
            style={{ backgroundColor: 'var(--color-ks-bg)' }}
          >
            {weekDays.map((day) => (
              <div key={day.label} className="flex flex-col items-center gap-1.5">
                <span
                  className="text-[11px] font-medium"
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    color: day.isToday ? 'var(--color-ks-primary)' : 'var(--color-ks-text-muted)',
                  }}
                >
                  {day.label}
                </span>
                <div
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all duration-150',
                  ].join(' ')}
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    backgroundColor: day.isChecked
                      ? 'var(--color-ks-success)'
                      : day.isToday
                        ? 'transparent'
                        : 'var(--color-ks-card)',
                    color: day.isChecked ? 'white' : day.isToday ? 'var(--color-ks-primary)' : 'var(--color-ks-text-muted)',
                    border: day.isToday
                      ? '2px solid var(--color-ks-primary)'
                      : day.isChecked
                        ? '2px solid transparent'
                        : '1px solid var(--color-ks-border)',
                    fontWeight: day.isChecked || day.isToday ? 600 : 400,
                  }}
                >
                  {day.date.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-6 flex-wrap">
            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--color-ks-text-secondary)' }}
            >
              <TrendingUp size={13} style={{ color: 'var(--color-ks-accent)' }} />
              <span>
                已连续签到{' '}
                <strong
                  className="font-semibold tabular-nums"
                  style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}
                >
                  {checkinStats.consecutiveDays}
                </strong>{' '}
                天
              </span>
            </div>
            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--color-ks-text-secondary)' }}
            >
              <CalendarDays size={13} style={{ color: 'var(--color-ks-primary)' }} />
              <span>
                本月签到{' '}
                <strong
                  className="font-semibold tabular-nums"
                  style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}
                >
                  {checkinStats.monthDays}
                </strong>{' '}
                天
              </span>
            </div>
            <div
              className="flex items-center gap-1.5 text-xs"
              style={{ color: 'var(--color-ks-text-secondary)' }}
            >
              <Flame size={13} style={{ color: 'var(--color-ks-success)' }} />
              <span>
                累计签到{' '}
                <strong
                  className="font-semibold tabular-nums"
                  style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}
                >
                  {checkinStats.totalDays}
                </strong>{' '}
                天
              </span>
            </div>
          </div>
        </section>

        {/* ═══ Reading Stats ═══ */}
        <section>
          <h2
            className="text-base font-semibold mb-4"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-text)',
            }}
          >
            阅读统计
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {READING_STATS.map((stat) => {
              const Icon = stat.icon;
              return (
                <div
                  key={stat.label}
                  className="flex items-center gap-3 p-4 rounded-[var(--radius-ks-md)] transition-all duration-150"
                  style={{
                    backgroundColor: 'var(--color-ks-card)',
                    border: '1px solid var(--color-ks-border)',
                    boxShadow: '0 1px 2px var(--color-ks-shadow)',
                  }}
                >
                  <div
                    className="flex items-center justify-center w-10 h-10 rounded-[var(--radius-ks-md)] shrink-0"
                    style={{ backgroundColor: stat.color }}
                  >
                    <Icon size={20} style={{ color: 'white' }} />
                  </div>
                  <div className="flex flex-col">
                    <span
                      className="text-lg font-bold leading-tight tabular-nums"
                      style={{
                        fontFamily: 'var(--font-family-ks-heading)',
                        color: 'var(--color-ks-text)',
                      }}
                    >
                      {stat.value} {stat.unit}
                    </span>
                    <span
                      className="text-xs leading-tight mt-0.5"
                      style={{ color: 'var(--color-ks-text-muted)' }}
                    >
                      {stat.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ═══ Bookshelf Section ═══ */}
        <section
          className="p-6 rounded-[var(--radius-ks-lg)]"
          style={{
            backgroundColor: 'var(--color-ks-card)',
            border: '1px solid var(--color-ks-border)',
            boxShadow: '0 1px 3px var(--color-ks-shadow)',
          }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-base font-semibold"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                color: 'var(--color-ks-text)',
              }}
            >
              我的书架
            </h2>
            <Link
              to="/workspace"
              className="inline-flex items-center gap-1 text-xs cursor-pointer transition-opacity duration-150 hover:opacity-70"
              style={{
                color: 'var(--color-ks-primary)',
                fontFamily: 'var(--font-family-ks-heading)',
              }}
            >
              查看全部
              <ChevronRight size={13} />
            </Link>
          </div>

          <div className="flex flex-col gap-2.5">
            {recentBooks.map((book) => {
              const timeAgo = getTimeAgo(book.updatedAt);
              return (
                <div
                  key={book.id}
                  className="flex items-center gap-3 p-3 rounded-[var(--radius-ks-md)] transition-colors duration-100"
                  style={{ backgroundColor: 'var(--color-ks-bg)' }}
                >
                  {/* Color strip */}
                  <div
                    className="w-1.5 h-10 rounded-full shrink-0"
                    style={{ backgroundColor: book.coverColor ?? 'var(--color-ks-primary)' }}
                  />

                  {/* Book info */}
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-medium truncate leading-5"
                      style={{
                        fontFamily: 'var(--font-family-ks-heading)',
                        color: 'var(--color-ks-text)',
                      }}
                    >
                      {book.title}
                    </div>
                    <div
                      className="text-xs truncate leading-4"
                      style={{ color: 'var(--color-ks-text-muted)' }}
                    >
                      {book.author}
                    </div>
                  </div>

                  {/* Last read time */}
                  <span
                    className="text-[11px] shrink-0 tabular-nums"
                    style={{ color: 'var(--color-ks-text-muted)' }}
                  >
                    {timeAgo}
                  </span>

                  {/* Progress */}
                  <div className="flex items-center gap-2 shrink-0">
                    <div
                      className="w-16 h-1.5 rounded-full overflow-hidden"
                      style={{ backgroundColor: 'var(--color-ks-border)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${book.progress.percent}%`,
                          backgroundColor: book.status === 'completed' ? 'var(--color-ks-success)' : 'var(--color-ks-primary)',
                        }}
                      />
                    </div>
                    <span
                      className="text-[11px] font-medium tabular-nums w-8 text-right"
                      style={{
                        fontFamily: 'var(--font-family-ks-heading)',
                        color: 'var(--color-ks-text-secondary)',
                      }}
                    >
                      {book.progress.percent}%
                    </span>
                  </div>
                </div>
              );
            })}

            {recentBooks.length === 0 && (
              <div
                className="text-center py-8 text-sm"
                style={{ color: 'var(--color-ks-text-muted)' }}
              >
                暂无书籍，前往工作区导入
              </div>
            )}
          </div>
        </section>

        {/* ═══ Settings Section (偏好设置) ═══ */}
        <section
          className="p-6 rounded-[var(--radius-ks-lg)]"
          style={{
            backgroundColor: 'var(--color-ks-card)',
            border: '1px solid var(--color-ks-border)',
            boxShadow: '0 1px 3px var(--color-ks-shadow)',
          }}
        >
          <h2
            className="text-base font-semibold mb-5"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              color: 'var(--color-ks-text)',
            }}
          >
            偏好设置
          </h2>

          <div className="flex flex-col">
            {/* ── Theme ── */}
            <SettingRow label="主题切换">
              <div className="flex items-center gap-3">
                {([
                  { value: 'light' as const, label: '极昼' },
                  { value: 'dark' as const, label: '子夜' },
                  { value: 'sepia' as const, label: '纸莎草' },
                ]).map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-center gap-1.5 text-xs cursor-pointer"
                    style={{
                      fontFamily: 'var(--font-family-ks-heading)',
                      color: theme === opt.value ? 'var(--color-ks-text)' : 'var(--color-ks-text-secondary)',
                    }}
                  >
                    <input
                      type="radio"
                      name="theme"
                      value={opt.value}
                      checked={theme === opt.value}
                      onChange={() => setTheme(opt.value)}
                      className="accent-[var(--color-ks-primary)]"
                    />
                    {opt.label}
                  </label>
                ))}
              </div>
            </SettingRow>

            <SettingDivider />

            {/* ── Font Size ── */}
            <SettingRow label="阅读字号">
              <div className="flex items-center gap-3 min-w-[200px]">
                <span
                  className="text-xs tabular-nums"
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    color: 'var(--color-ks-text-muted)',
                  }}
                >
                  {fontSize}px
                </span>
                <input
                  type="range"
                  min={13}
                  max={18}
                  step={1}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, var(--color-ks-primary) 0%, var(--color-ks-primary) ${((fontSize - 13) / 5) * 100}%, var(--color-ks-border) ${((fontSize - 13) / 5) * 100}%, var(--color-ks-border) 100%)`,
                    accentColor: 'var(--color-ks-primary)',
                  }}
                />
              </div>
            </SettingRow>

            <SettingDivider />

            {/* ── AI Model ── */}
            <SettingRow label="AI 模型">
              <select
                value={defaultProvider?.model || ''}
                onChange={(e) => {
                  if (defaultProvider) {
                    updateProvider(defaultProvider.id, { model: e.target.value });
                  }
                }}
                className="h-8 px-3 text-xs rounded-[var(--radius-ks-sm)] outline-none cursor-pointer appearance-none"
                style={{
                  fontFamily: 'var(--font-family-ks-heading)',
                  backgroundColor: 'var(--color-ks-bg)',
                  border: '1px solid var(--color-ks-border)',
                  color: 'var(--color-ks-text)',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23999490' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  paddingRight: '28px',
                }}
              >
                {aiModelOptions.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </SettingRow>

            <SettingDivider />

            {/* ── API Key ── */}
            <SettingRow label="API Key">
              <div className="flex items-center gap-2 min-w-[240px]">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => {
                    if (defaultProvider) {
                      updateProvider(defaultProvider.id, { api_key: e.target.value });
                    }
                  }}
                  className="flex-1 h-8 px-3 text-xs rounded-[var(--radius-ks-sm)] outline-none"
                  style={{
                    fontFamily: 'var(--font-family-ks-heading)',
                    backgroundColor: 'var(--color-ks-bg)',
                    border: '1px solid var(--color-ks-border)',
                    color: 'var(--color-ks-text)',
                  }}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="p-1.5 rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-70 shrink-0"
                  style={{ color: 'var(--color-ks-text-muted)' }}
                  aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
                >
                  {showApiKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </SettingRow>

            <SettingDivider />

            {/* ── Language ── */}
            <SettingRow label="语言">
              <select
                disabled
                className="h-8 px-3 text-xs rounded-[var(--radius-ks-sm)] outline-none cursor-not-allowed opacity-60 appearance-none"
                style={{
                  fontFamily: 'var(--font-family-ks-heading)',
                  backgroundColor: 'var(--color-ks-bg)',
                  border: '1px solid var(--color-ks-border)',
                  color: 'var(--color-ks-text)',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23999490' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 8px center',
                  paddingRight: '28px',
                }}
              >
                <option value="zh">中文</option>
              </select>
            </SettingRow>
          </div>

          {/* Save button */}
          <div
            className="flex items-center justify-end gap-3 mt-6 pt-4"
            style={{ borderTop: '1px solid var(--color-ks-border)' }}
          >
            {settingsSaved && (
              <span
                className="text-xs ks-animate-fade-in"
                style={{ color: 'var(--color-ks-success)' }}
              >
                设置已保存
              </span>
            )}
            <button
              onClick={handleSaveSettings}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-[var(--radius-ks-sm)] cursor-pointer transition-opacity duration-150 hover:opacity-90"
              style={{
                fontFamily: 'var(--font-family-ks-heading)',
                backgroundColor: 'var(--color-ks-primary)',
                color: 'white',
              }}
            >
              <Save size={13} />
              保存设置
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-3 gap-4">
      <span
        className="text-sm shrink-0"
        style={{
          fontFamily: 'var(--font-family-ks-heading)',
          color: 'var(--color-ks-text-secondary)',
        }}
      >
        {label}
      </span>
      <div className="flex items-center">{children}</div>
    </div>
  );
}

function SettingDivider() {
  return (
    <div
      className="w-full"
      style={{ borderTop: '1px solid var(--color-ks-border)' }}
    />
  );
}

/* ═══════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════ */

function formatJoinDate(isoDate: string): string {
  if (!isoDate) return '2026年1月加入';
  const d = new Date(isoDate);
  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  return `${year}年${month}月加入`;
}

function getTimeAgo(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return '刚刚';
  if (diffMin < 60) return `${diffMin} 分钟前`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} 小时前`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} 天前`;
  return `${Math.floor(diffDay / 30)} 月前`;
}
