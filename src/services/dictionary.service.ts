// Dictionary service backed by Simple English Wiktionary definitions with
// Open English WordNet as the broad-coverage fallback
// (android/app/src/main/assets/dictionary.json / iOS main bundle).
//
// The dictionary is deliberately NOT required() into the JS bundle -- a ~20 MB
// inline JSON bloats every dev reload and made the app appear "stuck at
// reloading". Instead it ships as a native asset and is read + parsed once,
// lazily, on first use, keeping the JS bundle small and fast.
//
// Entry format (per word):
//   [{ pos, defs: string[], syn: string[] }, ...]
// where pos is one of: n (noun), v (verb), a (adjective), s (adj satellite),
// r (adverb), c (conjunction), etc.

import ReactNativeBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';
import { candidateLemmas } from './morphology.service';

export interface DictionaryEntry {
  pos: string;
  defs: string[];
  syn: string[];
  examples?: string[];
  source?: 'simple-wiktionary' | 'oewn';
}

export interface DictionaryResult {
  word: string;
  matchedLemma: string;
  entries: DictionaryEntry[];
}

export const POS_LABELS: Record<string, string> = {
  n: 'noun',
  v: 'verb',
  a: 'adjective',
  s: 'adjective',
  r: 'adverb',
  c: 'conjunction',
  p: 'preposition',
  u: 'unknown',
  x: 'other',
};

type RawDictionary = {
  meta: {
    source: string;
    home: string;
    license: string;
    words: number;
    simpleWords?: number;
    oewnWords?: number;
  };
  words: Record<string, DictionaryEntry[]>;
};

const DICTIONARY_FILENAME = 'dictionary.json';

let dictionary: RawDictionary | null = null;
let loadPromise: Promise<boolean> | null = null;

function assetUri(): string {
  if (Platform.OS === 'ios') {
    return `${ReactNativeBlobUtil.fs.dirs.MainBundleDir}/${DICTIONARY_FILENAME}`;
  }
  // Android bundled assets are resolved via the bundle-assets:// scheme.
  return ReactNativeBlobUtil.fs.asset(DICTIONARY_FILENAME);
}

/**
 * Load the dictionary from the bundled native asset. Safe to call repeatedly;
 * a shared promise means concurrent calls await the same load.
 */
export function initDictionary(): Promise<boolean> {
  if (dictionary) {
    return Promise.resolve(true);
  }
  if (loadPromise) {
    return loadPromise;
  }

  loadPromise = (async (): Promise<boolean> => {
    try {
      const raw = await ReactNativeBlobUtil.fs.readFile(assetUri(), 'utf8');
      const parsed: unknown = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !('words' in parsed)) {
        throw new Error('Dictionary data is malformed.');
      }
      dictionary = parsed as RawDictionary;
      return true;
    } catch (error) {
      loadPromise = null;
      console.warn('Dictionary failed to load', error);
      return false;
    }
  })();

  return loadPromise;
}

export function isLoaded(): boolean {
  return dictionary !== null;
}

export function getMeta(): RawDictionary['meta'] | null {
  return dictionary?.meta ?? null;
}

export function wordCount(): number {
  return dictionary?.meta?.words ?? 0;
}

export function lookupRaw(word: string): DictionaryEntry[] | undefined {
  if (!dictionary) {
    return undefined;
  }
  return dictionary.words[word.toLowerCase().trim()];
}

/**
 * Look up a word. Tries the direct lemma first, then falls back to
 * morphologically derived candidate forms.
 */
export function lookup(word: string): DictionaryResult | null {
  const normalized = word.toLowerCase().trim();
  if (!normalized || !dictionary) {
    return null;
  }

  for (const lemma of candidateLemmas(normalized)) {
    const entries = dictionary.words[lemma];
    if (entries && entries.length > 0) {
      return { word: normalized, matchedLemma: lemma, entries };
    }
  }

  return null;
}

export function formatPos(pos: string): string {
  return POS_LABELS[pos] ?? pos;
}
