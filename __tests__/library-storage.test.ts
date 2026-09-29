import ReactNativeBlobUtil from 'react-native-blob-util';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { loadLibrary, removeImportedPdf } from '../src/storage/library';
import type { LibraryDocument } from '../src/types/library';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

jest.mock('react-native-blob-util', () => ({
  fs: {
    dirs: { DocumentDir: '/app/documents' },
    exists: jest.fn(),
    unlink: jest.fn(),
  },
}));

const fileSystem = ReactNativeBlobUtil.fs as jest.Mocked<
  typeof ReactNativeBlobUtil.fs
>;
const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

const document: LibraryDocument = {
  id: 'book-1',
  title: 'Book',
  localUri: 'file:///app/documents/imported.pdf',
  pageCount: 10,
  currentPage: 2,
  importedAt: '2026-09-27T00:00:00.000Z',
  size: 100,
};

beforeEach(() => {
  jest.clearAllMocks();
  fileSystem.exists.mockResolvedValue(true);
  fileSystem.unlink.mockResolvedValue(undefined);
  storage.getItem.mockResolvedValue(null);
  storage.setItem.mockResolvedValue(undefined);
  storage.removeItem.mockResolvedValue(undefined);
});

it('migrates an existing Voxora library without losing books', async () => {
  storage.getItem
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(JSON.stringify([document]));

  await expect(loadLibrary()).resolves.toEqual([document]);
  expect(storage.setItem).toHaveBeenCalledWith(
    '@wormhole/library/v1',
    JSON.stringify([document]),
  );
  expect(storage.removeItem).toHaveBeenCalledWith('@voxora/library/v1');
});

it('removes only the app-private imported PDF copy', async () => {
  await removeImportedPdf(document);

  expect(fileSystem.unlink).toHaveBeenCalledWith('/app/documents/imported.pdf');
});

it('never removes a PDF outside the app document directory', async () => {
  await removeImportedPdf({
    ...document,
    localUri: 'file:///storage/emulated/0/Download/original.pdf',
  });

  expect(fileSystem.exists).not.toHaveBeenCalled();
  expect(fileSystem.unlink).not.toHaveBeenCalled();
});

it('rejects traversal paths that appear to start in the private directory', async () => {
  await removeImportedPdf({
    ...document,
    localUri: 'file:///app/documents/../shared/original.pdf',
  });

  expect(fileSystem.exists).not.toHaveBeenCalled();
  expect(fileSystem.unlink).not.toHaveBeenCalled();
});
