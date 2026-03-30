import { createSocket, Socket } from 'node:dgram';
import { packDDP, PixelFrame } from '@vandaled/ddp-engine';
import { state } from '../state';

class DdpDispatcher {
  private socket: Socket;

  constructor() {
    this.socket = createSocket('udp4');
  }

  send(frame: PixelFrame) {
    const buf = packDDP(frame);
    this.socket.send(buf, state.ddpPort, state.targetIp, (err) => {
      if (err) console.error('Error sending DDP packet', err);
    });
  }
}

export const dispatcher = new DdpDispatcher();
