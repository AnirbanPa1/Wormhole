import { NativeModules } from "react-native";

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

    prepareModelDirectory(
    ): Promise<string>;
};


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