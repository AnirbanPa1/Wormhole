import {
    pauseSpeech,
    playSpeech,
    resumeSpeech,
    stopSpeech,
    synthesizeSpeech,
    type KokoroGenerationInfo,
    waitForPlaybackCompletion,
} from './kokoro-client';

import {
    chunkTextForSpeech,
    type TtsTextChunk,
} from './tts-text-chunker';

type GenerationResult = 
    | {ok: true; audio: KokoroGenerationInfo}
    | {ok: false; error: Error};

export type TtsQueueCallbacks = {
    onChunkChange?: (
        index: number,
        total: number,
        startWordIndex: number,
        endWordIndex: number,
    ) => void;
    onComplete?: () => void;
    onError?: (error: Error) => void;
};

function normalizeError(error: unknown): Error {
    return error instanceof Error
        ? error
        : new Error(String(error));
}

export class TtsPlaybackQueue {
    private chunks: TtsTextChunk[] = [];
    private pending = new Map<number, Promise<GenerationResult>>();

    private currentIndex = -1;
    private currentFilePath: string | null = null;
    private sessionId = 0;
    private voiceId = 1;
    private speed = 1;

    constructor(
        private readonly callbacks: TtsQueueCallbacks = {}
    ) {
       
    }

    async start(
        text: string,
        voiceId = 1,
        speed = 1,
    ): Promise<void> {
        this.stop();
        
        this.voiceId = voiceId;
        this.speed = speed;

        const sessionId = this.sessionId;

        this.chunks = chunkTextForSpeech(text, {
            maxCharacters: 160,
        });

        if (this.chunks.length === 0) {
            throw new Error('There is no text to read.');
        }

        this.prepareChunk(0, sessionId, voiceId, speed);

        await this.playChunk(0, sessionId, voiceId, speed);
    }

    pause(): Promise<number> {
        return pauseSpeech();
    }

    resume(): Promise<number> {
        return resumeSpeech();
    }

    stop(): void {
        this.sessionId += 1;
        this.currentIndex = -1;
        this.currentFilePath = null;
        this.chunks = [];
        this.pending.clear();
        stopSpeech();
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
            audio => ({ok: true, audio,}),
            error => ({ok: false, error: normalizeError(error),
            }),
        );

        this.pending.set(index, generation);
    }

    private async playChunk(
        index: number,
        sessionId: number,
        voiceId: number,
        speed: number,
    ): Promise<void> {
        this.prepareChunk(index, sessionId, voiceId, speed);

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

        await playSpeech(result.audio.filePath);

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
        );

        // Generate the following chunk while this one is playing.
        this.prepareChunk(
            index + 1,
            sessionId,
            voiceId,
            speed,
        );

        void completion.then(
            completed => {
                if (completed && sessionId === this.sessionId) {
                    void this.handlePlaybackFinished(
                        result.audio.filePath,
                    );
                }
            },
            error => {
                if (sessionId === this.sessionId) {
                    this.fail(normalizeError(error));
                }
            },
        );
    }

    private async handlePlaybackFinished(
        filePath: string,
    ): Promise<void> {
        if (filePath !== this.currentFilePath) {
            return;
        }

        const sessionId = this.sessionId;
        const nextIndex = this.currentIndex + 1;

        if (nextIndex >= this.chunks.length) {
            this.currentIndex = -1;
            this.currentFilePath = null;
            this.pending.clear();
            this.callbacks.onComplete?.();
            return;
        }

        try {
            await this.playChunk(
                nextIndex,
                sessionId,
                this.voiceId,
                this.speed,
            );
        } catch (error) {
            this.fail(normalizeError(error));
        }
    }

    private fail(error: Error): void {
        this.stop();
        this.callbacks.onError?.(error);
    }

}
