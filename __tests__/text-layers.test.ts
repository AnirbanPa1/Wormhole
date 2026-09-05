import AsyncStorage from '@react-native-async-storage/async-storage';
import ReactNativeBlobUtil from 'react-native-blob-util';
import {loadTextLayer, saveTextLayer} from '../src/storage/text-layers';
import type {TextLayer} from '../src/types/text-layer';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: {DocumentDir: '/documents'},
    exists: jest.fn(),
    mkdir: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
  },
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;
const fileSystem = ReactNativeBlobUtil.fs as jest.Mocked<
  typeof ReactNativeBlobUtil.fs
>;

const layer: TextLayer = {
  documentId: 'doc/1',
  extractedAt: '2026-09-03T00:00:00.000Z',
  pages: [],
};

beforeEach(() => {
  jest.clearAllMocks();
  fileSystem.exists.mockResolvedValue(false);
  fileSystem.mkdir.mockResolvedValue(undefined);
  fileSystem.writeFile.mockResolvedValue(undefined);
  storage.getItem.mockResolvedValue(null);
  storage.setItem.mockResolvedValue(undefined);
  storage.removeItem.mockResolvedValue(undefined);
});

it('stores large text layers as files instead of AsyncStorage rows', async () => {
  await saveTextLayer(layer);

  expect(fileSystem.mkdir).toHaveBeenCalledWith('/documents/text-layers');
  expect(fileSystem.writeFile).toHaveBeenCalledWith(
    '/documents/text-layers/doc_1.json',
    JSON.stringify(layer),
    'utf8',
  );
  expect(storage.setItem).not.toHaveBeenCalledWith(
    '@voxora/textlayer/doc/1',
    expect.any(String),
  );
});

it('removes an unreadable oversized legacy row', async () => {
  storage.getItem.mockRejectedValueOnce(new Error('Row too big'));

  await expect(loadTextLayer('doc/1')).resolves.toBeNull();
  expect(storage.removeItem).toHaveBeenCalledWith('@voxora/textlayer/doc/1');
});
