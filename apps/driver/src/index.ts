import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { api } from './routes/api';
import { wled } from './routes/wled';
import { handleWsMessage, addClient, removeClient } from './routes/ws';

const port = parseInt(process.env.PORT || '3000');
const app = new Hono();

// Enable CORS for Studio dev server
app.use('*', cors());

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
      addClient(ws);
      console.log('Studio connected via WS');
    },
    close(ws, code, message) {
      removeClient(ws);
      console.log('Studio disconnected');
    }
  }
});

console.log(`vandaLED driver running on port ${server.port}`);
