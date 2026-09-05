export interface TextChunk {
  chunkNumber: number;
  text: string;
  startPosition: number;
  endPosition: number;
}

interface ChunkerOptions {
  maxChunkCharacters?: number;
}

const CHAPTER_PATTERN = /^#{1,3}\s+.+|Chapter\s+\d+/i;
const SENTENCE_END = /([.!?])\s+/g;

export function chunkText(
  text: string,
  options: ChunkerOptions = {},
): TextChunk[] {
  const maxChunk = options.maxChunkCharacters ?? 4000;

  if (!text || !text.trim()) {
    return [];
  }

  const paragraphs = text.split(/\n\s*\n/);
  const chunks: TextChunk[] = [];
  let currentChunk = '';
  let currentPosition = 0;
  let chunkNumber = 1;

  const flush = () => {
    const trimmed = currentChunk.trim();
    if (trimmed) {
      chunks.push({
        chunkNumber,
        text: trimmed,
        startPosition: currentPosition - currentChunk.length,
        endPosition: currentPosition,
      });
      chunkNumber++;
    }
    currentChunk = '';
  };

  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      currentPosition += paragraph.length + 2;
      continue;
    }

    if (CHAPTER_PATTERN.test(paragraph.trim())) {
      flush();
      currentPosition += paragraph.length + 2;
      currentChunk = paragraph;
      flush();
      currentPosition = chunks[chunks.length - 1]?.endPosition ?? currentPosition;
      continue;
    }

    if (
      currentChunk &&
      (currentChunk + '\n\n' + paragraph).length > maxChunk
    ) {
      flush();
    }

    if (paragraph.length > maxChunk) {
      flush();
      const sentences = paragraph.split(SENTENCE_END);
      for (const sentence of sentences) {
        if (!sentence.trim()) {
          currentPosition += sentence.length;
          continue;
        }
        if (
          currentChunk &&
          (currentChunk + ' ' + sentence).length > maxChunk
        ) {
          flush();
        }
        if (sentence.length > maxChunk) {
          flush();
          const words = sentence.split(/\s+/);
          for (const word of words) {
            if (
              currentChunk &&
              (currentChunk + ' ' + word).length > maxChunk
            ) {
              flush();
            }
            currentChunk = currentChunk
              ? `${currentChunk} ${word}`
              : word;
            currentPosition += word.length + 1;
          }
        } else {
          currentChunk = currentChunk
            ? `${currentChunk} ${sentence}`
            : sentence;
          currentPosition += sentence.length + 1;
        }
      }
    } else {
      currentChunk = currentChunk
        ? `${currentChunk}\n\n${paragraph}`
        : paragraph;
      currentPosition += paragraph.length + 2;
    }
  }

  flush();
  return chunks;
}
