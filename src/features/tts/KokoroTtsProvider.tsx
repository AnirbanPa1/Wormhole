import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import  {
    initializeKokoro,
    prepareKokoroModelDirectory,
} from './kokoro-client';
import { TtsPlaybackQueue } from "./tts-playback-queue";

export type TtsStatus = 
    | 'idle'
    | 'initializing'
    | 'ready'
    | 'preparing'
    | 'playing'
    | 'paused'
    | 'error';

type TtsState = {
    status: TtsStatus;
    currentChunk: number;
    totalChunks: number;
    currentChunkStartWordIndex: number;
    currentChunkEndWordIndex: number;
    error: string | null;
};

type KokoroTtsContextValue = TtsState & {
    initialize(): Promise<void>;
    read(text: string, voiceId?: number, speed?: number): Promise<void>;
    pause(): Promise<void>;
    resume(): Promise<void>;
    stop(): void;
};

const initialState: TtsState = {
    status: 'idle',
    currentChunk: 0,
    totalChunks: 0,
    currentChunkStartWordIndex: -1,
    currentChunkEndWordIndex: -1,
    error: null,
};

const kokoroTtsContext = createContext<KokoroTtsContextValue | null>(null);

function normalizeError(error: unknown): Error {
    return error instanceof Error
        ? error
        : new Error(String(error));
}

export function KokoroTtsProvider({
    children,
}: React.PropsWithChildren): React.JSX.Element {
    const [state, setState] = useState(initialState);

    const queueRef = useRef<TtsPlaybackQueue | null>(null);
    const initializedRef = useRef(false);
    const initializationRef = useRef<Promise<void> | null>(null); 

    useEffect(() => {
        const queue = new TtsPlaybackQueue({
            onChunkChange(index, total, startWordIndex, endWordIndex) {
                setState(current => ({
                    ...current,
                    status: 'playing',
                    currentChunk: index + 1,
                    totalChunks: total,
                    currentChunkStartWordIndex: startWordIndex,
                    currentChunkEndWordIndex: endWordIndex,
                    error: null,
                }));
            },

            onComplete() {
                setState(current => ({
                    ...current,
                    status: 'ready',
                    currentChunk: 0,
                    totalChunks: 0,
                    currentChunkStartWordIndex: -1,
                    currentChunkEndWordIndex: -1,
                }))
            },

            onError(error) {
                setState({
                    status: 'error',
                    currentChunk: 0,
                    totalChunks: 0,
                    currentChunkStartWordIndex: -1,
                    currentChunkEndWordIndex: -1,
                    error: error.message,
                });
            },
        });

        queueRef.current = queue;

        return () => {
            queueRef.current = null;
            queue.dispose();
        };
    }, []);

    const initialize = useCallback(async (): Promise<void> => {
        if (initializedRef.current) {
            return;
        }

        if (!initializationRef.current) {
            setState(current => ({
                ...current,
                status: 'initializing',
                error: null,
            }));

            initializationRef.current = (async () => {
                const directory = await prepareKokoroModelDirectory();

                await initializeKokoro(directory, 4);

                initializedRef.current = true;

                setState(current => ({
                    ...current,
                    status: 'ready',
                    error: null,
                }));
            })().catch(error => {
                initializationRef.current = null;

                const normalized = normalizeError(error);

                setState({
                    status: 'error',
                    currentChunk: 0,
                    totalChunks: 0,
                    currentChunkStartWordIndex: -1,
                    currentChunkEndWordIndex: -1,
                    error: normalized.message,
                });

                throw normalized;
            });
        }

        await initializationRef.current;
    }, []);

    const read = useCallback(
        async (
            text: string,
            voiceId = 1,
            speed = 1,
        ): Promise<void> => {
            await initialize();

            const queue = queueRef.current;

            if (!queue) {
                throw new Error('TTS playback queue is unavailable.');
            }

            setState(current => ({
                ...current,
                status: 'preparing',
                error: null,
            }));

            try {
                await queue.start(text, voiceId, speed);
            } catch (error) {
                const normalized = normalizeError(error);

                setState({
                status: 'error',
                currentChunk: 0,
                totalChunks: 0,
                currentChunkStartWordIndex: -1,
                currentChunkEndWordIndex: -1,
                error: normalized.message,
                });

                throw normalized;
            }
        },
        [initialize],
    );

    const pause = useCallback(async (): Promise<void> => {
        await queueRef.current?.pause();

        setState(current => ({
            ...current,
            status: 'paused',
        }));
    }, []);

    const resume = useCallback(async (): Promise<void> => {
        await queueRef.current?.resume();

        setState(current => ({
            ...current,
            status: 'playing',
        }));
    }, []);

    const stop = useCallback((): void => {
        queueRef.current?.stop();

        setState(current => ({
            ...current,
            status: initializedRef.current ? 'ready' : 'idle',
            currentChunk: 0,
            totalChunks: 0,
            currentChunkStartWordIndex: -1,
            currentChunkEndWordIndex: -1,
            error: null,
        }));
    }, []);

    const value = useMemo<KokoroTtsContextValue>(
        () => ({
            ...state,
            initialize,
            read,
            pause,
            resume,
            stop,
        }),
        [initialize, pause, read, resume, state, stop],
    );

    return (
        <kokoroTtsContext.Provider value={value}>
            {children}
        </kokoroTtsContext.Provider>
    );
}

export function useKokoroTts(): KokoroTtsContextValue {
    const context = useContext(kokoroTtsContext);

    if (!context) {
        throw new Error(
            'useKokoroTts must be used inside KokoroTtsProvider.',
        );
    }

    return context;
}
