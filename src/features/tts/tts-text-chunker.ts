const DEFAULT_MAX_CHARACTERS = 240;
const SENTENCE_PATTERN = /[^.!?]+(?:[.!?]+["'”’)\]]*|$)/g;

export type TtsTextChunk = {
    index: number;
    text: string;
};

export type TtsChunkOptions = {
    maxCharacters?: number;
}

export function chunkTextForSpeech(
    text: string,
    options: TtsChunkOptions = {},
): TtsTextChunk[] {
    const maxCharacters = options.maxCharacters ?? DEFAULT_MAX_CHARACTERS;

    if (!Number.isInteger(maxCharacters) || maxCharacters <= 0) {
        throw new Error('maxCharacters must be a positive integer');
    }

    const normalizedText = text.replace(/\s+/g, ' ').trim();

    if (!normalizedText) {
        return [];
    }

    const sentences = normalizedText.match(SENTENCE_PATTERN)?.map(sentence => sentence.trim()) ?? [normalizedText];

    const chunkTexts: string[] = [];
    let currentChunk = '';

    function flush(): void {
        if (currentChunk) {
            chunkTexts.push(currentChunk);
            currentChunk = '';
        }
    }

    function addPiece(piece: string): void {
        const candidate = currentChunk
            ? `${currentChunk} ${piece}`
            : piece;

        if (candidate.length <= maxCharacters) {
            currentChunk = candidate;
            return;
        }

        flush();

        if (piece.length <= maxCharacters) {
            currentChunk = piece;
            return;
        }

        for (const word of piece.split(' ')) {
            if (word.length > maxCharacters) {
                flush();

                for (let start = 0; start < word.length; start += maxCharacters) {
                    chunkTexts.push(word.slice(start, start + maxCharacters));
                }

                continue;
            }

            const wordCandidate = currentChunk
                ? `${currentChunk} ${word}`
                : word;

            if (wordCandidate.length > maxCharacters) {
                flush();
            }

            currentChunk = currentChunk
                ? `${currentChunk} ${word}`
                : word;
        }
    }

    for (const sentence of sentences) {
        if (sentence) {
            addPiece(sentence);
        }
    }

    flush();

    return chunkTexts.map((chunkText, index) => ({
        index,
        text: chunkText,
    }));
}