import { Hono } from 'hono';

const api = new Hono();

api.get('/health', (c) => c.json({ status: 'ok' }));
api.post('/mode', async (c) => {
  const { mode } = await c.req.json();
  // TODO: Update driver mode
  return c.json({ mode });
});

export { api };
