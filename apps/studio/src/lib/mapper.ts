import {
  DEFAULT_LAYOUT,
  HardwareLayout,
  LayoutNode,
  createLayoutNode,
  deriveHardwareLayout,
  normalizeHardwareLayout,
  remapPixelsToLayout,
} from '@vandaled/layout-engine';

export type { HardwareLayout, LayoutNode } from '@vandaled/layout-engine';

export const HARDWARE_LAYOUT_STORAGE_KEY = 'vandaled-hardware-layout';
export const HARDWARE_LAYOUT_EVENT = 'vandaled:hardware-layout-changed';

export function loadHardwareLayout(): HardwareLayout {
  try {
    const saved = localStorage.getItem(HARDWARE_LAYOUT_STORAGE_KEY);
    return saved ? normalizeHardwareLayout(JSON.parse(saved)) : DEFAULT_LAYOUT;
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export function saveHardwareLayout(layout: HardwareLayout) {
  const normalized = normalizeHardwareLayout(layout);
  localStorage.setItem(HARDWARE_LAYOUT_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(HARDWARE_LAYOUT_EVENT, { detail: normalized }));
}

export function createHardwareNode(layout: HardwareLayout) {
  const previousNodeId = layout.nodes.at(-1)?.id ?? null;
  return createLayoutNode(layout.nodes.length, previousNodeId);
}

export function updateHardwareNode(layout: HardwareLayout, nodeId: string, updater: (node: LayoutNode) => LayoutNode): HardwareLayout {
  return {
    ...layout,
    version: layout.version + 1,
    nodes: layout.nodes.map((node) => node.id === nodeId ? updater(node) : node),
  };
}

export function removeHardwareNode(layout: HardwareLayout, nodeId: string): HardwareLayout {
  return {
    ...layout,
    version: layout.version + 1,
    nodes: layout.nodes
      .filter((node) => node.id !== nodeId)
      .map((node) => node.inputNodeId === nodeId ? { ...node, inputNodeId: null } : node),
  };
}

export function getDerivedLayout(layout: HardwareLayout) {
  return deriveHardwareLayout(layout);
}

export function remapPixels(logicalPixels: Uint8Array, layout: HardwareLayout, fallbackPhysicalLedCount: number) {
  return remapPixelsToLayout(logicalPixels, layout, fallbackPhysicalLedCount);
}
