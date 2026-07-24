import { useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import {
  PanelRightOpen,
  PanelRightClose,
  Bot,
  Network,
} from 'lucide-react';
import { useUIStore } from '@/stores/uiStore';
import { useBookStore } from '@/stores/bookStore';
import AgentPanel from '@/components/agent/AgentPanel';
import KnowledgeMapPanel from '@/components/mindmap/KnowledgeMapPanel';

interface WorkspaceLayoutProps {
  children: ReactNode;
  leftPanel?: ReactNode;
}

const LEFT_COL_WIDTH = 260;
const LEFT_COL_COLLAPSED_WIDTH = 0;
const RIGHT_COL_WIDTH = 380;
const TOP_NAV_HEIGHT = 48;
const STATUS_BAR_HEIGHT = 32;
const BREAKPOINT_RIGHT_PANEL = 1200;
const BREAKPOINT_LEFT_PANEL = 900;
const BREAKPOINT_MOBILE = 640;

function RightPanelToggle({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="fixed flex items-center justify-center cursor-pointer transition-all duration-200 hover:scale-105"
      style={{
        top: TOP_NAV_HEIGHT + 12,
        right: 8,
        width: 32,
        height: 32,
        borderRadius: 'var(--radius-ks-md, 8px)',
        backgroundColor: 'var(--color-ks-card)',
        border: '1px solid var(--color-ks-border)',
        color: 'var(--color-ks-text-muted)',
        zIndex: 35,
        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.08)',
      }}
      aria-label="展开右侧工具面板"
    >
      <PanelRightOpen size={14} />
    </button>
  );
}

function RightPanelHeader({
  activeTab,
  onTabChange,
  onCollapse,
}: {
  activeTab: 'agent' | 'mindmap' | 'knowledge-map';
  onTabChange: (tab: 'agent' | 'mindmap' | 'knowledge-map') => void;
  onCollapse: () => void;
}) {
  const tabs = [
    { key: 'agent' as const, label: 'AI', icon: Bot },
    { key: 'knowledge-map' as const, label: '图谱', icon: Network },
  ];

  return (
    <div
      className="flex items-center gap-1 px-2 shrink-0"
      style={{
        height: 36,
        borderBottom: '1px solid var(--color-ks-border)',
        backgroundColor: 'var(--color-ks-card)',
      }}
    >
      {tabs.map(({ key, label, icon: Icon }) => {
        const isActive = activeTab === key;
        return (
          <button
            key={key}
            onClick={() => onTabChange(key)}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
            style={{
              fontFamily: 'var(--font-family-ks-heading)',
              backgroundColor: isActive ? 'var(--color-ks-hover)' : 'transparent',
              color: isActive ? 'var(--color-ks-primary)' : 'var(--color-ks-text-muted)',
            }}
          >
            <Icon size={12} />
            {label}
          </button>
        );
      })}
      <div className="flex-1" />
      <button
        onClick={onCollapse}
        className="p-1 rounded-md transition-colors cursor-pointer hover:opacity-70"
        style={{ color: 'var(--color-ks-text-muted)' }}
        aria-label="收起右侧面板"
      >
        <PanelRightClose size={13} />
      </button>
    </div>
  );
}

function RightPanelPlaceholder() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-2 px-4 text-center">
      <div className="flex items-center justify-center rounded-full" style={{ width: 40, height: 40, backgroundColor: 'var(--color-ks-hover)' }}>
        <Bot size={18} style={{ color: 'var(--color-ks-text-disabled)' }} />
      </div>
      <p className="text-[11px] leading-relaxed" style={{ color: 'var(--color-ks-text-muted)', fontFamily: 'var(--font-family-ks-heading)' }}>
        选择工具开始使用
      </p>
    </div>
  );
}

function WorkspaceStatusBar() {
  return (
    <footer
      className="flex items-center px-3 shrink-0 select-none"
      style={{
        height: STATUS_BAR_HEIGHT,
        backgroundColor: 'var(--color-ks-card)',
        borderTop: '1px solid var(--color-ks-border)',
        fontFamily: 'var(--font-family-ks-heading)',
        zIndex: 30,
      }}
    >
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <span className="text-[10px] truncate" style={{ color: 'var(--color-ks-text-disabled)' }}>
          知境
        </span>
      </div>
    </footer>
  );
}

export function WorkspaceLayout({
  children,
  leftPanel,
}: WorkspaceLayoutProps) {
  const sidebarCollapsed = useUIStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);
  const rightPanelState = useUIStore((s) => s.rightPanel);
  const setRightPanel = useUIStore((s) => s.setRightPanel);
  const selectedBookId = useBookStore((s) => s.selectedBookId);

  const [windowWidth, setWindowWidth] = useState<number>(
    typeof window !== 'undefined' ? window.innerWidth : 1400,
  );

  useEffect(() => {
    let rafId: number;
    const onResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => setWindowWidth(window.innerWidth));
    };
    window.addEventListener('resize', onResize);
    return () => { window.removeEventListener('resize', onResize); cancelAnimationFrame(rafId); };
  }, []);

  useEffect(() => {
    if (windowWidth < BREAKPOINT_RIGHT_PANEL && rightPanelState !== null) {
      setRightPanel(null);
    }
  }, [windowWidth, rightPanelState, setRightPanel]);

  useEffect(() => {
    if (windowWidth < BREAKPOINT_LEFT_PANEL && !sidebarCollapsed) {
      toggleSidebar();
    }
  }, [windowWidth]);

  const [rightTab, setRightTab] = useState<'agent' | 'mindmap' | 'knowledge-map'>('agent');

  useEffect(() => {
    if (rightPanelState) setRightTab(rightPanelState);
  }, [rightPanelState]);

  const handleRightTabChange = useCallback(
    (tab: 'agent' | 'mindmap' | 'knowledge-map') => {
      setRightTab(tab);
      setRightPanel(tab);
    },
    [setRightPanel],
  );

  const handleCollapseRightPanel = useCallback(() => {
    setRightPanel(null);
  }, [setRightPanel]);

  const isLeftCollapsed = sidebarCollapsed;
  const isRightOpen = rightPanelState !== null;
  const isMobile = windowWidth < BREAKPOINT_MOBILE;

  const leftWidth = isLeftCollapsed ? LEFT_COL_COLLAPSED_WIDTH : LEFT_COL_WIDTH;
  const rightWidth = isRightOpen ? RIGHT_COL_WIDTH : 0;

  return (
    <div
      className="flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{ backgroundColor: 'var(--color-ks-bg)' }}
    >
      <div style={{ height: TOP_NAV_HEIGHT, flexShrink: 0 }} />

      <div className="flex flex-1 min-h-0" style={{ position: 'relative' }}>
        {/* Left Column */}
        {!isMobile && (
          <aside
            className="flex flex-col shrink-0 h-full select-none overflow-hidden"
            style={{
              width: leftWidth,
              backgroundColor: 'var(--color-ks-sidebar)',
              borderRight: isLeftCollapsed ? 'none' : '1px solid var(--color-ks-border)',
              transition: 'width 200ms ease-out',
              zIndex: 40,
            }}
          >
            <div className="flex-1 min-h-0 overflow-hidden">
              {leftPanel}
            </div>
          </aside>
        )}

        {/* Center Column */}
        <main
          className="flex-1 min-w-0 overflow-y-auto"
          style={{ backgroundColor: 'var(--color-ks-bg)' }}
        >
          <div
            className="mx-auto h-full"
            style={{
              padding: isMobile ? '12px 12px' : '16px 24px',
              maxWidth: 1400,
            }}
          >
            {children}
          </div>
        </main>

        {/* Right Column */}
        <aside
          className="flex flex-col shrink-0 h-full overflow-hidden"
          style={{
            width: rightWidth,
            backgroundColor: 'var(--color-ks-card)',
            borderLeft: isRightOpen ? '1px solid var(--color-ks-border)' : 'none',
            transition: 'width 200ms ease-out',
            zIndex: 40,
          }}
        >
          {isRightOpen && (
            <>
              <RightPanelHeader
                activeTab={rightTab}
                onTabChange={handleRightTabChange}
                onCollapse={handleCollapseRightPanel}
              />
              <div className="flex-1 min-h-0 overflow-hidden">
                {rightTab === 'agent' && <AgentPanel isOpen={true} onClose={handleCollapseRightPanel} embedded />}
                {rightTab === 'knowledge-map' && (
                  selectedBookId ? (
                    <KnowledgeMapPanel bookId={selectedBookId} isFullscreen={false} onToggleFullscreen={() => {}} onClose={handleCollapseRightPanel} />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full gap-2" style={{ color: 'var(--color-ks-text-muted)' }}>
                      <Network size={24} style={{ color: 'var(--color-ks-text-disabled)' }} />
                      <p className="text-xs">请先选择一本书</p>
                    </div>
                  )
                )}
                {!rightTab && <RightPanelPlaceholder />}
              </div>
            </>
          )}
        </aside>

        {!isRightOpen && (
          <RightPanelToggle onClick={() => setRightPanel(rightTab)} />
        )}
      </div>

      <WorkspaceStatusBar />
    </div>
  );
}

export default WorkspaceLayout;
