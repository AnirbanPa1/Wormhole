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
import {
  KOKORO_VOICES,
  TTS_SPEEDS,
  useAppSettings,
} from '../features/settings/AppSettingsProvider';
import {
  downloadKokoroModel,
  getKokoroModelStatus,
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
    setVoiceId,
    setSpeed,
    setDarkMode,
  } = useAppSettings();
  const {status: ttsStatus, initialize} = useKokoroTts();
  const [modelStatus, setModelStatus] = useState<KokoroModelStatus | null>(null);
  const [modelBusy, setModelBusy] = useState(false);

  const refreshModelStatus = useCallback(() => {
    getKokoroModelStatus()
      .then(setModelStatus)
      .catch(() => setModelStatus(null));
  }, []);

  useEffect(refreshModelStatus, [refreshModelStatus]);

  const handleModelAction = useCallback(async () => {
    setModelBusy(true);
    try {
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
            style={[styles.primaryButton, (modelBusy || ttsStatus === 'initializing') && styles.disabled]}>
            {modelBusy || ttsStatus === 'initializing' ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>
                {modelStatus?.installed ? 'Load model' : 'Download model'}
              </Text>
            )}
          </Pressable>
          {!modelStatus?.installed && (
            <Text style={[styles.downloadNote, darkMode && styles.mutedDark]}>
              Keep Wormhole open during the large model download.
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

        <Text style={[styles.sectionLabel, darkMode && styles.mutedDark]}>APPEARANCE</Text>
        <View style={[styles.card, styles.toggleRow, darkMode && styles.cardDark]}>
          <View style={styles.flex}>
            <Text style={[styles.cardTitle, darkMode && styles.textDark]}>Dark mode</Text>
            <Text style={[styles.cardCopy, darkMode && styles.mutedDark]}>
              Use a darker library and settings theme.
            </Text>
          </View>
          <Switch
            onValueChange={setDarkMode}
            thumbColor="#FFF9EF"
            trackColor={{false: '#B9B0A5', true: '#D76D45'}}
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
