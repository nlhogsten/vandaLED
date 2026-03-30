export interface Tube {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  ledStart: number;
  ledCount: number;
  rotation: number;
}

export const DEFAULT_TUBES: Tube[] = [
  { id: 'tube-1', x: 100, y: 100, width: 400, height: 20, ledStart: 0, ledCount: 50, rotation: 0 },
  { id: 'tube-2', x: 100, y: 200, width: 400, height: 20, ledStart: 50, ledCount: 50, rotation: 0 },
];

export const TUBE_LAYOUT_STORAGE_KEY = 'vandaled-tubes';
export const TUBE_LAYOUT_EVENT = 'vandaled:tubes-changed';

export function loadTubeLayout(): Tube[] {
  try {
    const saved = localStorage.getItem(TUBE_LAYOUT_STORAGE_KEY);
    return saved ? JSON.parse(saved) as Tube[] : DEFAULT_TUBES;
  } catch {
    return DEFAULT_TUBES;
  }
}

export function saveTubeLayout(tubes: Tube[]) {
  localStorage.setItem(TUBE_LAYOUT_STORAGE_KEY, JSON.stringify(tubes));
  window.dispatchEvent(new CustomEvent(TUBE_LAYOUT_EVENT, { detail: tubes }));
}

export function getTubeLayoutLogicalLedCount(tubes: Tube[]): number {
  return tubes.reduce((sum, tube) => sum + Math.max(0, tube.ledCount), 0);
}

export function getTubeLayoutPhysicalLedCount(tubes: Tube[]): number {
  return tubes.reduce((max, tube) => Math.max(max, tube.ledStart + tube.ledCount), 0);
}

export function remapPixelsToTubeLayout(
  logicalPixels: Uint8Array,
  tubes: Tube[],
  fallbackPhysicalLedCount: number
) {
  if (tubes.length === 0) {
    return logicalPixels;
  }

  const physicalLedCount = Math.max(fallbackPhysicalLedCount, getTubeLayoutPhysicalLedCount(tubes));
  const physicalPixels = new Uint8Array(physicalLedCount * 3);
  const ordered = [...tubes].sort((a, b) => a.ledStart - b.ledStart);
  let logicalLedIndex = 0;

  for (const tube of ordered) {
    for (let i = 0; i < tube.ledCount; i++) {
      const src = (logicalLedIndex + i) * 3;
      const dst = (tube.ledStart + i) * 3;
      if (src + 2 >= logicalPixels.length || dst + 2 >= physicalPixels.length) {
        continue;
      }
      physicalPixels[dst] = logicalPixels[src];
      physicalPixels[dst + 1] = logicalPixels[src + 1];
      physicalPixels[dst + 2] = logicalPixels[src + 2];
    }
    logicalLedIndex += tube.ledCount;
  }

  return physicalPixels;
}
