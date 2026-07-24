import { useState } from 'react';
import { ChevronRight, ChevronDown, FileText } from 'lucide-react';
import type { FrameworkNodeData } from '@/types/graph';

interface FrameworkTreeProps {
  root: FrameworkNodeData | null;
  onNodeClick?: (node: FrameworkNodeData) => void;
  highlightId?: string | null;
}

function TreeNode({
  node, depth, onNodeClick, highlightId,
}: {
  node: FrameworkNodeData;
  depth: number;
  onNodeClick?: (node: FrameworkNodeData) => void;
  highlightId?: string | null;
}) {
  const [collapsed, setCollapsed] = useState(node.collapsed ?? false);
  const hasChildren = node.children && node.children.length > 0;
  const isHighlighted = highlightId === node.id;

  return (
    <div>
      <button
        onClick={() => {
          if (hasChildren) setCollapsed(!collapsed);
          onNodeClick?.(node);
        }}
        className={`
          w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors rounded-md
          ${isHighlighted ? 'bg-blue-100 text-blue-800' : 'hover:bg-slate-100 text-slate-700'}
        `}
        style={{ paddingLeft: `${16 + depth * 20}px` }}
      >
        {hasChildren ? (
          collapsed ? (
            <ChevronRight className="w-4 h-4 shrink-0 text-slate-400" />
          ) : (
            <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />
          )
        ) : (
          <FileText className="w-4 h-4 shrink-0 text-slate-400" />
        )}
        <span className="text-sm truncate">{node.title}</span>
        {node.chapterIndex !== undefined && (
          <span className="ml-auto text-xs text-slate-400 shrink-0">
            Ch.{node.chapterIndex}
          </span>
        )}
      </button>
      {hasChildren && !collapsed && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onNodeClick={onNodeClick}
              highlightId={highlightId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function FrameworkTree({ root, onNodeClick, highlightId }: FrameworkTreeProps) {
  if (!root) {
    return (
      <div className="flex items-center justify-center h-full text-slate-400">
        暂无框架数据
      </div>
    );
  }

  return (
    <div className="p-2 overflow-auto h-full">
      <TreeNode node={root} depth={0} onNodeClick={onNodeClick} highlightId={highlightId} />
    </div>
  );
}
