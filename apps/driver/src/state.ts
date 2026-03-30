export type DriverMode = 'idle' | 'standalone' | 'wled_preset' | 'override_effect' | 'override_audio';
export type DriverTransport = 'emulator' | 'network-wled';

import { DEFAULT_LAYOUT, HardwareLayout } from '@vandaled/layout-engine';

export interface DriverState {
  targetIp: string;
  ddpPort: number;
  ledCount: number;
  activeMode: DriverMode;
  isHardwareConnected: boolean;
  brightness: number;
  transport: DriverTransport;
  lastFrameAt: number | null;
  hardwareLayout: HardwareLayout;
}

export function isEmulatorTarget(ip: string) {
  return ip === '127.0.0.1' || ip === 'localhost';
}

const targetIp = process.env.WLED_IP || '127.0.0.1';

export const state: DriverState = {
  targetIp,
  ddpPort: parseInt(process.env.DDP_PORT || '4048'),
  ledCount: parseInt(process.env.LED_COUNT || '100'),
  activeMode: isEmulatorTarget(targetIp) ? 'idle' : 'standalone',
  isHardwareConnected: false,
  brightness: 255,
  transport: isEmulatorTarget(targetIp) ? 'emulator' : 'network-wled',
  lastFrameAt: null,
  hardwareLayout: DEFAULT_LAYOUT,
};
