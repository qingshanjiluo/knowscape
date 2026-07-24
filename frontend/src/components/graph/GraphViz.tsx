import { useRef, useEffect, useCallback, useState } from 'react';
import * as d3 from 'd3';
import type { GraphDataset, GraphNodeData, NodeType } from '@/types/graph';
import { NODE_TYPE_COLORS } from '@/types/graph';

interface GraphVizProps {
  data: GraphDataset;
  onNodeClick?: (node: GraphNodeData) => void;
  onNodeHover?: (node: GraphNodeData | null) => void;
  highlightCategory?: string | null;
  searchQuery?: string;
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string;
  label: string;
  type: NodeType;
  group: string;
  importance: number;
  chapterTitle?: string;
  description?: string;
  evidence?: string;
  color: string;
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  id: string;
  type: string;
  label?: string;
}

export function GraphViz({
  data, onNodeClick, onNodeHover,
  highlightCategory, searchQuery,
}: GraphVizProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [dim, setDim] = useState({ width: 800, height: 600 });

  const resizeObserver = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      for (const e of entries) {
        setDim({ width: e.contentRect.width, height: e.contentRect.height });
      }
    });
    ro.observe(el);
    resizeObserver.current = ro;
    return () => ro.disconnect();
  }, []);

  const draw = useCallback(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const { width, height } = dim;
    if (width === 0 || height === 0 || !data.nodes.length) return;

    const g = svg.append('g');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    svg.call(zoom.transform, d3.zoomIdentity.translate(width / 2, height / 2));

    // Build simulation nodes
    const nodes: SimNode[] = data.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      group: n.group,
      importance: n.importance ?? 1,
      chapterTitle: n.chapterTitle,
      description: n.description,
      evidence: n.evidence,
      color: n.color || NODE_TYPE_COLORS[n.type] || '#6b7280',
      x: width / 2 + (Math.random() - 0.5) * width * 0.5,
      y: height / 2 + (Math.random() - 0.5) * height * 0.5,
    }));

    const nodeMap = new Map(nodes.map((n) => [n.id, n]));

    const links: SimLink[] = data.edges
      .filter((e) => nodeMap.has(e.source as string) && nodeMap.has(e.target as string))
      .map((e) => ({
        id: e.id,
        source: e.source as string,
        target: e.target as string,
        type: e.type,
        label: e.label,
      }));

    // Arrow marker
    defs(svg);

    // Links
    const linkG = g.append('g').attr('class', 'links');
    const link = linkG
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-width', 1)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', 'url(#arrow)');

    // Link labels
    const linkLabelG = g.append('g').attr('class', 'link-labels');
    const linkLabel = linkLabelG
      .selectAll('text')
      .data(links.filter((l) => l.label))
      .join('text')
      .text((d) => d.label || '')
      .attr('font-size', 10)
      .attr('fill', '#64748b')
      .attr('text-anchor', 'middle')
      .attr('dy', -4);

    // Nodes
    const nodeG = g.append('g').attr('class', 'nodes');

    const nodeGroup = nodeG
      .selectAll('g')
      .data(nodes)
      .join('g')
      .attr('cursor', 'pointer')
      .call(
        d3.drag<SVGGElement, SimNode>()
          .on('start', (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any,
      );

    nodeGroup
      .append('circle')
      .attr('r', (d) => 6 + d.importance * 4)
      .attr('fill', (d) => d.color)
      .attr('stroke', '#fff')
      .attr('stroke-width', 2)
      .attr('opacity', (d) => {
        if (searchQuery && !d.label.toLowerCase().includes(searchQuery.toLowerCase())) return 0.15;
        if (highlightCategory && d.type !== highlightCategory) return 0.2;
        return 0.9;
      });

    nodeGroup
      .append('text')
      .text((d) => d.label.length > 12 ? d.label.slice(0, 12) + '…' : d.label)
      .attr('dx', (d) => 10 + d.importance * 4)
      .attr('dy', 4)
      .attr('font-size', (d) => 11 + d.importance * 2)
      .attr('fill', '#1e293b')
      .attr('pointer-events', 'none');

    nodeGroup
      .on('click', (_event, d) => {
        const original = data.nodes.find((n) => n.id === d.id);
        if (original) onNodeClick?.(original);
      })
      .on('mouseenter', (_event, d) => {
        const original = data.nodes.find((n) => n.id === d.id);
        onNodeHover?.(original || null);
        nodeGroup.select('circle').attr('opacity', (n) =>
          n.id === d.id ? 1 : 0.3
        );
      })
      .on('mouseleave', () => {
        onNodeHover?.(null);
        nodeGroup.select('circle').attr('opacity', (d) => {
          if (searchQuery && !d.label.toLowerCase().includes(searchQuery.toLowerCase())) return 0.15;
          if (highlightCategory && d.type !== highlightCategory) return 0.2;
          return 0.9;
        });
      });

    // Simulation
    const simulation = d3.forceSimulation<SimNode>(nodes)
      .force('link', d3.forceLink<SimNode, SimLink>(links)
        .id((d) => d.id)
        .distance(100)
        .strength(0.3))
      .force('charge', d3.forceManyBody().strength(-200))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide<SimNode>().radius((d) => 20 + d.importance * 5))
      .on('tick', () => {
        link
          .attr('x1', (d) => (d.source as SimNode).x!)
          .attr('y1', (d) => (d.source as SimNode).y!)
          .attr('x2', (d) => (d.target as SimNode).x!)
          .attr('y2', (d) => (d.target as SimNode).y!);

        linkLabel
          .attr('x', (d) => {
            const s = d.source as SimNode;
            const t = d.target as SimNode;
            return (s.x! + t.x!) / 2;
          })
          .attr('y', (d) => {
            const s = d.source as SimNode;
            const t = d.target as SimNode;
            return (s.y! + t.y!) / 2;
          });

        nodeGroup.attr('transform', (d) => `translate(${d.x},${d.y})`);
      });

    return () => {
      simulation.stop();
    };
  }, [data, dim, highlightCategory, searchQuery, onNodeClick, onNodeHover]);

  useEffect(() => {
    const cleanup = draw();
    return () => cleanup?.();
  }, [draw]);

  return (
    <div ref={containerRef} className="w-full h-full overflow-hidden bg-gradient-to-br from-slate-50 to-blue-50 rounded-lg relative">
      <svg ref={svgRef} width={dim.width} height={dim.height} className="w-full h-full" />
      {data.nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-slate-400">
          暂无图谱数据
        </div>
      )}
    </div>
  );
}

function defs(svg: d3.Selection<SVGSVGElement, unknown, null, undefined>) {
  const def = svg.append('defs');
  def.append('marker')
    .attr('id', 'arrow')
    .attr('viewBox', '0 -5 10 10')
    .attr('refX', 20)
    .attr('refY', 0)
    .attr('markerWidth', 6)
    .attr('markerHeight', 6)
    .attr('orient', 'auto')
    .append('path')
    .attr('d', 'M0,-5L10,0L0,5')
    .attr('fill', '#94a3b8');
}
