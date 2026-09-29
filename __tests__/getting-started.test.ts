import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  completeGettingStarted,
  hasCompletedGettingStarted,
} from '../src/storage/getting-started';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

beforeEach(() => {
  jest.clearAllMocks();
});

it('shows getting started until completion is stored', async () => {
  storage.getItem.mockResolvedValue(null);
  await expect(hasCompletedGettingStarted()).resolves.toBe(false);
});

it('recognizes and stores completed setup', async () => {
  storage.getItem.mockResolvedValue('complete');
  await expect(hasCompletedGettingStarted()).resolves.toBe(true);

  storage.setItem.mockResolvedValue(undefined);
  await completeGettingStarted();
  expect(storage.setItem).toHaveBeenCalledWith(
    '@wormhole/getting-started/v1',
    'complete',
  );
});
