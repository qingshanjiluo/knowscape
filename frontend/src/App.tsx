// ─── 知境（KnowScape）主应用 ───

import { useEffect, useState, useRef } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { TopNavBar, WorkspaceLayout } from '@/components/layout';
import Sidebar from '@/components/layout/Sidebar';
import BookShelf from '@/components/book/BookShelf';
// import { BookLibrary } from '@/components/book'; // unused — cards now in Sidebar
import { DistillWorkstation } from '@/components/distill';
import { DualReader } from '@/components/reader';
import { ChatPanel } from '@/components/chat';
import { DeepGenPanel } from '@/components/deepgen';
import { GraphWorkstation } from '@/components/graph';
import BookFolderView from '@/components/workspace/BookFolderView';
import BookFrameworkTree from '@/components/workspace/BookFrameworkTree';
import HomePage from '@/pages/HomePage';
import ProfilePage from '@/pages/ProfilePage';
import PlanPage from '@/pages/PlanPage';
import CommunityPage from '@/pages/CommunityPage';
import LoginPage from '@/pages/LoginPage';
import AdminPage from '@/pages/AdminPage';
import { useBookStore } from '@/stores/bookStore';
import { useUIStore } from '@/stores/uiStore';
import { ToastContainer } from '@/components/ui';
import { SettingsPanel } from '@/components/settings';
import { Search, BookOpen, Layers, Sparkles } from 'lucide-react';
import KnowledgeMap from '@/components/mindmap/KnowledgeMap';
import AIUsageStats from '@/components/ai/AIUsageStats';

function SearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
      setQuery('');
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const timer = setTimeout(() => {
      setLoading(true);
      fetch(`/api/v1/global-search?q=${encodeURIComponent(query)}`)
        .then(r => r.json())
        .then(d => { setResults(d.results || []); setLoading(false); })
        .catch(() => { setResults([]); setLoading(false); });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); if (open) onClose(); else onClose(); }
      if (e.key === 'Escape' && open) onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const grouped = results.reduce((acc: Record<string, any[]>, r: any) => {
    const key = r.type || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(r);
    return acc;
  }, {});

  const typeLabels: Record<string, string> = { book: '书籍', chapter: '章节', chapter_content: '章节内容', distilled: '蒸馏知识点' };

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} />
      <div className="relative w-full max-w-lg rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--color-ks-bg)', border: '1px solid var(--color-ks-border)', boxShadow: '0 25px 50px rgba(0,0,0,0.25)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
          <Search size={16} style={{ color: 'var(--color-ks-text-muted)' }} />
          <input ref={inputRef} type="text" placeholder="搜索书籍、章节、知识点..." value={query} onChange={e => setQuery(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none" style={{ color: 'var(--color-ks-text)' }} />
          <kbd className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)' }}>ESC</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-2">
          {loading && <div className="text-center py-4 text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>搜索中...</div>}
          {!loading && query && results.length === 0 && <div className="text-center py-4 text-xs" style={{ color: 'var(--color-ks-text-muted)' }}>未找到结果</div>}
          {!loading && Object.entries(grouped).map(([type, items]) => (
            <div key={type} className="mb-2">
              <div className="px-2 py-1 text-[10px] font-medium" style={{ color: 'var(--color-ks-text-muted)' }}>{typeLabels[type] || type}</div>
              {(items as any[]).slice(0, 5).map((r: any, i: number) => (
                <div key={i} className="px-2 py-1.5 rounded cursor-pointer text-xs" style={{ color: 'var(--color-ks-text-secondary)' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}>
                  <div className="font-medium" style={{ color: 'var(--color-ks-text)' }}>{r.title || r.chapter_title || r.book_title || '未命名'}</div>
                  {r.context && <div className="truncate text-[11px] mt-0.5" style={{ color: 'var(--color-ks-text-muted)' }}>{r.context}</div>}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Workspace layout: Cornell three-column — left=sidebar cards, main=bookshelf simulation */
function WorkspaceSubLayout({ children, showShelf = false }: { children?: React.ReactNode; showShelf?: boolean }) {
  const books = useBookStore((s) => s.books);
  const selectBook = useBookStore((s) => s.selectBook);
  const deleteBook = useBookStore((s) => s.deleteBook);
  const setViewMode = useUIStore((s) => s.setViewMode);

  const leftPanel = showShelf ? (
    <Sidebar />
  ) : (
    <Sidebar />
  );

  return (
    <WorkspaceLayout leftPanel={leftPanel}>
      {showShelf ? (
        <BookShelf
          books={books}
          onSelectBook={(id) => { selectBook(id); setViewMode('distill'); }}
          onDeleteBook={deleteBook}
          onUploadBook={() => {}}
        />
      ) : (
        children
      )}
    </WorkspaceLayout>
  );
}

/** Pages with full-width layout (no sidebar/statusbar): home, community, profile */
function FullWidthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
      {children}
    </div>
  );
}

const VIEW_MODE_ROUTES: Record<string, string> = {
  library: '/workspace',
  distill: '/workspace/distill',
  reader: '/workspace/reader',
  deepgen: '/workspace/deepgen',
  graph: '/workspace/graph',
  folder: '/workspace/folder',
  framework: '/workspace/framework',
  mindmap: '/workspace/mindmap',
};

function ViewModeSync() {
  const { viewMode } = useUIStore();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const route = VIEW_MODE_ROUTES[viewMode];
    if (route && location.pathname !== route && location.pathname.startsWith('/workspace')) {
      navigate(route, { replace: true });
    }
  }, [viewMode, navigate, location.pathname]);

  return null;
}

function OnboardingOverlay() {
  const [show, setShow] = useState(() => !localStorage.getItem('knowscape_onboarded'));
  const [step, setStep] = useState(0);
  const [isClosing, setIsClosing] = useState(false);

  if (!show) return null;

  const steps = [
    {
      icon: <BookOpen size={48} style={{ color: 'var(--color-ks-primary)' }} />,
      title: '欢迎使用知境',
      desc: 'AI 驱动的深度阅读与知识蒸馏工具',
      detail: '将书籍快速拆解、精炼、结构化，通过交互式对话和可视化图谱实现高效学习。',
    },
    {
      icon: <Layers size={48} style={{ color: 'var(--color-ks-success)' }} />,
      title: '三步工作流',
      desc: '导入 → 蒸馏 → 交互学习',
      detail: '上传书籍，AI 自动分章蒸馏生成知识图谱，通过阅读、对话、深度生成三种方式深入学习。',
    },
    {
      icon: <Sparkles size={48} style={{ color: 'var(--color-ks-warning)' }} />,
      title: '开始你的第一次阅读',
      desc: '导入一本书，体验智能阅读',
      detail: '支持 EPUB、PDF、Word、HTML、Markdown、TXT、图片 OCR 等多种格式。',
    },
  ];

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      localStorage.setItem('knowscape_onboarded', 'true');
      setShow(false);
    }, 300);
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{
        backgroundColor: 'rgba(0,0,0,0.6)',
        opacity: isClosing ? 0 : 1,
        transition: 'opacity 0.3s',
      }}
    >
      <div
        className="w-full max-w-md rounded-2xl p-8 text-center"
        style={{
          backgroundColor: 'var(--color-ks-card)',
          border: '1px solid var(--color-ks-border)',
          boxShadow: '0 25px 50px rgba(0,0,0,0.25)',
          transform: isClosing ? 'scale(0.95)' : 'scale(1)',
          transition: 'transform 0.3s',
        }}
      >
        <div className="mb-4">{steps[step].icon}</div>
        <h2 className="text-lg font-bold mb-2" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
          {steps[step].title}
        </h2>
        <p className="text-sm font-medium mb-2" style={{ color: 'var(--color-ks-primary)' }}>
          {steps[step].desc}
        </p>
        <p className="text-xs mb-6" style={{ color: 'var(--color-ks-text-muted)' }}>
          {steps[step].detail}
        </p>

        <div className="flex items-center justify-center gap-1.5 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all"
              style={{
                backgroundColor: i === step ? 'var(--color-ks-primary)' : 'var(--color-ks-border)',
                width: i === step ? 16 : 6,
              }}
            />
          ))}
        </div>

        <div className="flex gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep(step - 1)}
              className="flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors"
              style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)', border: '1px solid var(--color-ks-border)' }}
            >
              上一步
            </button>
          )}
          <button
            onClick={() => step < steps.length - 1 ? setStep(step + 1) : handleClose()}
            className="flex-1 py-2.5 rounded-lg text-sm font-medium text-white transition-colors"
            style={{ backgroundColor: 'var(--color-ks-primary)' }}
          >
            {step < steps.length - 1 ? '下一步' : '开始使用'}
          </button>
        </div>

        <button
          onClick={handleClose}
          className="mt-3 text-[10px] cursor-pointer"
          style={{ color: 'var(--color-ks-text-disabled)' }}
        >
          跳过引导
        </button>
      </div>
    </div>
  );
}

function AppShell() {
  const { loadBooks } = useBookStore();
  const { chatOpen } = useUIStore();
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    loadBooks();
  }, [loadBooks]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  return (
    <>
      <ViewModeSync />
      <div className="flex flex-col h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
        <TopNavBar />
        <div className="flex-1 min-h-0 flex flex-col">
          <Routes>
            <Route path="/" element={<FullWidthLayout><HomePage /></FullWidthLayout>} />
            <Route path="/workspace" element={<WorkspaceSubLayout showShelf />} />
            <Route path="/workspace/distill" element={<WorkspaceSubLayout><DistillWorkstation /></WorkspaceSubLayout>} />
            <Route path="/workspace/reader" element={<WorkspaceSubLayout><DualReader /></WorkspaceSubLayout>} />
            <Route path="/workspace/deepgen" element={<WorkspaceSubLayout><DeepGenPanel /></WorkspaceSubLayout>} />
            <Route path="/workspace/graph" element={<WorkspaceSubLayout><GraphWorkstation /></WorkspaceSubLayout>} />
            <Route path="/workspace/folder" element={<WorkspaceSubLayout><BookFolderView /></WorkspaceSubLayout>} />
            <Route path="/workspace/framework" element={<WorkspaceSubLayout><BookFrameworkTree /></WorkspaceSubLayout>} />
            <Route path="/workspace/mindmap" element={<WorkspaceSubLayout><KnowledgeMap /></WorkspaceSubLayout>} />
            <Route path="/workspace/ai-stats" element={<WorkspaceSubLayout><AIUsageStats /></WorkspaceSubLayout>} />
            <Route path="/community" element={<FullWidthLayout><CommunityPage /></FullWidthLayout>} />
            <Route path="/profile" element={<FullWidthLayout><ProfilePage /></FullWidthLayout>} />
            <Route path="/plan" element={<FullWidthLayout><PlanPage /></FullWidthLayout>} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/admin" element={<FullWidthLayout><AdminPage /></FullWidthLayout>} />
          </Routes>
        </div>
        {chatOpen && <ChatPanel />}
        <SettingsPanel />
        <ToastContainer />
        <OnboardingOverlay />
      </div>
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}

export default App;
