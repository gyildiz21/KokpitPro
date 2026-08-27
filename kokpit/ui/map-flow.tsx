import dagre from '@dagrejs/dagre';
import {
    Background,
    BackgroundVariant,
    Handle,
    MarkerType,
    Position,
    ReactFlow,
    ReactFlowProvider,
    type Edge,
    type Node,
    type NodeTypes,
    type NodeProps,
    type ReactFlowInstance,
} from '@xyflow/react';
import React, { memo, useMemo } from 'react';
import { createRoot, type Root } from 'react-dom/client';

type StatusTone = 'done' | 'partial' | 'open' | 'unmeasured';

export interface MapFlowNodeInput {
    id: string;
    label: string;
    path: string;
    status: StatusTone;
    statusLabel: string;
    evidenceLabel: string;
    groupId?: string;
    waitingOnGo?: boolean;
    dimmed?: boolean;
    /** Seçili maddenin ölçülmüş delta etkisi bu düğüme düşüyor. */
    isDeltaHit?: boolean;
    /** Delta önerisi — ayrı tür değil; kesikli kutu + PROPOSED rozeti. */
    proposed?: boolean;
}

export interface MapFlowGroupInput {
    id: string;
    label: string;
}

export interface MapFlowPayload {
    groups: MapFlowGroupInput[];
    nodes: MapFlowNodeInput[];
    edges: Array<{ from: string; to: string; label?: string; style?: 'solid' | 'dashed' }>;
    onSelect: (nodeId: string) => void;
    ariaLabel: string;
    otherGroupLabel: string;
    highlightNodeIds?: string[];
    proposedNodes?: Array<{ id: string; label: string; path: string }>;
    proposalBadgeLabel?: string;
    proposedStatusLabel?: string;
    proposedEvidenceLabel?: string;
}

interface MapNodeData extends Record<string, unknown>, MapFlowNodeInput {
    order: string[];
    onSelect: (nodeId: string) => void;
    badge?: string;
}

type MapNode = Node<MapNodeData, 'kokpit'>;

interface ArchitectureGroupData extends Record<string, unknown> {
    label: string;
    nodeCount: number;
}

type ArchitectureGroupNode = Node<ArchitectureGroupData, 'architectureGroup'>;
type FlowNode = MapNode | ArchitectureGroupNode;

const NODE_WIDTH = 224;
const NODE_HEIGHT = 104;
const COMPONENT_GAP = 54;
// İki geniş mimari bant, masaüstünde kutuları okunur tutarken bütün grafi
// ilk açılışta tek bakışta gösterecek en-boy oranını sağlar.
const LAYOUT_ROW_WIDTH = 3_000;
const GROUP_PADDING = 28;
const GROUP_HEADER_HEIGHT = 54;

function nextNodeId(order: string[], current: string, direction: string): string | null {
    const index = order.indexOf(current);
    if (index < 0) return null;
    const delta = direction === 'ArrowLeft' || direction === 'ArrowUp' ? -1 : 1;
    return order[(index + delta + order.length) % order.length] ?? null;
}

const KokpitNode = memo(function KokpitNode({ id, data, selected }: NodeProps<MapNode>) {
    return (
        <div className="map-flow-node-shell">
            <Handle type="target" position={Position.Left} className="map-flow-handle" isConnectable={false} />
            <button
                type="button"
                className={`nodrag nowheel map-flow-node tone-${data.status}${data.waitingOnGo ? ' is-waiting-go' : ''}${data.dimmed ? ' is-dimmed' : ''}${data.isDeltaHit ? ' is-delta-hit' : ''}${data.proposed ? ' is-proposed' : ''}${selected ? ' is-selected' : ''}`}
                data-map-node-id={id}
                aria-label={`${data.label}. ${data.statusLabel}. ${data.path}`}
                aria-pressed={selected}
                onClick={() => data.onSelect(id)}
                onKeyDown={(event) => {
                    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return;
                    event.preventDefault();
                    const next = nextNodeId(data.order, id, event.key);
                    if (!next) return;
                    document.querySelector<HTMLElement>(`[data-map-node-id="${next}"]`)?.focus();
                }}
            >
                <span className="map-flow-node__topline">
                    <span className="map-flow-node__title">{data.label}</span>
                    {data.waitingOnGo ? <span className="map-flow-node__go">GO</span> : null}
                    {data.proposed && data.badge ? <span className="map-flow-node__badge">{data.badge}</span> : null}
                </span>
                <span className="map-flow-node__path">{data.path}</span>
                <span className="map-flow-node__footer">
                    <span className="map-flow-node__state"><i aria-hidden="true" />{data.statusLabel}</span>
                    <span className="map-flow-node__evidence">{data.evidenceLabel}</span>
                </span>
            </button>
            <Handle type="source" position={Position.Right} className="map-flow-handle" isConnectable={false} />
        </div>
    );
});

const ArchitectureGroup = memo(function ArchitectureGroup({ data }: NodeProps<ArchitectureGroupNode>) {
    return (
        <div className="map-flow-group" aria-label={`${data.label}, ${data.nodeCount}`}>
            <span className="map-flow-group__title">{data.label}</span>
            <span className="map-flow-group__count">{data.nodeCount}</span>
        </div>
    );
});

const nodeTypes: NodeTypes = { kokpit: KokpitNode, architectureGroup: ArchitectureGroup };

function layout(payload: MapFlowPayload): { nodes: FlowNode[]; edges: Edge[] } {
    const nodes: FlowNode[] = [];
    let cursorX = 36;
    let cursorY = 36;
    let rowHeight = 0;

    const knownGroupIds = new Set(payload.groups.map((group) => group.id));
    const partitions = [
        ...payload.groups.map((group) => ({
            ...group,
            nodes: payload.nodes.filter((node) => node.groupId === group.id),
        })),
        {
            id: 'other',
            label: payload.otherGroupLabel,
            nodes: payload.nodes.filter((node) => !node.groupId || !knownGroupIds.has(node.groupId)),
        },
    ].filter((group) => group.nodes.length > 0);

    const order = payload.nodes.map((node) => node.id);
    for (const partition of partitions) {
        const partitionIds = new Set(partition.nodes.map((node) => node.id));
        const graph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
        graph.setGraph({ rankdir: 'LR', ranksep: 76, nodesep: 30, marginx: 12, marginy: 12, acyclicer: 'greedy' });
        for (const node of partition.nodes) graph.setNode(node.id, { width: NODE_WIDTH, height: NODE_HEIGHT });
        for (const edge of payload.edges) {
            if (partitionIds.has(edge.from) && partitionIds.has(edge.to)) graph.setEdge(edge.from, edge.to);
        }
        dagre.layout(graph);
        const points = partition.nodes.map((node) => graph.node(node.id) as { x: number; y: number });
        const minX = Math.min(...points.map((point) => point.x - NODE_WIDTH / 2));
        const minY = Math.min(...points.map((point) => point.y - NODE_HEIGHT / 2));
        const contentWidth = Math.max(NODE_WIDTH, Math.max(...points.map((point) => point.x + NODE_WIDTH / 2)) - minX);
        const contentHeight = Math.max(NODE_HEIGHT, Math.max(...points.map((point) => point.y + NODE_HEIGHT / 2)) - minY);
        const width = contentWidth + GROUP_PADDING * 2;
        const height = contentHeight + GROUP_HEADER_HEIGHT + GROUP_PADDING;
        if (cursorX > 36 && cursorX + width > LAYOUT_ROW_WIDTH) {
            cursorX = 36;
            cursorY += rowHeight + COMPONENT_GAP;
            rowHeight = 0;
        }
        const parentId = `architecture_group_${partition.id}`;
        nodes.push({
            id: parentId,
            type: 'architectureGroup',
            position: { x: cursorX, y: cursorY },
            data: { label: partition.label, nodeCount: partition.nodes.length },
            width,
            height,
            selectable: false,
            draggable: false,
            zIndex: 0,
        });
        partition.nodes.forEach((node, index) => nodes.push({
            id: node.id,
            type: 'kokpit',
            parentId,
            extent: 'parent',
            position: {
                x: points[index]!.x - minX - NODE_WIDTH / 2 + GROUP_PADDING,
                y: points[index]!.y - minY - NODE_HEIGHT / 2 + GROUP_HEADER_HEIGHT,
            },
            data: { ...node, order, onSelect: payload.onSelect },
            width: NODE_WIDTH,
            height: NODE_HEIGHT,
            zIndex: 2,
        }));
        cursorX += width + COMPONENT_GAP;
        rowHeight = Math.max(rowHeight, height);
    }

    const edges: Edge[] = payload.edges.map((edge, index) => ({
        id: `${edge.from}-${edge.to}-${index}`,
        source: edge.from,
        target: edge.to,
        type: 'smoothstep',
        label: edge.label,
        markerEnd: { type: MarkerType.ArrowClosed, color: edge.label ? 'var(--accent)' : 'var(--line-strong)' },
        className: `map-flow-edge${edge.label ? ' is-labeled' : ''}${edge.style === 'dashed' ? ' is-dashed' : ''}`,
        zIndex: 1,
    }));
    return { nodes, edges };
}

function MapCanvas({ payload, onInit }: { payload: MapFlowPayload; onInit: (instance: ReactFlowInstance<FlowNode, Edge>) => void }) {
    const elements = useMemo(() => layout(payload), [payload]);
    return (
        <ReactFlowProvider>
            <ReactFlow<FlowNode, Edge>
                nodes={elements.nodes}
                edges={elements.edges}
                nodeTypes={nodeTypes}
                onInit={onInit}
                fitView
                fitViewOptions={{ padding: 0.12, minZoom: 0.25, maxZoom: 0.9 }}
                minZoom={0.25}
                maxZoom={1.45}
                nodesFocusable={false}
                edgesFocusable={false}
                elevateNodesOnSelect
                aria-label={payload.ariaLabel}
            >
                <Background variant={BackgroundVariant.Dots} gap={22} size={1} />
            </ReactFlow>
        </ReactFlowProvider>
    );
}

// Dilim 3 delta vurgusu: yalnız tüketicinin gönderdiği kimlikler vurgulanır;
// önerilen düğümler ayrı tür DEĞİLDİR — PROPOSED rozetli kesikli kutu olarak
// aynı düğüm listesine eklenir ve kanıtı 'ölçülemedi' tonundadır.
function withDeltaOverlays(payload: MapFlowPayload): MapFlowPayload {
    const hasHighlights = Boolean(payload.highlightNodeIds?.length);
    const hasProposals = Boolean(payload.proposedNodes?.length);
    if (!hasHighlights && !hasProposals) return payload;
    const highlightSet = new Set(payload.highlightNodeIds ?? []);
    const knownIds = new Set(payload.nodes.map((node) => node.id));
    const proposedInputs = (payload.proposedNodes ?? [])
        .filter((candidate) => candidate.id && !knownIds.has(candidate.id))
        .map((candidate) => ({
            id: candidate.id,
            label: candidate.label,
            path: candidate.path,
            status: 'unmeasured' as StatusTone,
            statusLabel: payload.proposedStatusLabel ?? '',
            evidenceLabel: payload.proposedEvidenceLabel ?? '',
            proposed: true,
            badge: payload.proposalBadgeLabel,
        }));
    return {
        ...payload,
        nodes: [
            ...payload.nodes.map((node) => ({ ...node, isDeltaHit: highlightSet.has(node.id) })),
            ...proposedInputs,
        ],
    };
}

let root: Root | null = null;
let instance: ReactFlowInstance<FlowNode, Edge> | null = null;

function mountRoot(): Root {
    const host = document.querySelector<HTMLElement>('#graphNodes');
    if (!host) throw new Error('Kokpit map host #graphNodes was not found.');
    root ??= createRoot(host);
    return root;
}

const api = {
    render(payload: MapFlowPayload) {
        instance = null;
        mountRoot().render(<MapCanvas payload={withDeltaOverlays(payload)} onInit={(next) => { instance = next; }} />);
    },
    clear() {
        instance = null;
        root?.render(null);
    },
    zoomIn() { void instance?.zoomIn({ duration: 180 }); },
    zoomOut() { void instance?.zoomOut({ duration: 180 }); },
    fitView() { void instance?.fitView({ padding: 0.18, duration: 220 }); },
    focusNode(nodeId: string) {
        document.querySelector<HTMLElement>(`[data-map-node-id="${nodeId}"]`)?.focus();
    },
    select(nodeId: string) {
        instance?.setNodes((nodes) => nodes.map((node) => ({ ...node, selected: node.id === nodeId })));
    },
};

declare global {
    interface Window { KokpitMapFlow?: typeof api; }
}

window.KokpitMapFlow = api;
window.dispatchEvent(new CustomEvent('kokpit-map-flow-ready'));
