import { Hono } from 'hono';
import { state } from '../state';

const wled = new Hono();

wled.all('*', async (c) => {
  // Proxy to WLED JSON API
  const url = `http://${state.targetIp}/json${c.req.path}`;
  try {
    const res = await fetch(url, {
      method: c.req.method,
      headers: c.req.header(),
      body: c.req.method !== 'GET' ? await c.req.raw.clone().blob() : undefined
    });
    return res;
  } catch (err) {
    return c.json({ error: 'Failed to proxy to WLED' }, 502);
  }
});

export { wled };
