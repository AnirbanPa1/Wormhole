import {
  pauseSpeech,
  playSpeech,
  resumeSpeech,
  stopSpeech,
  synthesizeSpeech,
  type KokoroGenerationInfo,
  waitForPlaybackCompletion,
} from './kokoro-client';

import { chunkTextForSpeech, type TtsTextChunk } from './tts-text-chunker';

type GenerationResult =
  | { ok: true; audio: KokoroGenerationInfo }
  | { ok: false; error: Error };

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
  private static readonly PLAYBACK_LOOKAHEAD = 2;

  private chunks: TtsTextChunk[] = [];
  private pending = new Map<number, Promise<GenerationResult>>();

  private currentIndex = -1;
  private currentFilePath: string | null = null;
  private sessionId = 0;
  private voiceId = 1;
  private speed = 1;
  private narrationTitle = 'Wormhole narration';

  constructor(private readonly callbacks: TtsQueueCallbacks = {}) {}

  async start(
    text: string,
    voiceId = 1,
    speed = 1,
    title = 'Wormhole narration',
  ): Promise<void> {
    this.stop();

    this.voiceId = voiceId;
    this.speed = speed;
    this.narrationTitle = title.trim() || 'Wormhole narration';

    const sessionId = this.sessionId;

    this.chunks = chunkTextForSpeech(text, {
      maxCharacters: 160,
    });

    if (this.chunks.length === 0) {
      throw new Error('There is no text to read.');
    }

    // Enqueue the initial lookahead immediately, but wait only for the first
    // passage. As soon as passage 1 is ready MediaPlayer can consume it while
    // Kokoro's worker continues synthesizing passages 2 and 3.
    this.prepareWindow(0, sessionId, voiceId, speed);
    await this.pending.get(0);

    if (sessionId !== this.sessionId) {
      return;
    }

    await this.playChunk(0, sessionId, voiceId, speed);
  }

  pause(): Promise<number | null> {
    if (!this.currentFilePath) {
      return Promise.resolve(null);
    }
    return pauseSpeech();
  }

  resume(): Promise<number | null> {
    if (!this.currentFilePath) {
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

    this.sessionId += 1;
    const sessionId = this.sessionId;
    this.currentFilePath = null;
    stopSpeech(true);
    await this.playChunk(nextIndex, sessionId, this.voiceId, this.speed);
    return true;
  }

  stop(): void {
    this.sessionId += 1;
    this.currentIndex = -1;
    this.currentFilePath = null;
    this.chunks = [];
    this.pending.clear();
    stopSpeech();
  }

  handleExternalStop(): void {
    this.sessionId += 1;
    this.currentIndex = -1;
    this.currentFilePath = null;
    this.chunks = [];
    this.pending.clear();
    this.callbacks.onComplete?.();
  }

  dispose(): void {
    this.stop();
  }

  private prepareChunk(
    index: number,
    sessionId: number,
    voiceId: number,
    speed: number,
  ): void {
    if (
      sessionId !== this.sessionId ||
      !this.chunks[index] ||
      this.pending.has(index)
    ) {
      return;
    }

    const chunk = this.chunks[index];

    const generation: Promise<GenerationResult> = synthesizeSpeech(
      chunk.text,
      voiceId,
      speed,
    ).then(
      audio => ({ ok: true, audio }),
      error => ({ ok: false, error: normalizeError(error) }),
    );

    this.pending.set(index, generation);
  }

  private prepareWindow(
    index: number,
    sessionId: number,
    voiceId: number,
    speed: number,
  ): void {
    for (
      let offset = 0;
      offset <= TtsPlaybackQueue.PLAYBACK_LOOKAHEAD;
      offset += 1
    ) {
      this.prepareChunk(index + offset, sessionId, voiceId, speed);
    }
  }

  private async playChunk(
    index: number,
    sessionId: number,
    voiceId: number,
    speed: number,
  ): Promise<void> {
    if (sessionId !== this.sessionId || !this.chunks[index]) {
      return;
    }

    this.currentFilePath = null;
    this.callbacks.onPreparing?.(
      index,
      this.chunks.length,
      this.chunks[index].text,
    );
    this.prepareWindow(index, sessionId, voiceId, speed);

    const generation = this.pending.get(index);

    if (!generation) {
      return;
    }

    const result = await generation;

    if (sessionId !== this.sessionId) {
      return;
    }

    if (!result.ok) {
      this.fail(result.error);
      return;
    }

    this.currentIndex = index;
    this.currentFilePath = result.audio.filePath;

    const completion = waitForPlaybackCompletion();

    const chunkText = this.chunks[index].text.replace(/\s+/g, ' ').trim();
    const subtitle = `Passage ${index + 1} of ${
      this.chunks.length
    } · ${chunkText}`;
    await playSpeech(result.audio.filePath, this.narrationTitle, subtitle);

    if (sessionId !== this.sessionId) {
      stopSpeech();
      return;
    }

    const startWordIndex = this.chunks
      .slice(0, index)
      .reduce(
        (total, item) => total + (item.text.match(/\S+/g)?.length ?? 0),
        0,
      );
    const chunkWordCount = this.chunks[index]?.text.match(/\S+/g)?.length ?? 0;
    this.callbacks.onChunkChange?.(
      index,
      this.chunks.length,
      startWordIndex,
      startWordIndex + Math.max(0, chunkWordCount - 1),
      this.chunks[index].text,
    );

    void completion.then(
      completed => {
        if (completed && sessionId === this.sessionId) {
          void this.handlePlaybackFinished(result.audio.filePath);
        }
      },
      error => {
        if (sessionId === this.sessionId) {
          this.fail(normalizeError(error));
        }
      },
    );
  }

  private async handlePlaybackFinished(filePath: string): Promise<void> {
    if (filePath !== this.currentFilePath) {
      return;
    }

    this.currentFilePath = null;
    const sessionId = this.sessionId;
    const nextIndex = this.currentIndex + 1;

    if (nextIndex >= this.chunks.length) {
      this.currentIndex = -1;
      this.currentFilePath = null;
      this.pending.clear();
      stopSpeech();
      this.callbacks.onComplete?.();
      return;
    }

    try {
      await this.playChunk(nextIndex, sessionId, this.voiceId, this.speed);
    } catch (error) {
      this.fail(normalizeError(error));
    }
  }

  private fail(error: Error): void {
    this.stop();
    this.callbacks.onError?.(error);
  }
}
