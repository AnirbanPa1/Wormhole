import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import type { TextLayer } from '../types/text-layer';

const LAYER_PREFIX = '@voxora/textlayer/';
const INDEX_KEY = '@voxora/textlayer/index/v1';
const LAYER_DIRECTORY = 'text-layers';

interface LayerIndex {
  [documentId: string]: string;
}

export async function saveTextLayer(layer: TextLayer): Promise<void> {
  const directory = textLayerDirectory();
  if (!(await ReactNativeBlobUtil.fs.exists(directory))) {
    await ReactNativeBlobUtil.fs.mkdir(directory);
  }

  // Text layers for full books can be many megabytes. AsyncStorage stores each
  // value as a SQLite row, which Android cannot read once it exceeds its
  // CursorWindow size. App-private files do not have that per-row limit.
  await ReactNativeBlobUtil.fs.writeFile(
    textLayerPath(layer.documentId),
    JSON.stringify(layer),
    'utf8',
  );

  const index: LayerIndex =
    (await readIndex().catch(() => ({}))) ?? {};
  index[layer.documentId] = new Date().toISOString();
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(index));

  // Remove data written by the old single-row implementation after the file
  // has been persisted successfully.
  await AsyncStorage.removeItem(legacyPayloadKey(layer.documentId));
}

export async function loadTextLayer(
  documentId: string,
): Promise<TextLayer | null> {
  const path = textLayerPath(documentId);
  try {
    if (await ReactNativeBlobUtil.fs.exists(path)) {
      const stored = await ReactNativeBlobUtil.fs.readFile(path, 'utf8');
      const parsed: unknown = JSON.parse(stored);
      return isTextLayer(parsed) ? parsed : null;
    }
  } catch {
    // A missing or malformed cache is recoverable by extracting the PDF again.
  }

  const payload = legacyPayloadKey(documentId);
  try {
    const stored = await AsyncStorage.getItem(payload);
    if (!stored) {
      return null;
    }
    const parsed: unknown = JSON.parse(stored);
    if (!isTextLayer(parsed)) {
      return null;
    }

    // Transparently migrate text layers that were small enough for the old
    // AsyncStorage implementation.
    await saveTextLayer(parsed);
    return parsed;
  } catch {
    // An oversized legacy row throws while being read. Delete only that
    // derived cache entry; the original PDF remains untouched.
    await AsyncStorage.removeItem(payload).catch(() => undefined);
    return null;
  }
}

export async function hasTextLayer(documentId: string): Promise<boolean> {
  return (await loadTextLayer(documentId)) !== null;
}

async function readIndex(): Promise<LayerIndex> {
  const stored = await AsyncStorage.getItem(INDEX_KEY);
  if (!stored) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    return parsed && typeof parsed === 'object' ? (parsed as LayerIndex) : {};
  } catch {
    return {};
  }
}

function textLayerDirectory(): string {
  return `${ReactNativeBlobUtil.fs.dirs.DocumentDir}/${LAYER_DIRECTORY}`;
}

function textLayerPath(documentId: string): string {
  const safeId = documentId.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${textLayerDirectory()}/${safeId}.json`;
}

function legacyPayloadKey(documentId: string): string {
  return `${LAYER_PREFIX}${documentId}`;
}

function isTextLayer(value: unknown): value is TextLayer {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<TextLayer>;
  return (
    typeof candidate.documentId === 'string' &&
    typeof candidate.extractedAt === 'string' &&
    Array.isArray(candidate.pages)
  );
}
