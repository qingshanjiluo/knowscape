import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Sparkles, FileText, Network, Folder, BarChart3 } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/workspace', label: '图书馆', icon: BookOpen },
  { path: '/workspace/distill', label: '蒸馏', icon: Sparkles },
  { path: '/workspace/reader', label: '阅读', icon: FileText },
  { path: '/workspace/graph', label: '图谱', icon: Network },
  { path: '/workspace/folder', label: '文件夹', icon: Folder },
  { path: '/workspace/framework', label: '框架图', icon: BarChart3 },
  { path: '/workspace/mindmap', label: '知识地图', icon: Network },
];

export default function WorkspaceHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div
      className="flex items-center gap-1 px-3 py-2 shrink-0"
      style={{
        borderBottom: '1px solid var(--color-ks-border)',
        backgroundColor: 'var(--color-ks-card)',
      }}
    >
      {NAV_ITEMS.map(({ path, label, icon: Icon }) => {
        const isActive = location.pathname === path;
        return (
          <button
            key={path}
            onClick={() => navigate(path)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer"
            style={{
              color: isActive ? 'white' : 'var(--color-ks-text-secondary)',
              backgroundColor: isActive ? 'var(--color-ks-primary)' : 'transparent',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.backgroundColor = 'var(--color-ks-hover)';
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <Icon size={14} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
