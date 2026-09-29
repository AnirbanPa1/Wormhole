import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import type { LibraryDocument } from '../types/library';

const LIBRARY_KEY = '@wormhole/library/v1';
const LEGACY_LIBRARY_KEY = '@voxora/library/v1';

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
  const current = await AsyncStorage.getItem(LIBRARY_KEY);
  const stored = current ?? (await AsyncStorage.getItem(LEGACY_LIBRARY_KEY));
  if (!stored) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(stored);
    const documents = Array.isArray(parsed)
      ? parsed.filter(isLibraryDocument)
      : [];
    if (current == null) {
      await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(documents));
      await AsyncStorage.removeItem(LEGACY_LIBRARY_KEY);
    }
    return documents;
  } catch {
    return [];
  }
}

export async function saveLibrary(documents: LibraryDocument[]): Promise<void> {
  await AsyncStorage.setItem(LIBRARY_KEY, JSON.stringify(documents));
  await AsyncStorage.removeItem(LEGACY_LIBRARY_KEY);
}

export async function removeImportedPdf(
  document: LibraryDocument,
): Promise<void> {
  if (!document.localUri.startsWith('file://')) {
    return;
  }

  const documentDirectory = ReactNativeBlobUtil.fs.dirs.DocumentDir.replace(
    /[\\/]+$/,
    '',
  ).replace(/\\/g, '/');
  const filePath = decodeURIComponent(
    document.localUri.replace(/^file:\/\//, ''),
  ).replace(/\\/g, '/');

  // Imported PDFs are copied into DocumentDir. Never unlink a path outside
  // that private directory, including the original file selected by the user.
  if (
    filePath.split('/').includes('..') ||
    !filePath.startsWith(`${documentDirectory}/`)
  ) {
    return;
  }

  if (await ReactNativeBlobUtil.fs.exists(filePath)) {
    await ReactNativeBlobUtil.fs.unlink(filePath);
  }
}
