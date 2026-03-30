// stub for audio processor
export class AudioProcessor {
  start() {
    console.log('Audio processor started');
  }
  stop() {
    console.log('Audio processor stopped');
  }
}

export const audioProcessor = new AudioProcessor();
