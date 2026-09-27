import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const SETTINGS_KEY = '@wormhole/app-settings/v2';
const LEGACY_SETTINGS_KEY = '@wormhole/app-settings/v1';

export const KOKORO_VOICES = [
  {id: 3, name: 'Heart', code: 'af_heart'},
  {id: 0, name: 'Alloy', code: 'af_alloy'},
  {id: 2, name: 'Bella', code: 'af_bella'},
  {id: 6, name: 'Nicole', code: 'af_nicole'},
  {id: 9, name: 'Sarah', code: 'af_sarah'},
  {id: 10, name: 'Sky', code: 'af_sky'},
  {id: 11, name: 'Adam', code: 'am_adam'},
  {id: 16, name: 'Michael', code: 'am_michael'},
  {id: 21, name: 'Emma', code: 'bf_emma'},
  {id: 22, name: 'Isabella', code: 'bf_isabella'},
  {id: 26, name: 'George', code: 'bm_george'},
  {id: 27, name: 'Lewis', code: 'bm_lewis'},
] as const;

const LEGACY_VOICE_IDS: Record<number, number> = {
  0: 0,
  1: 2,
  2: 6,
  3: 9,
  4: 10,
  5: 11,
  6: 16,
  7: 21,
  8: 22,
  9: 26,
  10: 27,
};

function validVoiceId(value: unknown, legacy: boolean): number {
  if (!Number.isInteger(value)) {
    return defaults.voiceId;
  }
  const candidate = legacy
    ? LEGACY_VOICE_IDS[value as number]
    : (value as number);
  return KOKORO_VOICES.some(voice => voice.id === candidate)
    ? candidate
    : defaults.voiceId;
}

export const TTS_SPEEDS = [0.75, 0.9, 1, 1.1, 1.25] as const;

type StoredSettings = {
  voiceId: number;
  speed: number;
  darkMode: boolean;
  immersiveMode: boolean;
};

type AppSettingsContextValue = StoredSettings & {
  hydrated: boolean;
  setVoiceId(value: number): void;
  setSpeed(value: number): void;
  setDarkMode(value: boolean): void;
  setImmersiveMode(value: boolean): void;
};

const defaults: StoredSettings = {
  voiceId: 2,
  speed: 1,
  darkMode: false,
  immersiveMode: false,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({
  children,
}: React.PropsWithChildren): React.JSX.Element {
  const [settings, setSettings] = useState(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(SETTINGS_KEY),
      AsyncStorage.getItem(LEGACY_SETTINGS_KEY),
    ])
      .then(([currentValue, legacyValue]) => {
        const value = currentValue ?? legacyValue;
        if (!value) {
          return;
        }
        const isLegacy = currentValue == null && legacyValue != null;
        const parsed = JSON.parse(value) as Partial<StoredSettings>;
        const nextSettings: StoredSettings = {
          voiceId: validVoiceId(parsed.voiceId, isLegacy),
          speed:
            typeof parsed.speed === 'number' && parsed.speed > 0
              ? parsed.speed
              : defaults.speed,
          darkMode:
            typeof parsed.darkMode === 'boolean'
              ? parsed.darkMode
              : defaults.darkMode,
          immersiveMode:
            typeof parsed.immersiveMode === 'boolean'
              ? parsed.immersiveMode
              : defaults.immersiveMode,
        };
        setSettings(nextSettings);
        if (isLegacy) {
          AsyncStorage.setItem(
            SETTINGS_KEY,
            JSON.stringify(nextSettings),
          ).catch(() => undefined);
        }
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  const update = useCallback((patch: Partial<StoredSettings>) => {
    setSettings(current => {
      const next = {...current, ...patch};
      AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(next)).catch(
        () => undefined,
      );
      return next;
    });
  }, []);

  const value = useMemo<AppSettingsContextValue>(
    () => ({
      ...settings,
      hydrated,
      setVoiceId: voiceId => update({voiceId}),
      setSpeed: speed => update({speed}),
      setDarkMode: darkMode => update({darkMode}),
      setImmersiveMode: immersiveMode => update({immersiveMode}),
    }),
    [hydrated, settings, update],
  );

  return (
    <AppSettingsContext.Provider value={value}>
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextValue {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error('useAppSettings must be used inside AppSettingsProvider.');
  }
  return context;
}
