import { type ReactNode } from 'react';
import TopBar from './TopBar';
import Sidebar from './Sidebar';
import StatusBar from './StatusBar';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
      {/* Top bar - fixed 48px */}
      <TopBar />

      {/* Middle: Sidebar + Main content */}
      <div className="flex flex-1 min-h-0">
        <Sidebar />

        {/* Main content area */}
        <main className="flex-1 min-w-0 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Status bar - fixed 36px */}
      <StatusBar />
    </div>
  );
}
