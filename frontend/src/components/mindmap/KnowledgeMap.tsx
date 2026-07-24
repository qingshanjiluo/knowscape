import { useState, useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Send, Loader2, Save, Download, History, RotateCcw, Sparkles, GitBranch, Network, LayoutGrid, AlignLeft, Minus, X, Clock, Eye, MessageSquare, Zap } from 'lucide-react';
import { useBookStore } from '@/stores/bookStore';
import ReactMarkdown from 'react-markdown';

interface MapNode {
  id: string;
  label: string;
  type: string;
  depth: number;
  children: string[];
  style: { color: string; size: number; icon: string };
  metadata?: Record<string, any>;
}

interface MapEdge {
  source: string;
  target: string;
  type: string;
  style?: { width?: number; color?: string };
}

interface MapData {
  id: string;
  nodes: MapNode[];
  edges: MapEdge[];
  styles: { colorMap?: Record<string, string>; layout: string };
  version: number;
}

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  actions?: any[];
}

const LAYOUTS: { key: string; label: string; icon: typeof Network }[] = [
  { key: 'mindmap', label: '思维导图', icon: Network },
  { key: 'tree', label: '树形图', icon: GitBranch },
  { key: 'force', label: '力导向', icon: LayoutGrid },
  { key: 'outline', label: '大纲', icon: AlignLeft },
  { key: 'compact', label: '紧凑', icon: Minus },
];

const COLORS = ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4'];

const EXPORT_FORMATS = [
  { key: 'json', label: 'JSON' },
  { key: 'markdown', label: 'Markdown' },
  { key: 'html', label: 'HTML' },
  { key: 'svg', label: 'SVG' },
  { key: 'opml', label: 'OPML' },
  { key: 'freemind', label: 'FreeMind' },
];

export default function KnowledgeMap() {
  const selectedBookId = useBookStore((s) => s.selectedBookId);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [layout, setLayout] = useState('mindmap');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, _setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState<MapNode | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [versions, setVersions] = useState<any[]>([]);
  const [showExport, setShowExport] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodeCount, setNodeCount] = useState(0);

  useEffect(() => {
    if (selectedBookId) loadMap();
  }, [selectedBookId]);

  useEffect(() => {
    if (mapData && svgRef.current) renderChart();
  }, [mapData, layout, searchQuery]);

  useEffect(() => {
    const handleResize = () => { if (mapData && svgRef.current) renderChart(); };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [mapData]);

  async function loadMap() {
    if (!selectedBookId) return;
    setLoading(true);
    try {
      const resp = await fetch(`/api/v1/knowledge-map?book_id=${selectedBookId}`);
      const data = await resp.json();
      if (data.nodes) {
        setMapData(data);
        setLayout(data.styles?.layout || 'mindmap');
        setNodeCount(data.nodes.length);
      }
    } catch {}
    setLoading(false);
  }

  async function handleChatSend() {
    if (!chatInput.trim() || chatLoading || !selectedBookId) return;
    const userMsg: ChatMessage = { role: 'user', content: chatInput };
    setChatMessages(prev => [...prev, userMsg]);
    const instruction = chatInput;
    setChatInput('');
    setChatLoading(true);
    try {
      const resp = await fetch('/api/v1/knowledge-map/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId, instruction }),
      });
      const data = await resp.json();
      if (data.map_data) {
        setMapData({ ...data.map_data, id: data.id || mapData?.id || '', version: data.version || mapData?.version || 1 });
        setNodeCount(data.map_data.nodes?.length || 0);
      }
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.message || '已处理', actions: data.actions || [] }]);
    } catch {
      setChatMessages(prev => [...prev, { role: 'assistant', content: '请求失败' }]);
    }
    setChatLoading(false);
  }

  async function handleSave() {
    if (!mapData || !selectedBookId) return;
    setSaving(true);
    try {
      const resp = await fetch('/api/v1/knowledge-map/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId, nodes: mapData.nodes, edges: mapData.edges, styles: mapData.styles, layout }),
      });
      const data = await resp.json();
      if (data.version) setMapData(prev => prev ? { ...prev, version: data.version } : prev);
    } catch {}
    setSaving(false);
  }

  async function handleGenerate(newLayout?: string) {
    if (!selectedBookId) return;
    setLoading(true);
    try {
      const resp = await fetch('/api/v1/knowledge-map/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId, layout: newLayout || layout }),
      });
      const data = await resp.json();
      if (data.nodes) {
        setMapData({ id: data.id, nodes: data.nodes, edges: data.edges, styles: data.styles, version: data.version });
        setLayout(data.layout || 'mindmap');
        setNodeCount(data.nodes.length);
      }
    } catch {}
    setLoading(false);
  }

  async function loadHistory() {
    if (!selectedBookId) return;
    try {
      const resp = await fetch(`/api/v1/knowledge-map/history?book_id=${selectedBookId}`);
      const data = await resp.json();
      setVersions(data.versions || []);
      setShowHistory(true);
    } catch {}
  }

  async function handleRollback(versionId: string) {
    if (!selectedBookId) return;
    try {
      const resp = await fetch('/api/v1/knowledge-map/rollback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ book_id: selectedBookId, version_id: versionId }),
      });
      const data = await resp.json();
      if (data.nodes) {
        setMapData({ id: mapData?.id || '', nodes: data.nodes, edges: data.edges, styles: data.styles, version: data.version });
        setNodeCount(data.nodes.length);
      }
      setShowHistory(false);
    } catch {}
  }

  function handleExport(format: string) {
    if (!selectedBookId) return;
    const url = `/api/v1/mindmap/export?book_id=${selectedBookId}&format=${format}&style=${layout}`;
    if (format === 'html' || format === 'svg') { window.open(url, '_blank'); setShowExport(false); return; }
    fetch(url).then(r => r.blob()).then(blob => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `knowledge_map.${format === 'freemind' ? 'mm' : format}`;
      a.click();
    });
    setShowExport(false);
  }

  function renderChart() {
    if (!svgRef.current || !mapData) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    const container = containerRef.current;
    if (!container) return;
    const width = container.clientWidth;
    const height = container.clientHeight;
    svg.attr('width', width).attr('height', height);
    const g = svg.append('g');
    const zoom = d3.zoom<SVGSVGElement, unknown>().scaleExtent([0.1, 4]).on('zoom', (e) => g.attr('transform', e.transform));
    svg.call(zoom);

    if (layout === 'force') renderForce(g, width, height);
    else if (layout === 'outline' || layout === 'compact') renderOutline(g, width, height);
    else renderMindmap(g, width, height);
  }

  function buildHierarchy(): any {
    if (!mapData) return null;
    const nodeMap = new Map(mapData.nodes.map(n => [n.id, n]));
    const childMap = new Map<string, string[]>();
    for (const e of mapData.edges) {
      if (e.type === 'hierarchy') {
        if (!childMap.has(e.source)) childMap.set(e.source, []);
        childMap.get(e.source)!.push(e.target);
      }
    }
    function build(id: string, visited = new Set<string>()): any {
      if (visited.has(id)) return null;
      visited.add(id);
      const node = nodeMap.get(id);
      if (!node) return null;
      const kids = (childMap.get(id) || []).map(cid => build(cid, visited)).filter(Boolean);
      return { name: node.label, id: node.id, type: node.type, depth: node.depth, color: node.style?.color || COLORS[node.depth % COLORS.length], summary: node.metadata?.summary || '', children: kids.length > 0 ? kids : undefined };
    }
    const root = mapData.nodes.find(n => n.type === 'root') || mapData.nodes[0];
    return root ? build(root.id) : null;
  }

  function renderMindmap(g: d3.Selection<SVGGElement, unknown, null, undefined>, width: number, height: number) {
    const hierarchy = buildHierarchy();
    if (!hierarchy) return;
    const root = d3.hierarchy(hierarchy);
    const treeLayout = d3.tree<any>().size([2 * Math.PI, Math.min(width, height) / 2 - 80]);
    treeLayout(root);
    g.attr('transform', `translate(${width / 2},${height / 2})`);

    g.selectAll('path.link').data(root.links()).join('path').attr('class', 'link')
      .attr('d', d3.linkRadial<any, any>().angle((d: any) => d.x).radius((d: any) => d.y))
      .attr('fill', 'none').attr('stroke', '#e2e8f0').attr('stroke-width', 1);

    const nodes = g.selectAll('g.node').data(root.descendants()).join('g').attr('class', 'node')
      .attr('transform', (d: any) => `rotate(${d.x * 180 / Math.PI - 90}) translate(${d.y},0)`);

    nodes.append('circle').attr('r', (d: any) => d.data.depth === 0 ? 10 : d.children ? 6 : 4)
      .attr('fill', (d: any) => d.data.color).attr('stroke', '#fff').attr('stroke-width', 2)
      .style('cursor', 'pointer')
      .on('click', (_: any, d: any) => setSelectedNode(d.data));

    nodes.filter((d: any) => d.data.depth <= 2 || d.children)
      .append('text').attr('dy', '0.31em')
      .attr('x', (d: any) => d.x < Math.PI === !d.children ? 10 : -10)
      .attr('text-anchor', (d: any) => d.x < Math.PI === !d.children ? 'start' : 'end')
      .attr('transform', (d: any) => d.x >= Math.PI ? 'rotate(180)' : null)
      .text((d: any) => d.data.name.length > 18 ? d.data.name.substring(0, 18) + '...' : d.data.name)
      .attr('font-size', (d: any) => d.data.depth === 0 ? 14 : d.data.depth === 1 ? 11 : 9)
      .attr('fill', '#374151').style('cursor', 'pointer')
      .on('click', (_: any, d: any) => setSelectedNode(d.data));
  }

  function renderForce(g: d3.Selection<SVGGElement, unknown, null, undefined>, width: number, height: number) {
    const nodeMap = new Map(mapData!.nodes.map(n => [n.id, n]));
    const nodes = mapData!.nodes.map(n => ({ ...n, x: width / 2, y: height / 2 }));
    const links = mapData!.edges.filter(e => nodeMap.has(e.source) && nodeMap.has(e.target)).map(e => ({ source: e.source, target: e.target }));

    const sim = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any).id((d: any) => d.id).distance(80))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40));

    const link = g.selectAll('line').data(links).join('line').attr('stroke', '#e2e8f0').attr('stroke-width', 1);
    const node = g.selectAll('circle').data(nodes).join('circle')
      .attr('r', (d: any) => d.depth === 0 ? 12 : d.depth === 1 ? 7 : 4)
      .attr('fill', (d: any) => d.style?.color || COLORS[d.depth % COLORS.length])
      .attr('stroke', '#fff').attr('stroke-width', 1.5).style('cursor', 'pointer')
      .on('click', (_: any, d: any) => setSelectedNode(d))
      .call(d3.drag<any, any>()
        .on('start', (e: any, d: any) => { if (!e.active) sim.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on('drag', (e: any, d: any) => { d.fx = e.x; d.fy = e.y; })
        .on('end', (e: any, d: any) => { if (!e.active) sim.alphaTarget(0); d.fx = null; d.fy = null; }));

    const label = g.selectAll('text').data(nodes.filter((n: any) => n.depth <= 2)).join('text')
      .text((d: any) => d.label.length > 12 ? d.label.substring(0, 12) + '...' : d.label)
      .attr('font-size', 9).attr('fill', '#6b7280').attr('dx', 8).attr('dy', 3);

    sim.on('tick', () => {
      link.attr('x1', (d: any) => d.source.x).attr('y1', (d: any) => d.source.y).attr('x2', (d: any) => d.target.x).attr('y2', (d: any) => d.target.y);
      node.attr('cx', (d: any) => d.x).attr('cy', (d: any) => d.y);
      label.attr('x', (d: any) => d.x).attr('y', (d: any) => d.y);
    });
  }

  function renderOutline(g: d3.Selection<SVGGElement, unknown, null, undefined>, width: number, _height: number) {
    const hierarchy = buildHierarchy();
    if (!hierarchy) return;
    const root = d3.hierarchy(hierarchy);
    const isCompact = layout === 'compact';
    const nodeHeight = isCompact ? 16 : 22;
    const totalHeight = root.descendants().length * nodeHeight + 40;
    const h = d3.tree<any>().size([totalHeight - 40, width - 200]);
    h(root);
    g.attr('transform', 'translate(80,20)');

    g.selectAll('path').data(root.links()).join('path')
      .attr('d', d3.linkHorizontal<any, any>().x((d: any) => d.y).y((d: any) => d.x))
      .attr('fill', 'none').attr('stroke', '#cbd5e1').attr('stroke-width', 1);

    const nodes = g.selectAll('g').data(root.descendants()).join('g').attr('transform', (d: any) => `translate(${d.y},${d.x})`);
    nodes.append('circle').attr('r', (d: any) => d.data.depth === 0 ? 5 : 3)
      .attr('fill', (d: any) => d.data.color).attr('stroke', '#fff');
    nodes.append('text').attr('dy', '0.35em').attr('x', 10).attr('text-anchor', 'start')
      .text((d: any) => d.data.name.length > 30 ? d.data.name.substring(0, 30) + '...' : d.data.name)
      .attr('font-size', isCompact ? 9 : 11).attr('fill', '#374151').style('cursor', 'pointer')
      .on('click', (_: any, d: any) => setSelectedNode(d.data));
  }

  return (
    <div className="flex h-full" style={{ backgroundColor: 'var(--color-ks-bg)' }}>
      <div className="w-80 shrink-0 flex flex-col" style={{ borderRight: '1px solid var(--color-ks-border)' }}>
        <div className="flex items-center gap-2 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
          <MessageSquare size={14} style={{ color: 'var(--color-ks-primary)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--color-ks-text)' }}>AI 对话驱动</span>
          <span className="text-[10px] px-1 py-0.5 rounded ml-auto" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)' }}>
            {nodeCount} 节点
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {chatMessages.length === 0 && (
            <div className="text-center py-8 space-y-2" style={{ color: 'var(--color-ks-text-muted)' }}>
              <Sparkles size={24} className="mx-auto" style={{ color: 'var(--color-ks-primary)' }} />
              <p className="text-[10px]">通过自然语言指令编辑知识地图</p>
              <div className="space-y-1 text-[9px]" style={{ color: 'var(--color-ks-text-disabled)' }}>
                <p>"生成全书知识地图"</p>
                <p>"把第三章移到第二章前面"</p>
                <p>"增加一个关于习惯养成的分支"</p>
                <p>"把案例节点改为金色"</p>
                <p>"改成时间轴布局"</p>
              </div>
            </div>
          )}
          {chatMessages.map((msg, i) => (
            <div key={i} className={`text-[11px] px-2.5 py-2 rounded-lg leading-relaxed ${msg.role === 'user' ? 'ml-6' : 'mr-4'}`}
              style={{ backgroundColor: msg.role === 'user' ? 'var(--color-ks-primary)' : 'var(--color-ks-hover)', color: msg.role === 'user' ? 'white' : 'var(--color-ks-text)', border: msg.role === 'user' ? 'none' : '1px solid var(--color-ks-border)' }}>
              {msg.role === 'assistant' ? <ReactMarkdown>{String(msg.content || '')}</ReactMarkdown> : msg.content}
              {msg.actions && msg.actions.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-1">
                  {msg.actions.map((a: any, j: number) => (
                    <span key={j} className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: 'var(--color-ks-bg)', color: 'var(--color-ks-primary)' }}>
                      <Zap size={8} className="inline" /> {a.action}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
          {chatLoading && (
            <div className="flex items-center gap-1.5 text-[10px] px-2 py-1.5 rounded-lg" style={{ color: 'var(--color-ks-text-muted)', backgroundColor: 'var(--color-ks-hover)' }}>
              <Loader2 size={10} className="animate-spin" /> 思考中...
            </div>
          )}
        </div>

        <div className="p-2 shrink-0" style={{ borderTop: '1px solid var(--color-ks-border)' }}>
          <div className="flex gap-1.5">
            <input type="text" value={chatInput} onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleChatSend(); } }}
              placeholder="输入指令修改地图..."
              className="flex-1 text-[11px] px-2.5 py-2 rounded-lg outline-none"
              style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text)', border: '1px solid var(--color-ks-border)' }}
              disabled={chatLoading} />
            <button onClick={handleChatSend} disabled={!chatInput.trim() || chatLoading}
              className="px-3 py-2 rounded-lg text-white cursor-pointer disabled:opacity-40"
              style={{ backgroundColor: 'var(--color-ks-primary)' }}>
              <Send size={12} />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="flex items-center gap-1.5 px-3 py-1.5 shrink-0" style={{ borderBottom: '1px solid var(--color-ks-border)' }}>
          <span className="text-xs font-semibold" style={{ color: 'var(--color-ks-text)' }}>知识地图</span>
          <span className="text-[10px] px-1 rounded" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-text-muted)' }}>
            v{mapData?.version || 1}
          </span>

          <div className="flex items-center gap-0.5 ml-3">
            {LAYOUTS.map(l => {
              const Icon = l.icon;
              return (
                <button key={l.key} onClick={() => { setLayout(l.key); }}
                  className="flex items-center gap-1 px-1.5 py-1 rounded text-[10px] cursor-pointer"
                  style={{ backgroundColor: layout === l.key ? 'var(--color-ks-primary)' : 'transparent', color: layout === l.key ? 'white' : 'var(--color-ks-text-muted)', border: `1px solid ${layout === l.key ? 'var(--color-ks-primary)' : 'transparent'}` }}
                  title={l.label}>
                  <Icon size={10} /><span className="hidden lg:inline">{l.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-0.5 ml-auto">
            <button onClick={() => handleGenerate()} disabled={loading} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-primary)' }} title="重新生成">
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            </button>
            <button onClick={handleSave} disabled={saving} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-primary)' }} title="保存">
              <Save size={12} />
            </button>
            <button onClick={loadHistory} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }} title="版本历史">
              <History size={12} />
            </button>
            <div className="relative">
              <button onClick={() => setShowExport(!showExport)} className="p-1.5 rounded cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }} title="导出">
                <Download size={12} />
              </button>
              {showExport && (
                <div className="absolute top-full right-0 mt-1 p-1 rounded-lg shadow-lg z-20" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }}>
                  {EXPORT_FORMATS.map(f => (
                    <button key={f.key} onClick={() => handleExport(f.key)} className="block w-full text-left px-3 py-1 text-[10px] rounded cursor-pointer hover:opacity-80" style={{ color: 'var(--color-ks-text-secondary)' }}>
                      {f.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 relative overflow-hidden">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center z-10" style={{ backgroundColor: 'rgba(255,255,255,0.8)' }}>
              <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-ks-primary)' }} />
            </div>
          )}
          <svg ref={svgRef} className="w-full h-full" />
          {!mapData && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2" style={{ color: 'var(--color-ks-text-muted)' }}>
              <Network size={32} style={{ color: 'var(--color-ks-text-disabled)' }} />
              <p className="text-xs">请先选择书籍</p>
              <button onClick={() => handleGenerate()} className="text-[10px] px-3 py-1.5 rounded-lg cursor-pointer" style={{ backgroundColor: 'var(--color-ks-primary)', color: 'white' }}>
                生成知识地图
              </button>
            </div>
          )}
        </div>
      </div>

      {selectedNode && (
        <div className="w-56 shrink-0 overflow-y-auto p-3" style={{ borderLeft: '1px solid var(--color-ks-border)', backgroundColor: 'var(--color-ks-card)' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-semibold" style={{ color: 'var(--color-ks-text)' }}>节点详情</span>
            <button onClick={() => setSelectedNode(null)} className="cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}><X size={10} /></button>
          </div>
          <div className="flex items-center gap-1.5 mb-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedNode.style?.color || '#5470c6' }} />
            <span className="text-[11px] font-medium" style={{ color: 'var(--color-ks-text)' }}>{selectedNode.label}</span>
          </div>
          <div className="text-[10px] mb-1" style={{ color: 'var(--color-ks-text-muted)' }}>类型: {selectedNode.type} | 深度: {selectedNode.depth}</div>
          {selectedNode.metadata?.summary && (
            <div className="text-[10px] leading-relaxed mt-2" style={{ color: 'var(--color-ks-text-secondary)' }}>
              <ReactMarkdown>{String(selectedNode.metadata.summary)}</ReactMarkdown>
            </div>
          )}
          {selectedNode.metadata?.evidence && (
            <div className="text-[9px] mt-1 italic" style={{ color: 'var(--color-ks-text-disabled)' }}>
              {selectedNode.metadata.evidence}
            </div>
          )}
          <button onClick={() => {
            const chIdx = selectedNode.metadata?.chapter_idx;
            if (chIdx !== undefined && selectedBookId) {
              import('@/stores/bookStore').then(({ useBookStore }) => {
                useBookStore.getState().loadChapter(selectedBookId, chIdx);
                import('@/stores/uiStore').then(({ useUIStore }) => {
                  useUIStore.getState().setViewMode('reader');
                });
              });
            }
          }} className="mt-2 text-[10px] px-2 py-1 rounded cursor-pointer w-full" style={{ backgroundColor: 'var(--color-ks-hover)', color: 'var(--color-ks-primary)', border: '1px solid var(--color-ks-border)' }}>
            <Eye size={10} className="inline mr-1" />查看原文
          </button>
        </div>
      )}

      {showHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(0,0,0,0.3)' }} onClick={() => setShowHistory(false)}>
          <div className="w-80 rounded-xl p-4 shadow-xl" style={{ backgroundColor: 'var(--color-ks-card)', border: '1px solid var(--color-ks-border)' }} onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold" style={{ color: 'var(--color-ks-text)' }}>版本历史</span>
              <button onClick={() => setShowHistory(false)} className="cursor-pointer" style={{ color: 'var(--color-ks-text-muted)' }}><X size={14} /></button>
            </div>
            <div className="space-y-1 max-h-60 overflow-y-auto">
              {versions.map((v, i) => (
                <div key={v.id} className="flex items-center gap-2 px-2 py-1.5 rounded text-[11px] cursor-pointer hover:opacity-80"
                  style={{ backgroundColor: i === 0 ? 'var(--color-ks-hover)' : 'transparent', color: 'var(--color-ks-text-secondary)' }}
                  onClick={() => { if (i > 0) handleRollback(v.id); }}>
                  <Clock size={10} />
                  <span className="flex-1">v{v.version} {v.label || ''}</span>
                  {i > 0 && <span className="text-[9px]" style={{ color: 'var(--color-ks-primary)' }}>回滚</span>}
                </div>
              ))}
              {versions.length === 0 && <p className="text-[10px] text-center" style={{ color: 'var(--color-ks-text-disabled)' }}>暂无历史版本</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
