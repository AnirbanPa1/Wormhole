import {
  NativeEventEmitter,
  NativeModules,
  PermissionsAndroid,
  Platform,
} from 'react-native';

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
};

export type KokoroMediaControlEvent = {
  action: 'play' | 'pause' | 'stop' | 'previous' | 'next';
};

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

export type KokoroModelDownloadProgress = {
  phase: 'downloading' | 'verifying' | 'installing' | 'complete' | 'failed';
  completedBytes: number;
  totalBytes: number;
  progress: number | null;
};

type KokoroNativeEventMap = {
  KokoroPlaybackFinished: readonly [event: KokoroPlaybackFinishedEvent];
  KokoroModelDownloadProgress: readonly [event: KokoroModelDownloadProgress];
  KokoroMediaControl: readonly [event: KokoroMediaControlEvent];
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

  play(filePath: string, title: string, subtitle: string): Promise<number>;

  stop(keepNotification: boolean): void;

  addListener(eventName: string): void;

  removeListeners(count: number): void;

  pause(): Promise<number>;

  resume(): Promise<number>;

  getPlaybackPosition(): Promise<KokoroPlaybackPosition>;

  waitForPlaybackCompletion(): Promise<boolean>;
};

// ----------------------- Kokoro Model Implementation --------------------------

function getNativeModules(): KokoroTtsNativeModule {
  const module = NativeModules.KokoroTts as KokoroTtsNativeModule | undefined;

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
  ensureModelProgressSubscription();
  return getNativeModules().downloadModel();
}

export async function requestKokoroNotificationPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 33) {
    return true;
  }

  const result = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
  );
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export const requestKokoroDownloadNotificationPermission =
  requestKokoroNotificationPermission;

export function isKokoroModelMissingError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const nativeError = error as { code?: unknown; message?: unknown };
  return (
    nativeError.code === 'E_KOKORO_MODEL_MISSING' ||
    (typeof nativeError.message === 'string' &&
      nativeError.message.includes('Missing Kokoro model'))
  );
}

let latestModelDownloadProgress: KokoroModelDownloadProgress | null = null;
let modelProgressSubscription: { remove(): void } | null = null;
const modelProgressListeners = new Set<
  (event: KokoroModelDownloadProgress) => void
>();

function ensureModelProgressSubscription(): void {
  if (modelProgressSubscription) {
    return;
  }

  const nativeModule = getNativeModules();
  const emitter = new NativeEventEmitter<KokoroNativeEventMap>(nativeModule);
  modelProgressSubscription = emitter.addListener(
    'KokoroModelDownloadProgress',
    event => {
      latestModelDownloadProgress = event;
      modelProgressListeners.forEach(listener => listener(event));
    },
  );
}

export function subscribeToKokoroModelDownloadProgress(
  listener: (event: KokoroModelDownloadProgress) => void,
): () => void {
  ensureModelProgressSubscription();
  modelProgressListeners.add(listener);
  if (latestModelDownloadProgress) {
    listener(latestModelDownloadProgress);
  }
  return () => modelProgressListeners.delete(listener);
}

// ----------------------- Kokoro Model Control --------------------------

export function playSpeech(
  filePath: string,
  title = 'Wormhole narration',
  subtitle = 'Offline narration',
): Promise<number> {
  return getNativeModules().play(filePath, title, subtitle);
}

export function stopSpeech(keepNotification = false): void {
  getNativeModules().stop(keepNotification);
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

  const subscription = emitter.addListener('KokoroPlaybackFinished', listener);

  return () => subscription.remove();
}

export function waitForPlaybackCompletion(): Promise<boolean> {
  return getNativeModules().waitForPlaybackCompletion();
}

export function subscribeToKokoroMediaControl(
  listener: (event: KokoroMediaControlEvent) => void,
): () => void {
  const nativeModule = getNativeModules();
  const emitter = new NativeEventEmitter<KokoroNativeEventMap>(nativeModule);
  const subscription = emitter.addListener('KokoroMediaControl', listener);
  return () => subscription.remove();
}
