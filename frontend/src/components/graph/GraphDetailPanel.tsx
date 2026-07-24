import { X, ExternalLink } from 'lucide-react';
import type { GraphNodeData, GraphDataset } from '@/types/graph';
import { NODE_TYPE_LABELS } from '@/types/graph';

interface GraphDetailPanelProps {
  node: GraphNodeData | null;
  dataset: GraphDataset;
  onClose: () => void;
  onRelatedClick: (nodeId: string) => void;
}

export function GraphDetailPanel({
  node, dataset, onClose, onRelatedClick,
}: GraphDetailPanelProps) {
  if (!node) {
    return (
      <div className="p-4 text-sm text-slate-400 text-center">
        点击节点查看详情
      </div>
    );
  }

  const relatedEdges = dataset.edges.filter(
    (e) => e.source === node.id || e.target === node.id,
  );

  const relatedNodeIds = new Set<string>();
  relatedEdges.forEach((e) => {
    if (e.source !== node.id) relatedNodeIds.add(e.source as string);
    if (e.target !== node.id) relatedNodeIds.add(e.target as string);
  });

  const relatedNodes = dataset.nodes.filter((n) => relatedNodeIds.has(n.id));

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="font-semibold text-slate-800">{node.label}</h3>
          <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
            {NODE_TYPE_LABELS[node.type] || node.type}
          </span>
        </div>
        <button onClick={onClose} className="p-1 hover:bg-slate-100 rounded">
          <X className="w-4 h-4 text-slate-400" />
        </button>
      </div>

      {node.description && (
        <div>
          <div className="text-xs font-medium text-slate-400 mb-1">描述</div>
          <p className="text-sm text-slate-600 leading-relaxed">{node.description}</p>
        </div>
      )}

      {node.evidence && (
        <div>
          <div className="text-xs font-medium text-slate-400 mb-1">依据</div>
          <p className="text-sm text-slate-600 leading-relaxed bg-yellow-50 p-2 rounded">{node.evidence}</p>
        </div>
      )}

      {node.chapterTitle && (
        <div className="text-xs text-slate-400">
          章节: {node.chapterTitle}
        </div>
      )}

      {relatedNodes.length > 0 && (
        <div>
          <div className="text-xs font-medium text-slate-400 mb-2">
            关联节点 ({relatedNodes.length})
          </div>
          <div className="space-y-1">
            {relatedNodes.map((rn) => {
              const edge = relatedEdges.find(
                (e) => (e.source === rn.id || e.target === rn.id),
              );
              return (
                <button
                  key={rn.id}
                  onClick={() => onRelatedClick(rn.id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-left transition-colors"
                >
                  <ExternalLink className="w-3 h-3 shrink-0 text-slate-400" />
                  <span className="text-sm text-slate-700 truncate">{rn.label}</span>
                  {edge && (
                    <span className="ml-auto text-xs text-slate-400 shrink-0">
                      {edge.type}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
