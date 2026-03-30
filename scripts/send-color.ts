import { packDDP, solidColor } from '../packages/ddp-engine/src';
import { createSocket } from 'node:dgram';

const args = Bun.argv;
let color = '#000000';
let ip = '127.0.0.1';
let count = 100;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--color') color = args[i + 1] || '#000000';
  if (args[i] === '--ip') ip = args[i + 1] || '127.0.0.1';
  if (args[i] === '--count') count = parseInt(args[i + 1] || '100');
}

const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 0, b: 0 };
};

const rgb = hexToRgb(color);
const frame = solidColor(count, rgb.r, rgb.g, rgb.b);
const buf = packDDP(frame);

const client = createSocket('udp4');
client.send(buf, 4048, ip, (err) => {
  if (err) console.error(err);
  else console.log(`Sent solid color ${color} to ${ip} (${count} LEDs)`);
  client.close();
});
