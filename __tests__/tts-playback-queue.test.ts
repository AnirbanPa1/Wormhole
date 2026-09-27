type StreamEvent = {
  sessionId: number;
  index: number;
  total: number;
  text: string;
};

let chunkListener: ((event: StreamEvent) => void) | undefined;
let completeListener: ((event: {sessionId: number}) => void) | undefined;

jest.mock('../src/features/tts/kokoro-client', () => ({
  pauseSpeech: jest.fn(() => Promise.resolve(0)),
  resumeSpeech: jest.fn(() => Promise.resolve(0)),
  startStreamingSpeech: jest.fn(() => Promise.resolve(41)),
  stopSpeech: jest.fn(),
  subscribeToStreamChunkStarted: jest.fn(listener => {
    chunkListener = listener;
    return jest.fn();
  }),
  subscribeToStreamCompleted: jest.fn(listener => {
    completeListener = listener;
    return jest.fn();
  }),
  subscribeToStreamError: jest.fn(() => jest.fn()),
}));

import {startStreamingSpeech} from '../src/features/tts/kokoro-client';
import {TtsPlaybackQueue} from '../src/features/tts/tts-playback-queue';

const mockStartStreamingSpeech =
  startStreamingSpeech as jest.MockedFunction<typeof startStreamingSpeech>;

describe('TtsPlaybackQueue native streaming', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    chunkListener = undefined;
    completeListener = undefined;
  });

  it('sends every passage to one native streaming session', async () => {
    const onChunkChange = jest.fn();
    const queue = new TtsPlaybackQueue({onChunkChange});
    const text = [
      'First passage contains enough words to become generated audio and ends here.',
      'Second passage remains part of the same continuous native playback stream.',
      'Third passage verifies that all text is submitted in a single request.',
    ].join(' ');

    await queue.start(text, 2, 1.1, 'Test book');

    expect(mockStartStreamingSpeech).toHaveBeenCalledTimes(1);
    const [chunks, startIndex, voiceId, speed, title] =
      mockStartStreamingSpeech.mock.calls[0];
    expect(chunks.length).toBeGreaterThan(1);
    expect(startIndex).toBe(0);
    expect(voiceId).toBe(2);
    expect(speed).toBe(1.1);
    expect(title).toBe('Test book');

    chunkListener?.({
      sessionId: 41,
      index: 0,
      total: chunks.length,
      text: chunks[0],
    });
    expect(onChunkChange).toHaveBeenCalledWith(
      0,
      chunks.length,
      0,
      expect.any(Number),
      chunks[0],
    );
  });

  it('ignores completion events from an obsolete native session', async () => {
    const onComplete = jest.fn();
    const queue = new TtsPlaybackQueue({onComplete});
    await queue.start('A short sentence that can be narrated.');

    completeListener?.({sessionId: 40});
    expect(onComplete).not.toHaveBeenCalled();

    completeListener?.({sessionId: 41});
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
