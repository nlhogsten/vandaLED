import { Hono } from 'hono';
import { api } from './routes/api';
import { wled } from './routes/wled';
import { handleWsMessage } from './routes/ws';

const port = parseInt(process.env.PORT || '3000');
const app = new Hono();

app.route('/api', api);
app.route('/wled', wled);

const server = Bun.serve({
  port,
  fetch(req, server) {
    if (server.upgrade(req)) return;
    return app.fetch(req);
  },
  websocket: {
    message(ws, message) {
      handleWsMessage(ws, message);
    },
    open(ws) {
      console.log('Studio connected via WS');
    },
    close(ws, code, message) {
      console.log('Studio disconnected');
    }
  }
});

console.log(`Driver server running on port ${server.port}`);
