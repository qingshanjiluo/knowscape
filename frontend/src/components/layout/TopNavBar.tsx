// ─── 知境（KnowScape）全局导航栏 ───

import { NavLink, useNavigate, useLocation } from 'react-router-dom';
import {
  BookOpen,
  Search,
  Settings,
  User,
  LogIn,
  LogOut,
  Bot,
  Network,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useAuthStore } from '@/stores/authStore';

const NAV_LINKS = [
  { to: '/', label: '主页' },
  { to: '/workspace', label: '所有书籍', icon: BookOpen },
  { to: '/community', label: '社区' },
  { to: '/profile', label: '个人中心' },
] as const;

export default function TopNavBar() {
  const setSettingsOpen = useUIStore((s) => s.setSettingsOpen);
  const setSearchOpen = useUIStore((s) => s.setSearchOpen);
  const setViewMode = useUIStore((s) => s.setViewMode);
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();

  const isWorkspace = location.pathname.startsWith('/workspace');

  return (
    <nav
      className="flex items-center h-12 px-4 shrink-0 select-none fixed top-0 left-0 right-0 z-50"
      style={{
        backgroundColor: 'var(--color-ks-card)',
        borderBottom: '1px solid var(--color-ks-border)',
        fontFamily: 'var(--font-family-ks-heading)',
      }}
    >
      {/* ── Left: Logo ── */}
      <NavLink
        to="/"
        className="flex items-center gap-2 mr-8 shrink-0 no-underline group"
      >
        <div
          className="flex items-center justify-center w-7 h-7 rounded-lg transition-transform duration-200 group-hover:scale-110"
          style={{ backgroundColor: 'var(--color-ks-primary)' }}
        >
          <BookOpen size={15} style={{ color: 'white' }} strokeWidth={2.2} />
        </div>
        <span
          className="text-[15px] font-bold tracking-tight"
          style={{ color: 'var(--color-ks-text)' }}
        >
          知境
        </span>
      </NavLink>

      {/* ── Center: Navigation links ── */}
      <div className="flex items-center gap-0.5 mx-auto">
        {NAV_LINKS.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            onClick={() => { if (to === '/workspace') setViewMode('library'); }}
            className="relative px-3 py-1.5 text-[13px] font-medium rounded-md transition-all duration-150 no-underline"
            style={({ isActive }) => ({
              color: isActive
                ? 'var(--color-ks-primary)'
                : 'var(--color-ks-text-muted)',
              backgroundColor: isActive
                ? 'var(--color-ks-hover)'
                : 'transparent',
            })}
          >
            {({ isActive }) => (
              <>
                <span className="flex items-center gap-1.5">
                  {label}
                  {to === '/workspace' && isWorkspace && (
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-ks-success)' }}
                    />
                  )}
                </span>
                {isActive && (
                  <span
                    className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] w-5 rounded-full"
                    style={{ backgroundColor: 'var(--color-ks-primary)' }}
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </div>

      {/* ── Right: Actions ── */}
      <div className="flex items-center gap-0.5 ml-8">
        {/* Search — keyboard shortcut hint */}
        <button
          onClick={() => setSearchOpen(true)}
          className="flex items-center gap-1.5 h-8 pl-2.5 pr-3 rounded-lg transition-colors duration-150 cursor-pointer"
          style={{
            color: 'var(--color-ks-text-muted)',
            backgroundColor: 'var(--color-ks-hover)',
            border: '1px solid var(--color-ks-border)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-ks-primary)';
            e.currentTarget.style.color = 'var(--color-ks-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'var(--color-ks-border)';
            e.currentTarget.style.color = 'var(--color-ks-text-muted)';
          }}
          aria-label="搜索"
          title="搜索 (⌘K)"
        >
          <Search size={14} />
          <span className="text-[11px] hidden lg:inline">搜索</span>
          <kbd
            className="hidden lg:inline text-[10px] px-1 py-0 rounded ml-1"
            style={{
              backgroundColor: 'var(--color-ks-card)',
              border: '1px solid var(--color-ks-border)',
              color: 'var(--color-ks-text-disabled)',
              lineHeight: '16px',
            }}
          >
            ⌘K
          </kbd>
        </button>

        {/* Separator */}
        <div
          className="w-px h-4 mx-2"
          style={{ backgroundColor: 'var(--color-ks-border)' }}
        />

        {/* AI + Knowledge Map — grouped as tool toggles */}
        <button
          onClick={() => {
            const { setRightPanel, rightPanel } = useUIStore.getState();
            setRightPanel(rightPanel === 'agent' ? null : 'agent');
          }}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] transition-colors cursor-pointer"
          style={{
            color: 'var(--color-ks-text-muted)',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)';
            e.currentTarget.style.color = 'var(--color-ks-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-ks-text-muted)';
          }}
          title="AI 助手"
        >
          <Bot size={15} />
        </button>

        <button
          onClick={() => {
            const { rightPanel, setRightPanel } = useUIStore.getState();
            setRightPanel(rightPanel === 'knowledge-map' ? null : 'knowledge-map');
          }}
          className="flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12px] transition-colors cursor-pointer"
          style={{
            color: 'var(--color-ks-text-muted)',
            backgroundColor: 'transparent',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)';
            e.currentTarget.style.color = 'var(--color-ks-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-ks-text-muted)';
          }}
          title="知识图谱"
        >
          <Network size={15} />
        </button>

        {/* Settings */}
        <button
          onClick={() => setSettingsOpen(true)}
          className="flex items-center h-8 px-2.5 rounded-lg transition-colors cursor-pointer"
          style={{ color: 'var(--color-ks-text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)';
            e.currentTarget.style.color = 'var(--color-ks-primary)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = 'var(--color-ks-text-muted)';
          }}
          aria-label="设置"
          title="设置"
        >
          <Settings size={15} />
        </button>

        {/* Separator */}
        <div
          className="w-px h-4 mx-1.5"
          style={{ backgroundColor: 'var(--color-ks-border)' }}
        />

        {/* User: logged in -> avatar, not logged in -> login */}
        {user ? (
          <div className="flex items-center gap-1">
            <NavLink
              to="/profile"
              className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 no-underline shrink-0 hover:scale-105"
              style={{
                backgroundColor: 'var(--color-ks-primary)',
                color: 'white',
                fontSize: '13px',
                fontWeight: 600,
                letterSpacing: '-0.02em',
              }}
            >
              {user.username ? user.username.charAt(0).toUpperCase() : <User size={15} strokeWidth={2.2} />}
            </NavLink>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="p-1.5 rounded-md transition-colors duration-150 cursor-pointer opacity-0 group-hover:opacity-100"
              style={{ color: 'var(--color-ks-text-muted)' }}
              aria-label="退出登录"
              title="退出登录"
            >
              <LogOut size={14} />
            </button>
          </div>
        ) : (
          <NavLink
            to="/login"
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium transition-all duration-200 no-underline hover:scale-[1.02]"
            style={{
              backgroundColor: 'var(--color-ks-primary)',
              color: 'white',
            }}
          >
            <LogIn size={13} />
            登录
          </NavLink>
        )}
      </div>
    </nav>
  );
}
