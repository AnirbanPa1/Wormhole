import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

const SETTINGS_KEY = '@wormhole/app-settings/v1';

export const KOKORO_VOICES = [
  {id: 0, name: 'Default female', code: 'af'},
  {id: 1, name: 'Bella', code: 'af_bella'},
  {id: 2, name: 'Nicole', code: 'af_nicole'},
  {id: 3, name: 'Sarah', code: 'af_sarah'},
  {id: 4, name: 'Sky', code: 'af_sky'},
  {id: 5, name: 'Adam', code: 'am_adam'},
  {id: 6, name: 'Michael', code: 'am_michael'},
  {id: 7, name: 'Emma', code: 'bf_emma'},
  {id: 8, name: 'Isabella', code: 'bf_isabella'},
  {id: 9, name: 'George', code: 'bm_george'},
  {id: 10, name: 'Lewis', code: 'bm_lewis'},
] as const;

export const TTS_SPEEDS = [0.75, 0.9, 1, 1.1, 1.25] as const;

type StoredSettings = {
  voiceId: number;
  speed: number;
  darkMode: boolean;
};

type AppSettingsContextValue = StoredSettings & {
  hydrated: boolean;
  setVoiceId(value: number): void;
  setSpeed(value: number): void;
  setDarkMode(value: boolean): void;
};

const defaults: StoredSettings = {
  voiceId: 1,
  speed: 1,
  darkMode: false,
};

const AppSettingsContext = createContext<AppSettingsContextValue | null>(null);

export function AppSettingsProvider({
  children,
}: React.PropsWithChildren): React.JSX.Element {
  const [settings, setSettings] = useState(defaults);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_KEY)
      .then(value => {
        if (!value) {
          return;
        }
        const parsed = JSON.parse(value) as Partial<StoredSettings>;
        setSettings({
          voiceId: Number.isInteger(parsed.voiceId)
            ? Math.max(0, Math.min(10, parsed.voiceId as number))
            : defaults.voiceId,
          speed:
            typeof parsed.speed === 'number' && parsed.speed > 0
              ? parsed.speed
              : defaults.speed,
          darkMode:
            typeof parsed.darkMode === 'boolean'
              ? parsed.darkMode
              : defaults.darkMode,
        });
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
