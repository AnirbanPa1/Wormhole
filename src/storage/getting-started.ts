import AsyncStorage from '@react-native-async-storage/async-storage';

const GETTING_STARTED_KEY = '@wormhole/getting-started/v1';

export async function hasCompletedGettingStarted(): Promise<boolean> {
  return (await AsyncStorage.getItem(GETTING_STARTED_KEY)) === 'complete';
}

export async function completeGettingStarted(): Promise<void> {
  await AsyncStorage.setItem(GETTING_STARTED_KEY, 'complete');
}
