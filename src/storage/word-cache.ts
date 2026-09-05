import AsyncStorage from '@react-native-async-storage/async-storage';
import type { DictionaryResult } from '../services/dictionary.service';

const WORD_CACHE_KEY = '@voxora/wordcache/v1';

export interface CachedWord {
  word: string;
  result: DictionaryResult | null;
  lookedUpAt: string;
}

const MAX_CACHE = 200;

export async function loadWordCache(): Promise<CachedWord[]> {
  const stored = await AsyncStorage.getItem(WORD_CACHE_KEY);
  if (!stored) {
    return [];
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isCachedWord) : [];
  } catch {
    return [];
  }
}

export async function addCachedWord(
  word: string,
  result: DictionaryResult | null,
): Promise<CachedWord[]> {
  const current = await loadWordCache();
  const normalized = word.toLowerCase().trim();
  const entry: CachedWord = {
    word: normalized,
    result,
    lookedUpAt: new Date().toISOString(),
  };

  const next = [
    entry,
    ...current.filter(item => item.word !== normalized),
  ].slice(0, MAX_CACHE);

  await AsyncStorage.setItem(WORD_CACHE_KEY, JSON.stringify(next));
  return next;
}

export async function clearWordCache(): Promise<void> {
  await AsyncStorage.removeItem(WORD_CACHE_KEY);
}

function isCachedWord(value: unknown): value is CachedWord {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<CachedWord>;
  return (
    typeof candidate.word === 'string' &&
    typeof candidate.lookedUpAt === 'string'
  );
}
