import {
  pauseSpeech,
  resumeSpeech,
  startStreamingSpeech,
  stopSpeech,
  subscribeToStreamChunkStarted,
  subscribeToStreamCompleted,
  subscribeToStreamError,
} from './kokoro-client';
import {
  chunkTextForSpeech,
  NARRATION_CHUNK_MAX_CHARACTERS,
  type TtsTextChunk,
} from './tts-text-chunker';

export type TtsQueueCallbacks = {
  onPreparing?: (index: number, total: number, text: string) => void;
  onChunkChange?: (
    index: number,
    total: number,
    startWordIndex: number,
    endWordIndex: number,
    text: string,
  ) => void;
  onComplete?: () => void;
  onError?: (error: Error) => void;
};

function normalizeError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

export class TtsPlaybackQueue {
  private chunks: TtsTextChunk[] = [];
  private currentIndex = -1;
  private sessionId = 0;
  private nativeSessionId: number | null = null;
  private voiceId = 2;
  private speed = 1;
  private narrationTitle = 'Wormhole narration';
  private readonly removeNativeListeners: Array<() => void>;

  constructor(private readonly callbacks: TtsQueueCallbacks = {}) {
    this.removeNativeListeners = [
      subscribeToStreamChunkStarted(event => {
        if (event.sessionId !== this.nativeSessionId) {
          return;
        }
        this.currentIndex = event.index;
        const startWordIndex = this.chunks
          .slice(0, event.index)
          .reduce(
            (total, item) => total + (item.text.match(/\S+/g)?.length ?? 0),
            0,
          );
        const wordCount = event.text.match(/\S+/g)?.length ?? 0;
        this.callbacks.onChunkChange?.(
          event.index,
          event.total,
          startWordIndex,
          startWordIndex + Math.max(0, wordCount - 1),
          event.text,
        );
      }),
      subscribeToStreamCompleted(event => {
        if (event.sessionId !== this.nativeSessionId) {
          return;
        }
        this.resetState();
        this.callbacks.onComplete?.();
      }),
      subscribeToStreamError(event => {
        if (event.sessionId !== this.nativeSessionId) {
          return;
        }
        this.resetState();
        this.callbacks.onError?.(new Error(event.message));
      }),
    ];
  }

  async start(
    text: string,
    voiceId = 2,
    speed = 1,
    title = 'Wormhole narration',
  ): Promise<void> {
    this.stop();
    this.voiceId = voiceId;
    this.speed = speed;
    this.narrationTitle = title.trim() || 'Wormhole narration';
    this.chunks = chunkTextForSpeech(text, {
      maxCharacters: NARRATION_CHUNK_MAX_CHARACTERS,
    });

    if (this.chunks.length === 0) {
      throw new Error('There is no text to read.');
    }

    await this.startAt(0);
  }

  pause(): Promise<number | null> {
    if (this.nativeSessionId == null) {
      return Promise.resolve(null);
    }
    return pauseSpeech();
  }

  resume(): Promise<number | null> {
    if (this.nativeSessionId == null) {
      return Promise.resolve(null);
    }
    return resumeSpeech();
  }

  async skipBy(offset: number): Promise<boolean> {
    if (this.chunks.length === 0 || this.currentIndex < 0) {
      return false;
    }
    const nextIndex = Math.max(
      0,
      Math.min(this.chunks.length - 1, this.currentIndex + offset),
    );
    if (nextIndex === this.currentIndex) {
      return false;
    }

    await this.startAt(nextIndex);
    return true;
  }

  stop(): void {
    this.sessionId += 1;
    this.resetState();
    stopSpeech();
  }

  handleExternalStop(): void {
    this.sessionId += 1;
    this.resetState();
    this.callbacks.onComplete?.();
  }

  dispose(): void {
    this.stop();
    this.removeNativeListeners.forEach(remove => remove());
  }

  private async startAt(index: number): Promise<void> {
    this.sessionId += 1;
    const sessionId = this.sessionId;
    this.nativeSessionId = null;
    this.currentIndex = index;
    this.callbacks.onPreparing?.(
      index,
      this.chunks.length,
      this.chunks[index].text,
    );

    try {
      const nativeSessionId = await startStreamingSpeech(
        this.chunks.map(chunk => chunk.text),
        index,
        this.voiceId,
        this.speed,
        this.narrationTitle,
      );
      if (sessionId === this.sessionId) {
        this.nativeSessionId = nativeSessionId;
      }
    } catch (error) {
      if (sessionId === this.sessionId) {
        this.resetState();
        throw normalizeError(error);
      }
    }
  }

  private resetState(): void {
    this.currentIndex = -1;
    this.nativeSessionId = null;
    this.chunks = [];
  }
}
