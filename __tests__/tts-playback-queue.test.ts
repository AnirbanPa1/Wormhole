const mockGenerations: Array<{
  resolve: (value: {
    filePath: string;
    sampleRate: number;
    generationMs: number;
    durationMs: number;
    realTimeFactor: number;
    sizeBytes: number;
  }) => void;
}> = [];

jest.mock('../src/features/tts/kokoro-client', () => ({
  pauseSpeech: jest.fn(() => Promise.resolve(0)),
  playSpeech: jest.fn(() => Promise.resolve(1000)),
  resumeSpeech: jest.fn(() => Promise.resolve(0)),
  stopSpeech: jest.fn(),
  synthesizeSpeech: jest.fn(
    () =>
      new Promise(resolve => {
        mockGenerations.push({ resolve });
      }),
  ),
  waitForPlaybackCompletion: jest.fn(() => new Promise(() => undefined)),
}));

import {
  playSpeech,
  synthesizeSpeech,
} from '../src/features/tts/kokoro-client';
import { TtsPlaybackQueue } from '../src/features/tts/tts-playback-queue';

const mockPlaySpeech = playSpeech as jest.MockedFunction<typeof playSpeech>;
const mockSynthesizeSpeech = synthesizeSpeech as jest.MockedFunction<
  typeof synthesizeSpeech
>;

describe('TtsPlaybackQueue prefetching', () => {
  beforeEach(() => {
    mockGenerations.length = 0;
    jest.clearAllMocks();
  });

  it('starts playback after the first passage while later passages are pending', async () => {
    const queue = new TtsPlaybackQueue();
    const text = [
      'First passage contains enough words to occupy its own generated speech chunk and ends here.',
      'Second passage also contains enough words to remain queued for synthesis in the background.',
      'Third passage verifies that the full lookahead window is submitted before playback begins.',
    ].join(' ');

    const started = queue.start(text);

    expect(mockSynthesizeSpeech).toHaveBeenCalledTimes(3);
    expect(mockPlaySpeech).not.toHaveBeenCalled();

    mockGenerations[0].resolve({
      filePath: '/cache/first.wav',
      sampleRate: 24000,
      generationMs: 900,
      durationMs: 1000,
      realTimeFactor: 0.9,
      sizeBytes: 48000,
    });

    await started;

    expect(mockPlaySpeech).toHaveBeenCalledTimes(1);
    expect(mockPlaySpeech).toHaveBeenCalledWith(
      '/cache/first.wav',
      'Wormhole narration',
      expect.stringContaining('Passage 1 of 3'),
    );
    expect(mockGenerations).toHaveLength(3);
  });
});
