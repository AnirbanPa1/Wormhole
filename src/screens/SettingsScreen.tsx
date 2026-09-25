import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Switch,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import BottomNavigation, {type MainTab} from '../components/BottomNavigation';
import {colors} from '../constants/theme';
import {
  KOKORO_VOICES,
  TTS_SPEEDS,
  useAppSettings,
} from '../features/settings/AppSettingsProvider';
import {
  downloadKokoroModel,
  getKokoroModelStatus,
  requestKokoroDownloadNotificationPermission,
  subscribeToKokoroModelDownloadProgress,
  type KokoroModelDownloadProgress,
  type KokoroModelStatus,
} from '../features/tts/kokoro-client';
import {useKokoroTts} from '../features/tts/KokoroTtsProvider';
import styles from './SettingsScreen.styles';

type SettingsScreenProps = {
  onNavigate(tab: MainTab): void;
};

function formatMegabytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

function SettingsScreen({onNavigate}: SettingsScreenProps): React.JSX.Element {
  const {
    voiceId,
    speed,
    darkMode,
    immersiveMode,
    setVoiceId,
    setSpeed,
    setDarkMode,
    setImmersiveMode,
  } = useAppSettings();
  const {status: ttsStatus, initialize} = useKokoroTts();
  const [modelStatus, setModelStatus] = useState<KokoroModelStatus | null>(null);
  const [modelBusy, setModelBusy] = useState(false);
  const [downloadProgress, setDownloadProgress] =
    useState<KokoroModelDownloadProgress | null>(null);

  const refreshModelStatus = useCallback(() => {
    getKokoroModelStatus()
      .then(setModelStatus)
      .catch(() => setModelStatus(null));
  }, []);

  useEffect(refreshModelStatus, [refreshModelStatus]);

  useEffect(
    () =>
      subscribeToKokoroModelDownloadProgress(progress => {
        setDownloadProgress(progress);
        setModelBusy(
          progress.phase !== 'complete' && progress.phase !== 'failed',
        );
        if (progress.phase === 'complete') {
          refreshModelStatus();
        }
      }),
    [refreshModelStatus],
  );

  const handleModelAction = useCallback(async () => {
    setModelBusy(true);
    setDownloadProgress(null);
    try {
      if (!modelStatus?.installed) {
        const notificationsAllowed =
          await requestKokoroDownloadNotificationPermission();
        if (!notificationsAllowed) {
          return;
        }
      }

      const nextStatus = modelStatus?.installed
        ? modelStatus
        : await downloadKokoroModel();
      setModelStatus(nextStatus);
      await initialize();
      Alert.alert('Kokoro is ready', 'The offline voice model is ready to read.');
    } catch (error) {
      Alert.alert(
        'Kokoro setup failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
      refreshModelStatus();
    } finally {
      setModelBusy(false);
      setDownloadProgress(null);
    }
  }, [initialize, modelStatus, refreshModelStatus]);

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>MAKE IT YOURS</Text>
          <Text style={[styles.title, darkMode && styles.textDark]}>Settings</Text>
          <Text style={[styles.subtitle, darkMode && styles.mutedDark]}>
            Reading, narration, and appearance
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.sectionLabel, darkMode && styles.mutedDark]}>OFFLINE NARRATION</Text>
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <View style={styles.rowBetween}>
            <View style={styles.flex}>
              <Text style={[styles.cardTitle, darkMode && styles.textDark]}>Kokoro-82M</Text>
              <Text style={[styles.cardCopy, darkMode && styles.mutedDark]}>
                {modelStatus?.installed
                  ? `Installed${modelStatus.sizeBytes ? ` - ${formatMegabytes(modelStatus.sizeBytes)}` : ''}`
                  : 'Download once, then listen completely offline.'}
              </Text>
            </View>
            <View style={[styles.statusDot, modelStatus?.installed && styles.statusDotReady]} />
          </View>
          <Pressable
            disabled={modelBusy || ttsStatus === 'initializing'}
            onPress={handleModelAction}
            style={[
              styles.primaryButton,
              darkMode && styles.primaryButtonDark,
              (modelBusy || ttsStatus === 'initializing') && styles.disabled,
            ]}>
            {modelBusy || ttsStatus === 'initializing' ? (
              <View style={styles.busyButtonContent}>
                <ActivityIndicator
                  color={darkMode ? colors.ink : colors.focus}
                />
                <Text
                  style={[
                    styles.primaryButtonText,
                    darkMode && styles.primaryButtonTextDark,
                  ]}>
                  {downloadProgress?.phase === 'downloading'
                    ? downloadProgress.progress === null
                      ? 'Downloading model'
                      : `Downloading ${Math.round(downloadProgress.progress * 100)}%`
                    : downloadProgress?.phase === 'verifying'
                      ? 'Verifying download'
                      : downloadProgress?.phase === 'installing'
                        ? 'Installing model'
                        : 'Loading model'}
                </Text>
              </View>
            ) : (
              <Text
                style={[
                  styles.primaryButtonText,
                  darkMode && styles.primaryButtonTextDark,
                ]}>
                {modelStatus?.installed ? 'Load model' : 'Download model'}
              </Text>
            )}
          </Pressable>
          {modelBusy &&
            downloadProgress?.phase === 'downloading' &&
            downloadProgress.progress !== null && (
            <View
              style={[
                styles.modelProgressTrack,
                darkMode && styles.modelProgressTrackDark,
              ]}>
              <View
                style={[
                  styles.modelProgressFill,
                  {
                    width: `${Math.round(
                      downloadProgress.progress * 100,
                    )}%`,
                  },
                ]}
              />
            </View>
          )}
          {modelBusy &&
            downloadProgress?.phase === 'downloading' &&
            downloadProgress.totalBytes > 0 && (
              <Text
                style={[styles.downloadNote, darkMode && styles.mutedDark]}>
                {formatMegabytes(downloadProgress.completedBytes)} of{' '}
                {formatMegabytes(downloadProgress.totalBytes)}
              </Text>
            )}
          {!modelStatus?.installed && !modelBusy && (
            <Text style={[styles.downloadNote, darkMode && styles.mutedDark]}>
              Uses internet and up to about 400 MB of private device storage.
              Keep Wormhole open during the download.
            </Text>
          )}
        </View>

        <Text style={[styles.sectionLabel, darkMode && styles.mutedDark]}>VOICE</Text>
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <View style={styles.choiceGrid}>
            {KOKORO_VOICES.map(voice => (
              <Pressable
                key={voice.id}
                onPress={() => setVoiceId(voice.id)}
                style={[
                  styles.choice,
                  darkMode && styles.choiceDark,
                  voiceId === voice.id && styles.choiceActive,
                ]}>
                <Text
                  style={[
                    styles.choiceTitle,
                    darkMode && voiceId !== voice.id && styles.textDark,
                    voiceId === voice.id && styles.choiceTextActive,
                  ]}>
                  {voice.name}
                </Text>
                <Text
                  style={[
                    styles.choiceCode,
                    darkMode && voiceId !== voice.id && styles.mutedDark,
                    voiceId === voice.id && styles.choiceTextActive,
                  ]}>
                  {voice.code}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionLabel, darkMode && styles.mutedDark]}>READING SPEED</Text>
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <View style={styles.speedRow}>
            {TTS_SPEEDS.map(option => (
              <Pressable
                key={option}
                onPress={() => setSpeed(option)}
                style={[
                  styles.speedChoice,
                  darkMode && styles.choiceDark,
                  speed === option && styles.choiceActive,
                ]}>
                <Text
                  style={[
                    styles.speedText,
                    darkMode && speed !== option && styles.textDark,
                    speed === option && styles.choiceTextActive,
                  ]}>
                  {option}x
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        <Text style={[styles.sectionLabel, darkMode && styles.mutedDark]}>PLAYBACK EXPERIENCE</Text>
        <View style={[styles.card, styles.toggleRow, darkMode && styles.cardDark]}>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, darkMode && styles.textDark]}>
              Immersive listening mode
            </Text>
            <Text style={[styles.cardCopy, darkMode && styles.mutedDark]}>
              Open the focused audio player when narration starts. You can
              still expand it manually from the reader.
            </Text>
          </View>
          <Switch
            accessibilityLabel="Immersive listening mode"
            onValueChange={setImmersiveMode}
            thumbColor={colors.ink}
            trackColor={{false: '#B9B0A5', true: colors.focus}}
            value={immersiveMode}
          />
        </View>

        <Text style={[styles.sectionLabel, darkMode && styles.mutedDark]}>APPEARANCE</Text>
        <View style={[styles.card, styles.toggleRow, darkMode && styles.cardDark]}>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, darkMode && styles.textDark]}>Dark mode</Text>
            <Text style={[styles.cardCopy, darkMode && styles.mutedDark]}>
              Use Wormhole's warm night palette throughout the app.
            </Text>
          </View>
          <Switch
            onValueChange={setDarkMode}
            thumbColor={colors.ink}
            trackColor={{false: '#B9B0A5', true: colors.focus}}
            value={darkMode}
          />
        </View>

        <Text style={[styles.sectionLabel, darkMode && styles.mutedDark]}>STORAGE</Text>
        <View style={[styles.card, darkMode && styles.cardDark]}>
          <Text style={[styles.cardTitle, darkMode && styles.textDark]}>Kept on this device</Text>
          <Text style={[styles.cardCopy, darkMode && styles.mutedDark]}>
            Imported PDFs, saved words, preferences, and the Kokoro model use
            Wormhole's app-private storage and remain available offline.
          </Text>
        </View>
      </ScrollView>
      <BottomNavigation active="settings" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

export default SettingsScreen;
