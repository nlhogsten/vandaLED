export interface DriverState {
  targetIp: string;
  ddpPort: number;
  ledCount: number;
  activeMode: 'stream' | 'audio' | 'preset' | 'idle';
  isHardwareConnected: boolean;
  brightness: number;
}

export const state: DriverState = {
  targetIp: process.env.WLED_IP || '127.0.0.1',
  ddpPort: parseInt(process.env.DDP_PORT || '4048'),
  ledCount: parseInt(process.env.LED_COUNT || '100'),
  activeMode: 'idle',
  isHardwareConnected: false,
  brightness: 255
};
