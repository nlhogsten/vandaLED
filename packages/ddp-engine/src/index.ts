import { Buffer } from 'node:buffer';

export interface PixelFrame {
  pixels: Uint8Array;   // Flat RGB array: [R0,G0,B0, R1,G1,B1, ...]
  offset: number;       // Starting LED index (default 0)
  timestamp: number;
}

export interface DDPHeader {
  flags: number;
  type: number;
  id: number;
  offset: number;
  dataLength: number;
}

// Pack a PixelFrame into a DDP-compliant UDP Buffer
export function packDDP(frame: PixelFrame): Buffer {
  const headerLen = 10;
  const dataLen = frame.pixels.length;
  const buf = Buffer.alloc(headerLen + dataLen);

  buf.writeUInt8(0x41, 0); // flags
  buf.writeUInt8(0x01, 1); // type
  buf.writeUInt8(0x01, 2); // id
  buf.writeUInt8(0x00, 3); // reserved
  buf.writeUInt32BE(frame.offset, 4); // offset
  buf.writeUInt16BE(dataLen, 8); // data length

  Buffer.from(frame.pixels).copy(buf, 10);

  return buf;
}

// Parse a raw UDP Buffer into a PixelFrame (for the emulator)
export function parseDDP(buf: Buffer): PixelFrame {
  if (buf.length < 10) {
    throw new Error('Buffer too small for DDP header');
  }

  const offset = buf.readUInt32BE(4);
  const dataLen = buf.readUInt16BE(8);
  const pixels = new Uint8Array(buf.subarray(10, 10 + dataLen));

  return {
    pixels,
    offset,
    timestamp: Date.now()
  };
}

// Create a solid-color PixelFrame
export function solidColor(ledCount: number, r: number, g: number, b: number): PixelFrame {
  const pixels = new Uint8Array(ledCount * 3);
  for (let i = 0; i < ledCount; i++) {
    pixels[i * 3] = r;
    pixels[i * 3 + 1] = g;
    pixels[i * 3 + 2] = b;
  }
  return {
    pixels,
    offset: 0,
    timestamp: Date.now()
  };
}

// Create a blank (all-off) PixelFrame
export function blankFrame(ledCount: number): PixelFrame {
  return solidColor(ledCount, 0, 0, 0);
}
