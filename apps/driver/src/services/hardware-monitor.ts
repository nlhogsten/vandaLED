import { broadcastState } from '../routes/ws';
import { isEmulatorTarget, state } from '../state';

const WLED_INFO_PATH = '/json/info';
const PROBE_INTERVAL_MS = 5000;
const OVERRIDE_STALE_MS = 3000;

export function startHardwareMonitor() {
  const tick = async () => {
    let changed = false;

    if (state.transport === 'network-wled' && state.activeMode.startsWith('override_')) {
      const isStale = state.lastFrameAt !== null && Date.now() - state.lastFrameAt > OVERRIDE_STALE_MS;
      if (isStale) {
        state.activeMode = 'standalone';
        changed = true;
      }
    }

    if (isEmulatorTarget(state.targetIp)) {
      if (state.transport !== 'emulator') {
        state.transport = 'emulator';
        changed = true;
      }
      if (state.isHardwareConnected) {
        state.isHardwareConnected = false;
        changed = true;
      }
      if (state.activeMode === 'standalone') {
        state.activeMode = 'idle';
        changed = true;
      }
      if (changed) {
        broadcastState();
      }
      return;
    }

    if (state.transport !== 'network-wled') {
      state.transport = 'network-wled';
      changed = true;
    }

    try {
      const res = await fetch(`http://${state.targetIp}${WLED_INFO_PATH}`, {
        signal: AbortSignal.timeout(2000),
      });

      if (!res.ok) {
        throw new Error(`Probe failed with status ${res.status}`);
      }

      const info = await res.json() as { leds?: { count?: number } };
      if (!state.isHardwareConnected) {
        state.isHardwareConnected = true;
        changed = true;
      }
      const reportedCount = info.leds?.count;
      if (typeof reportedCount === 'number' && reportedCount > 0 && reportedCount !== state.ledCount) {
        state.ledCount = reportedCount;
        changed = true;
      }
    } catch {
      if (state.isHardwareConnected) {
        state.isHardwareConnected = false;
        changed = true;
      }
    }

    if (changed) {
      broadcastState();
    }
  };

  void tick();
  return setInterval(() => {
    void tick();
  }, PROBE_INTERVAL_MS);
}
