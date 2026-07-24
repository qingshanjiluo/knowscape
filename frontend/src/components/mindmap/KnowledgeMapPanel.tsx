import { useState, useEffect, useRef } from 'react';
import { Network, Maximize2, Minimize2, Loader2, Send, X, Sparkles, RefreshCw } from 'lucide-react';
import * as d3 from 'd3';

interface MapNode {
  id: string;
  label: string;
  type: 'knowledge_point' | 'concept' | 'chapter' | 'relation';
  depth: number;
  children: string[];
  style: { color: string; size: number; icon: string };
  metadata?: { chapter?: string; evidence?: string; category?: string };
  x?: number;
  y?: number;
}

interface MapEdge {
  source: string;
  target: string;
  type: 'dependency' | 'supports' | 'contradicts' | 'elaborates' | 'example';
  strength: number;
}

interface MapData {
  id: string;
  nodes: MapNode[];
  edges: MapEdge[];
  styles: { colorMap?: Record<string, string>; layout: string };
  version: number;
}

interface Props {
  bookId: string;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose?: () => void;
}

const NODE_COLORS: Record<string, string> = {
  knowledge_point: '#5470c6',
  concept: '#91cc75',
  chapter: '#fac858',
  relation: '#ee6666',
};

const EDGE_COLORS: Record<string, string> = {
  dependency: '#5470c6',
  supports: '#91cc75',
  contradicts: '#ee6666',
  elaborates: '#73c0de',
  example: '#fc8452',
};

export default function KnowledgeMapPanel({ bookId, isFullscreen, onToggleFullscreen, onClose }: Props) {
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (bookId) loadMap();
  }, [bookId]);

  useEffect(() => {
    if (mapData && svgRef.current) renderChart();
  }, [mapData, collapsedNodes]);

  useEffect(() => {
    const handleResize = () => { if (mapData && svgRef.current) renderChart(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapData]);

  async function loadMap() {
    setLoading(true);
    try {
      const resp = await fetch(`/api/v1/knowledge-map?book_id=${bookId}`);
      const data = await resp.json();
      if (data.nodes) setMapData(data);
    } catch {}
    setLoading(false);
  }

  async function handleGenerate() {
    setGenerating(true);
    try {
      const resp = await fetch('/api/v1/knowledge-map/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId }),
      });
      const data = await resp.json();
      if (data.map_data) setMapData(data.map_data);
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || '图谱已生成' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '生成失败' }]);
    }
    setGenerating(false);
  }

  async function handleChatSend() {
    if (!chatInput.trim() || chatLoading) return;
    const msg = chatInput;
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: msg }]);
    setChatLoading(true);
    try {
      const resp = await fetch('/api/v1/knowledge-map/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: bookId, instruction: msg }),
      });
      const data = await resp.json();
      if (data.map_data) setMapData(data.map_data);
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || '已处理' }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '请求失败' }]);
    }
    setChatLoading(false);
  }

  function toggleCollapse(nodeId: string) {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  }

  function renderChart() {
    const svg = d3.select(svgRef.current!);
    svg.selectAll('*').remove();
    if (!mapData || !svgRef.current) return;

    const width = svgRef.current.clientWidth || 600;
    const height = svgRef.current.clientHeight || 400;
    svg.attr('width', width).attr('height', height);

    const defs = svg.append('defs');
    Object.entries(EDGE_COLORS).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 20)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-5L10,0L0,5')
        .attr('fill', color);
    });

    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.3, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    svg.call(zoom);

    const visibleNodeIds = new Set<string>();
    mapData.nodes.forEach(n => {
      if (!collapsedNodes.has(n.id)) {
        visibleNodeIds.add(n.id);
      }
    });

    const nodes = mapData.nodes.filter(n => visibleNodeIds.has(n.id)).map(d => ({ ...d }));
    const links = mapData.edges
      .filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
      .map(d => ({ ...d, source: d.source, target: d.target }));

    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const validLinks = links.filter(l => nodeMap.has(l.source as string) && nodeMap.has(l.target as string));

    const sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(validLinks as any).id((d: any) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    const link = g.append('g').selectAll('path')
      .data(validLinks).enter().append('path')
      .attr('fill', 'none')
      .attr('stroke', (d: any) => EDGE_COLORS[d.type] || '#999')
      .attr('stroke-width', (d: any) => Math.max(1, d.strength * 2))
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', (d: any) => `url(#arrow-${d.type})`);

    const node = g.append('g').selectAll('g')
      .data(nodes).enter().append('g')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (e, d) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e, d) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e, d) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; })
      );

    node.append('circle')
      .attr('r', (d) => d.type === 'knowledge_point' ? 10 : 7)
      .attr('fill', (d) => NODE_COLORS[d.type] || '#999')
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    node.append('text')
      .text((d) => d.label.length > 15 ? d.label.substring(0, 15) + '...' : d.label)
      .attr('dx', 14)
      .attr('dy', 4)
      .attr('font-size', '10px')
      .attr('fill', 'var(--color-ks-text-secondary)');

    node.on('click', (e, d) => {
      e.stopPropagation();
      setSelectedNode(d);
      node.selectAll('circle').attr('stroke', '#fff').attr('stroke-width', 2);
      d3.select(e.currentTarget).select('circle').attr('stroke', 'var(--color-ks-primary)').attr('stroke-width', 3);
    });

    node.on('dblclick', (e, d) => {
      e.stopPropagation();
      if (d.children && d.children.length > 0) {
        toggleCollapse(d.id);
      }
    });

    sim.on('tick', () => {
      link.attr('d', (d: any) => {
        const dx = d.target.x - d.source.x;
        const dy = d.target.y - d.source.y;
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5;
        return `M${d.source.x},${d.source.y}A${dr},${dr} 0 0,1 ${d.target.x},${d.target.y}`;
      });
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
      <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
        <Network size={14} style={{ color: 'var(--color-ks-primary)' }} />
        <span className="text-xs font-semibold" style={{ color: 'var(--color-ks-text)', fontFamily: 'var(--font-family-ks-heading)' }}>
          知识图谱
        </span>
        {mapData && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)' }}>
            {mapData.nodes.length} 节点 · {mapData.edges.length} 关系
          </span>
        )}
        <div className="ml-auto flex items-center gap-1">
          <button onClick={handleGenerate} disabled={generating} className="p-1 rounded cursor-pointer hover:opacity-80 disabled:opacity-50" style={{ color: 'var(--color-ks-primary)' }} title="重新生成">
            {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          </button>
          <button onClick={onToggleFullscreen} className="p-1 rounded cursor-pointer hover:opacity-80" style={{ color: 'var(--color-ks-text-muted)' }}>
            {isFullscreen ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded cursor-pointer hover:opacity-80" style={{ color: 'var(--color-ks-text-muted)' }}>
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0">
        <div ref={containerRef} className="flex-1 relative">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 size={20} className="animate-spin" style={{ color: 'var(--color-ks-text-muted)' }} />
            </div>
          ) : mapData && mapData.nodes.length > 0 ? (
            <svg ref={svgRef} className="w-full h-full" />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3" style={{ color: 'var(--color-ks-text-muted)' }}>
              <Network size={32} style={{ color: 'var(--color-ks-text-disabled)' }} />
              <p className="text-xs">暂无知识图谱数据</p>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs cursor-pointer disabled:opacity-50"
                style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}
              >
                {generating ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                {generating ? '生成中...' : 'Agent 生成图谱'}
              </button>
            </div>
          )}
        </div>

        {selectedNode && (
          <div className="w-48 flex flex-col shrink-0 p-2" style={{ borderLeft: '1px solid var(--color-ks-border)' }}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--color-ks-text)' }}>节点详情</span>
              <button onClick={() => setSelectedNode(null)} className="p-0.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}>
                <X size={10} />
              </button>
            </div>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--color-ks-text)' }}>{selectedNode.label}</div>
            <div className="text-[10px] mb-1" style={{ color: 'var(--color-ks-text-muted)' }}>类型: {selectedNode.type}</div>
            {selectedNode.metadata?.chapter && (
              <div className="text-[10px] mb-1" style={{ color: 'var(--color-ks-text-muted)' }}>章节: {selectedNode.metadata.chapter}</div>
            )}
            {selectedNode.metadata?.category && (
              <div className="text-[10px] mb-1" style={{ color: 'var(--color-ks-text-muted)' }}>分类: {selectedNode.metadata.category}</div>
            )}
            {selectedNode.metadata?.evidence && (
              <div className="text-[10px] mt-2 p-1.5 rounded" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-secondary)' }}>
                {selectedNode.metadata.evidence}
              </div>
            )}
          </div>
        )}

        <div className="w-52 flex flex-col shrink-0" style={{ borderLeft: '1px solid var(--color-ks-border)' }}>
          <div className="flex-1 overflow-y-auto p-2">
            {chatMessages.map((msg, i) => (
              <div key={i} className="mb-2">
                <div
                  className="px-2 py-1.5 rounded-lg text-[11px] leading-relaxed"
                  style={{
                    backgroundColor: msg.role === 'user' ? 'var(--color-ks-primary)' : 'var(--color-ks-card)',
                    color: msg.role === 'user' ? 'white' : 'var(--color-ks-text-secondary)',
                    border: msg.role === 'assistant' ? '1px solid var(--color-ks-border)' : 'none',
                  }}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="px-2 py-1.5 rounded-lg" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
                <Loader2 size={12} className="animate-spin" style={{ color: 'var(--color-ks-text-muted)' }} />
              </div>
            )}
          </div>
          <div className="p-2 shrink-0" style={{ borderTop: '1px solid var(--color-ks-border)' }}>
            <div className="flex gap-1">
              <input
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !chatLoading) handleChatSend(); }}
                placeholder="修改图谱..."
                className="flex-1 text-[11px] px-2 py-1.5 rounded outline-none"
                style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
                disabled={chatLoading}
              />
              <button onClick={handleChatSend} disabled={chatLoading} className="p-1.5 rounded cursor-pointer disabled:opacity-50" style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}>
                <Send size={10} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
