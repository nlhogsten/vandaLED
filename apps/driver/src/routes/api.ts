import { Hono } from 'hono';
import { state, DriverMode } from '../state';

const VALID_MODES: DriverMode[] = ['idle', 'standalone', 'wled_preset', 'override_effect', 'override_audio'];

const api = new Hono();

api.get('/health', (c) => c.json({ status: 'ok', timestamp: Date.now() }));

api.get('/state', (c) => c.json(state));

api.post('/mode', async (c) => {
  const { mode } = await c.req.json();
  if (VALID_MODES.includes(mode)) {
    state.activeMode = mode;
    return c.json({ mode: state.activeMode });
  }
  return c.json({ error: 'Invalid mode' }, 400);
});

api.post('/brightness', async (c) => {
  const { brightness } = await c.req.json();
  if (typeof brightness === 'number' && brightness >= 0 && brightness <= 255) {
    state.brightness = brightness;
    return c.json({ brightness: state.brightness });
  }
  return c.json({ error: 'Invalid brightness' }, 400);
});

export { api };
