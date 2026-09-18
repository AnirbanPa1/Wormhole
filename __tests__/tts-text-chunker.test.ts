import {chunkTextForSpeech} from '../src/features/tts/tts-text-chunker';

describe('chunkTextForSpeech', () => {
  it('returns nothing for empty text', () => {
    expect(chunkTextForSpeech('   \n ')).toEqual([]);
  });

  it('normalizes repeated whitespace', () => {
    const chunks = chunkTextForSpeech('Hello   there.\n\nHow are you?');

    expect(chunks).toEqual([
      {
        index: 0,
        text: 'Hello there. How are you?',
      },
    ]);
  });

  it('prefers sentence boundaries', () => {
    const chunks = chunkTextForSpeech(
      'First sentence. This is the second sentence! And this is the third?',
      {maxCharacters: 35},
    );

    expect(chunks.map(chunk => chunk.text)).toEqual([
      'First sentence.',
      'This is the second sentence!',
      'And this is the third?',
    ]);
  });

  it('splits oversized sentences at word boundaries', () => {
    const chunks = chunkTextForSpeech(
      'one two three four five six',
      {maxCharacters: 10},
    );

    expect(chunks.map(chunk => chunk.text)).toEqual([
      'one two',
      'three four',
      'five six',
    ]);
  });

  it('hard-splits a word longer than the limit', () => {
    const chunks = chunkTextForSpeech('abcdefghij', {
      maxCharacters: 4,
    });

    expect(chunks.map(chunk => chunk.text)).toEqual([
      'abcd',
      'efgh',
      'ij',
    ]);
  });

  it('never exceeds the configured limit', () => {
    const chunks = chunkTextForSpeech(
      'This sentence is deliberately long. It should become several safe speech chunks.',
      {maxCharacters: 20},
    );

    expect(chunks.every(chunk => chunk.text.length <= 20)).toBe(true);
  });

  it('assigns sequential indexes', () => {
    const chunks = chunkTextForSpeech(
      'First sentence. Second sentence. Third sentence.',
      {maxCharacters: 18},
    );

    expect(chunks.map(chunk => chunk.index)).toEqual([0, 1, 2]);
  });

  it('rejects invalid limits', () => {
    expect(() =>
      chunkTextForSpeech('Hello.', {maxCharacters: 0}),
    ).toThrow('maxCharacters must be a positive integer');
  });
});