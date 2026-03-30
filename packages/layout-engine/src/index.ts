export interface LayoutNode {
  id: string;
  label: string;
  x: number;
  y: number;
  length: number;
  thickness: number;
  rotation: number;
  ledCount: number;
  inputNodeId: string | null;
}

export interface LayoutIssue {
  nodeId: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface DerivedLayoutNode extends LayoutNode {
  logicalStart: number;
  logicalEnd: number;
  physicalStart: number;
  physicalEnd: number;
  outputNodeId: string | null;
  chainId: string;
  connected: boolean;
}

export interface HardwareLayout {
  version: number;
  nodes: LayoutNode[];
}

export interface LayoutLedPoint {
  nodeId: string;
  label: string;
  logicalIndex: number;
  physicalIndex: number;
  localIndex: number;
  x: number;
  y: number;
}

export interface DerivedHardwareLayout {
  layout: HardwareLayout;
  nodes: DerivedLayoutNode[];
  issues: LayoutIssue[];
  logicalLedCount: number;
  physicalLedCount: number;
  ledPoints: LayoutLedPoint[];
}

export const DEFAULT_LAYOUT: HardwareLayout = {
  version: 1,
  nodes: [
    {
      id: 'segment-a',
      label: 'Segment A',
      x: 120,
      y: 160,
      length: 420,
      thickness: 22,
      rotation: 0,
      ledCount: 50,
      inputNodeId: null,
    },
    {
      id: 'segment-b',
      label: 'Segment B',
      x: 120,
      y: 260,
      length: 420,
      thickness: 22,
      rotation: 0,
      ledCount: 50,
      inputNodeId: 'segment-a',
    },
  ],
};

type LegacyTube = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ledCount: number;
  rotation: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asNumber(value: unknown, fallback: number) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function toLayoutNode(raw: unknown, index: number): LayoutNode | null {
  if (!isRecord(raw)) return null;
  const id = asString(raw.id, `segment-${index + 1}`);
  const label = asString(raw.label, `Segment ${index + 1}`);
  const ledCount = Math.max(1, Math.round(asNumber(raw.ledCount, 25)));
  const inputNodeId = typeof raw.inputNodeId === 'string'
    ? raw.inputNodeId
    : raw.inputNodeId === null
      ? null
      : null;

  return {
    id,
    label,
    x: asNumber(raw.x, 120 + index * 40),
    y: asNumber(raw.y, 160 + index * 80),
    length: Math.max(100, asNumber(raw.length, asNumber(raw.width, 420))),
    thickness: Math.max(16, asNumber(raw.thickness, asNumber(raw.height, 22))),
    rotation: asNumber(raw.rotation, 0),
    ledCount,
    inputNodeId,
  };
}

function fromLegacyTube(raw: LegacyTube, index: number): LayoutNode {
  return {
    id: raw.id,
    label: `Segment ${index + 1}`,
    x: raw.x,
    y: raw.y,
    length: Math.max(100, raw.width),
    thickness: Math.max(16, raw.height),
    rotation: raw.rotation,
    ledCount: Math.max(1, raw.ledCount),
    inputNodeId: null,
  };
}

export function normalizeHardwareLayout(raw: unknown): HardwareLayout {
  if (isRecord(raw) && Array.isArray(raw.nodes)) {
    return {
      version: asNumber(raw.version, 1),
      nodes: raw.nodes.map((node, index) => toLayoutNode(node, index)).filter((node): node is LayoutNode => node !== null),
    };
  }

  if (Array.isArray(raw)) {
    const nodes = raw
      .map((item, index) => {
        if (isRecord(item) && 'width' in item && 'height' in item) {
          return fromLegacyTube(item as unknown as LegacyTube, index);
        }
        return toLayoutNode(item, index);
      })
      .filter((node): node is LayoutNode => node !== null);

    return { version: 1, nodes };
  }

  return DEFAULT_LAYOUT;
}

function getNodeCenter(node: LayoutNode) {
  return {
    x: node.x + node.length / 2,
    y: node.y + node.thickness / 2,
  };
}

function buildOutputMap(nodes: LayoutNode[]) {
  const outputByInput = new Map<string, string>();
  const issues: LayoutIssue[] = [];

  for (const node of nodes) {
    if (!node.inputNodeId) continue;
    if (outputByInput.has(node.inputNodeId)) {
      issues.push({
        nodeId: node.id,
        severity: 'error',
        message: 'Only one downstream connection is supported for a real LED data chain.',
      });
      continue;
    }
    outputByInput.set(node.inputNodeId, node.id);
  }

  return { outputByInput, issues };
}

function sortRoots(nodes: LayoutNode[]) {
  return [...nodes].sort((a, b) => (a.y - b.y) || (a.x - b.x) || a.id.localeCompare(b.id));
}

export function deriveHardwareLayout(layout: HardwareLayout): DerivedHardwareLayout {
  const nodes = normalizeHardwareLayout(layout).nodes;
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const issues: LayoutIssue[] = [];
  const { outputByInput, issues: outputIssues } = buildOutputMap(nodes);
  issues.push(...outputIssues);

  for (const node of nodes) {
    if (node.inputNodeId && !nodeMap.has(node.inputNodeId)) {
      issues.push({
        nodeId: node.id,
        severity: 'error',
        message: 'Upstream segment is missing.',
      });
    }
  }

  const roots = sortRoots(nodes.filter((node) => !node.inputNodeId || !nodeMap.has(node.inputNodeId)));
  const visited = new Set<string>();
  const derived: DerivedLayoutNode[] = [];
  let cursor = 0;
  let chainIndex = 0;

  const walkChain = (start: LayoutNode) => {
    let current: LayoutNode | undefined = start;
    const chainVisited = new Set<string>();
    const chainId = `chain-${chainIndex++}`;

    while (current) {
      if (chainVisited.has(current.id)) {
        issues.push({
          nodeId: current.id,
          severity: 'error',
          message: 'Connection cycle detected. LED strips must remain a single forward chain.',
        });
        return;
      }

      chainVisited.add(current.id);
      visited.add(current.id);
      const physicalStart = cursor;
      const physicalEnd = cursor + current.ledCount - 1;
      derived.push({
        ...current,
        logicalStart: physicalStart,
        logicalEnd: physicalEnd,
        physicalStart,
        physicalEnd,
        outputNodeId: outputByInput.get(current.id) ?? null,
        chainId,
        connected: !current.inputNodeId || nodeMap.has(current.inputNodeId),
      });
      cursor += current.ledCount;

      const nextId = outputByInput.get(current.id);
      current = nextId ? nodeMap.get(nextId) : undefined;
    }
  };

  for (const root of roots) {
    if (!visited.has(root.id)) {
      walkChain(root);
    }
  }

  for (const node of sortRoots(nodes)) {
    if (visited.has(node.id)) continue;
    issues.push({
      nodeId: node.id,
      severity: 'warning',
      message: 'Segment is disconnected from the primary chain and will be appended after connected roots.',
    });
    walkChain(node);
  }

  const ledPoints: LayoutLedPoint[] = [];
  for (const node of derived) {
    const radians = (node.rotation * Math.PI) / 180;
    const center = getNodeCenter(node);
    const usable = Math.max(1, node.ledCount);
    for (let i = 0; i < usable; i++) {
      const offset = usable === 1 ? 0 : (i / (usable - 1)) - 0.5;
      const localX = offset * node.length;
      const localY = 0;
      const x = center.x + localX * Math.cos(radians) - localY * Math.sin(radians);
      const y = center.y + localX * Math.sin(radians) + localY * Math.cos(radians);
      ledPoints.push({
        nodeId: node.id,
        label: node.label,
        logicalIndex: node.logicalStart + i,
        physicalIndex: node.physicalStart + i,
        localIndex: i,
        x,
        y,
      });
    }
  }

  return {
    layout: { version: layout.version, nodes },
    nodes: derived,
    issues,
    logicalLedCount: ledPoints.length,
    physicalLedCount: ledPoints.length,
    ledPoints,
  };
}

export function remapPixelsToLayout(logicalPixels: Uint8Array, layout: HardwareLayout, fallbackPhysicalLedCount: number) {
  const derived = deriveHardwareLayout(layout);
  if (derived.nodes.length === 0) {
    return logicalPixels;
  }

  const physicalLedCount = Math.max(fallbackPhysicalLedCount, derived.physicalLedCount);
  const physicalPixels = new Uint8Array(physicalLedCount * 3);

  for (const point of derived.ledPoints) {
    const src = point.logicalIndex * 3;
    const dst = point.physicalIndex * 3;
    if (src + 2 >= logicalPixels.length || dst + 2 >= physicalPixels.length) {
      continue;
    }
    physicalPixels[dst] = logicalPixels[src];
    physicalPixels[dst + 1] = logicalPixels[src + 1];
    physicalPixels[dst + 2] = logicalPixels[src + 2];
  }

  return physicalPixels;
}

export function createLayoutNode(index: number, previousNodeId: string | null = null): LayoutNode {
  return {
    id: `segment-${crypto.randomUUID()}`,
    label: `Segment ${index + 1}`,
    x: 120 + index * 80,
    y: 160 + index * 60,
    length: 360,
    thickness: 22,
    rotation: 0,
    ledCount: 25,
    inputNodeId: previousNodeId,
  };
}
