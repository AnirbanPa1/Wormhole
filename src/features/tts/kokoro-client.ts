import { NativeEventEmitter, NativeModules } from "react-native";

export type KokoroModelInfo = {
    modelPath: string;
    sampleRate: number;
    speakerCount: number;
    loadTimeMs: number;
    threadCount: number;
};

export type KokoroGenerationInfo = {
    filePath: string;
    sampleRate: number;
    generationMs: number;
    durationMs: number;
    realTimeFactor: number;
    sizeBytes: number;
};

export type KokoroPlaybackFinishedEvent = {
    filePath: string;
}

export type KokoroPlaybackPosition = {
    positionMs: number;
    durationMs: number;
    isPlaying: boolean;
};

export type KokoroModelStatus = {
    directory: string;
    installed: boolean;
    sizeBytes: number;
};

type KokoroNativeEventMap = {
    KokoroPlaybackFinished: readonly [
        event: KokoroPlaybackFinishedEvent,
    ];
};

type KokoroTtsNativeModule = {
    initialize(
        modelDirectory: string,
        threadCount: number,
    ): Promise<KokoroModelInfo>;

    synthesize(
        text: string,
        voiceId: number,
        speed: number,
    ): Promise<KokoroGenerationInfo>;

    prepareModelDirectory(): Promise<string>;

    getModelStatus(): Promise<KokoroModelStatus>;

    downloadModel(): Promise<KokoroModelStatus>;

    play(filePath: string): Promise<number>;

    stop(): void;

    addListener(eventName: string): void;
    
    removeListeners(count: number): void;

    pause(): Promise<number>;

    resume(): Promise<number>;

    getPlaybackPosition(): Promise<KokoroPlaybackPosition>;

    waitForPlaybackCompletion(): Promise<boolean>;
};

// ----------------------- Kokoro Model Implementation -------------------------- 

function getNativeModules(): KokoroTtsNativeModule {
    const module = NativeModules.KokoroTts as 
    | KokoroTtsNativeModule
    | undefined;

    if (!module) {
        throw new Error(
            'KokoroTts native module is unavailable. Rebuild the Android app.',
        );
    }

    return module;
}

export function initializeKokoro(
    modelDirectory: string,
    threadCount = 4,
): Promise<KokoroModelInfo> {
    return getNativeModules().initialize(modelDirectory, threadCount);
}

export function synthesizeSpeech(
    text: string,
    voiceId = 0,
    speed = 1,
): Promise<KokoroGenerationInfo> {
    return getNativeModules().synthesize(text, voiceId, speed);
}

export function prepareKokoroModelDirectory(): Promise<string> {
    return getNativeModules().prepareModelDirectory();
}

export function getKokoroModelStatus(): Promise<KokoroModelStatus> {
    return getNativeModules().getModelStatus();
}

export function downloadKokoroModel(): Promise<KokoroModelStatus> {
    return getNativeModules().downloadModel();
}

// ----------------------- Kokoro Model Control -------------------------- 

export function playSpeech(filePath: string): Promise<number> {
    return getNativeModules().play(filePath);
}

export function stopSpeech(): void {
    getNativeModules().stop();
}

export function pauseSpeech(): Promise<number> {
    return getNativeModules().pause();
}

export function resumeSpeech(): Promise<number> {
    return getNativeModules().resume();
}

export function getPlaybackPosition(): Promise<KokoroPlaybackPosition> {
    return getNativeModules().getPlaybackPosition();
}

// ----------------------- Kokoro Model Chunk Process Implementation -------------------------- 

export function subscribeToPlaybackFinished(
    listener: (event: KokoroPlaybackFinishedEvent) => void,
): () => void {
    const nativeModule = getNativeModules();
    const emitter = new NativeEventEmitter<KokoroNativeEventMap>(nativeModule);

    const subscription = emitter.addListener(
        'KokoroPlaybackFinished',
        listener,
    );

    return () => subscription.remove();
}

export function waitForPlaybackCompletion(): Promise<boolean> {
    return getNativeModules().waitForPlaybackCompletion();
}
