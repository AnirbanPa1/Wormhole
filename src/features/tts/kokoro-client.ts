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

    play(filePath: string): Promise<number>;

    stop(): void;

    addListener(eventName: string): void;
    
    removeListeners(count: number): void;

    pause(): Promise<number>;

    resume(): Promise<number>;

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