import AsyncStorage from '@react-native-async-storage/async-storage';
import type {LibraryDocument} from '../types/library';

const LIBRARY_KEY = '@voxora/library/v1';

function isLibraryDocument(value: unknown): value is LibraryDocument {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<LibraryDocument>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.title === 'string' &&
    typeof candidate.localUri === 'string' &&
    typeof candidate.pageCount === 'number' &&
    typeof candidate.currentPage === 'number' &&
    typeof candidate.importedAt === 'string'
  );
}

export async function loadLibrary(): Promise<LibraryDocument[]> {
  const stored = await AsyncStorage.getItem(LIBRARY_KEY);
  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isLibraryDocument) : [];
  } catch {
    return [];
  }
}

export async function saveLibrary(
  documents: LibraryDocument[],
): Promise<void> {
  await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(documents));
}
