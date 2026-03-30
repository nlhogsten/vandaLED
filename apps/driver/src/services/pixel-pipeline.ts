import { dispatcher } from './ddp-dispatcher';
import { PixelFrame } from '@vandaled/ddp-engine';

export class PixelPipeline {
  feed(frame: PixelFrame) {
    dispatcher.send(frame);
  }
}

export const pipeline = new PixelPipeline();
