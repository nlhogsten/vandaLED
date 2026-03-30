import { createSocket } from 'node:dgram';
import { parseDDP } from '@vandaled/ddp-engine';

const udpServer = createSocket('udp4');
const port = 4048;

let wssHandlers: Set<(data: any) => void> = new Set();
let frameCount = 0;

setInterval(() => {
  // broadcast fps
  const fps = frameCount;
  frameCount = 0;
  for (const handler of wssHandlers) {
    handler({ type: 'FPS', fps });
  }
}, 1000);

udpServer.on('message', (msg, rinfo) => {
  try {
    const frame = parseDDP(msg);
    frameCount++;
    for (const handler of wssHandlers) {
      handler({ type: 'FRAME', frame: { pixels: Array.from(frame.pixels), offset: frame.offset } });
    }
  } catch (err) {
    // ignore bad packets
  }
});

udpServer.bind(port, () => {
  console.log(`Emulator UDP listening on ${port}`);
});

Bun.serve({
  port: 4049,
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return new Response('ws server');
  },
  websocket: {
    open(ws) {
      const handler = (data: any) => {
        ws.send(JSON.stringify(data));
      };
      // @ts-ignore
      ws.handler = handler;
      wssHandlers.add(handler);
    },
    close(ws) {
      // @ts-ignore
      if (ws.handler) {
        // @ts-ignore
        wssHandlers.delete(ws.handler);
      }
    },
    message() {}
  }
});
console.log(`Emulator WS listening on 4049`);
