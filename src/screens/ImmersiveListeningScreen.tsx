import React, { useCallback, useEffect, useMemo } from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import GoldGradientBackground from '../components/GoldGradientBackground';
import {
  KOKORO_VOICES,
  useAppSettings,
} from '../features/settings/AppSettingsProvider';
import { useKokoroTts } from '../features/tts/KokoroTtsProvider';
import {
  chunkTextForSpeech,
  NARRATION_CHUNK_MAX_CHARACTERS,
} from '../features/tts/tts-text-chunker';
import type { LibraryDocument } from '../types/library';
import styles from './ImmersiveListeningScreen.styles';

type ImmersiveListeningScreenProps = {
  document: LibraryDocument;
  onClose(): void;
};

function ImmersiveListeningScreen({
  document,
  onClose,
}: ImmersiveListeningScreenProps): React.JSX.Element {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const { voiceId, speed, darkMode } = useAppSettings();
  const {
    status,
    currentChunk,
    totalChunks,
    currentChunkText,
    narrationText,
    error,
    pause,
    resume,
    previousChunk,
    nextChunk,
    stop,
  } = useKokoroTts();
  const chunks = useMemo(
    () =>
      chunkTextForSpeech(narrationText, {
        maxCharacters: NARRATION_CHUNK_MAX_CHARACTERS,
      }),
    [narrationText],
  );
  const activeIndex = Math.max(0, currentChunk - 1);
  const activeText =
    currentChunkText || chunks[activeIndex]?.text || 'Preparing your page...';
  const previousText = activeIndex > 0 ? chunks[activeIndex - 1]?.text : null;
  const nextText = chunks[activeIndex + 1]?.text ?? null;
  const voice = KOKORO_VOICES.find(item => item.id === voiceId);
  const busy = status === 'initializing' || status === 'preparing';
  const canSkip = status === 'playing' || status === 'paused';

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        onClose();
        return true;
      },
    );
    return () => subscription.remove();
  }, [onClose]);

  const togglePlayback = useCallback(async () => {
    try {
      if (status === 'playing') {
        await pause();
      } else if (status === 'paused') {
        await resume();
      }
    } catch (playbackError) {
      Alert.alert(
        'Playback unavailable',
        playbackError instanceof Error
          ? playbackError.message
          : 'Please return to the reader and try again.',
      );
    }
  }, [pause, resume, status]);

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <View style={[styles.header, isLandscape && styles.headerLandscape]}>
        <Pressable
          accessibilityLabel="Return to reader"
          onPress={onClose}
          style={[styles.headerButton, darkMode && styles.headerButtonDark]}
        >
          <Text
            style={[
              styles.headerButtonText,
              darkMode && styles.headerButtonTextDark,
            ]}
          >
            ‹
          </Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>IMMERSIVE MODE</Text>
          <Text style={[styles.headerTitle, darkMode && styles.textDark]}>
            Listening to a book
          </Text>
        </View>
        <View style={[styles.pageBadge, darkMode && styles.pageBadgeDark]}>
          {darkMode && <GoldGradientBackground borderRadius={21} />}
          <Text
            style={[styles.pageBadgeText, darkMode && styles.pageBadgeTextDark]}
          >
            {document.currentPage + 1}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          isLandscape && styles.contentLandscape,
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.listeningBody,
            isLandscape && styles.listeningBodyLandscape,
          ]}
        >
          <View
            style={[
              styles.visualColumn,
              isLandscape && styles.visualColumnLandscape,
            ]}
          >
            <View
              style={[
                styles.coverScene,
                isLandscape && styles.coverSceneLandscape,
              ]}
            >
              <View style={styles.accentOrb}>
                <GoldGradientBackground borderRadius={31} />
              </View>
              <View
                style={[
                  styles.coverShadow,
                  isLandscape && styles.coverShadowLandscape,
                  darkMode && styles.coverShadowDark,
                ]}
              />
              <View
                style={[
                  styles.cover,
                  isLandscape && styles.coverLandscape,
                  darkMode && styles.coverDark,
                ]}
              >
                <Text style={styles.coverMark}>WORMHOLE</Text>
                <View style={styles.coverRule} />
                <Text numberOfLines={5} style={styles.coverTitle}>
                  {document.title}
                </Text>
                <Text style={styles.coverPage}>
                  PAGE {document.currentPage + 1}
                </Text>
              </View>
            </View>

            <Text
              numberOfLines={2}
              style={[
                styles.bookTitle,
                isLandscape && styles.bookTitleLandscape,
                darkMode && styles.textDark,
              ]}
            >
              {document.title}
            </Text>
            <Text style={[styles.narratorMeta, darkMode && styles.mutedDark]}>
              {voice?.name ?? 'Kokoro'} · {speed}x · Offline
            </Text>
          </View>
          <View
            style={[
              styles.playbackColumn,
              isLandscape && styles.playbackColumnLandscape,
            ]}
          >
            <View
              style={[
                styles.transcript,
                isLandscape && styles.transcriptLandscape,
              ]}
            >
              {previousText && (
                <Text
                  numberOfLines={isLandscape ? 1 : 2}
                  style={[
                    styles.contextText,
                    darkMode && styles.contextTextDark,
                  ]}
                >
                  {previousText}
                </Text>
              )}
              <View style={styles.activeTextWrap}>
                <View style={styles.activeTextAccent} />
                <Text
                  numberOfLines={isLandscape ? 4 : undefined}
                  style={[styles.activeText, darkMode && styles.textDark]}
                >
                  {error || activeText}
                </Text>
              </View>
              {nextText && (
                <Text
                  numberOfLines={isLandscape ? 1 : 2}
                  style={[
                    styles.contextText,
                    darkMode && styles.contextTextDark,
                  ]}
                >
                  {nextText}
                </Text>
              )}
            </View>

            <View style={styles.chunkRow}>
              <Text style={[styles.chunkText, darkMode && styles.textDark]}>
                {totalChunks > 0
                  ? `${currentChunk} / ${totalChunks}`
                  : 'Preparing'}
              </Text>
            </View>

            <View
              style={[styles.controls, isLandscape && styles.controlsLandscape]}
            >
              <Pressable
                accessibilityLabel="Previous narration chunk"
                disabled={!canSkip || currentChunk <= 1}
                onPress={previousChunk}
                style={[
                  styles.skipButton,
                  (!canSkip || currentChunk <= 1) && styles.disabled,
                ]}
              >
                <Text style={[styles.skipText, darkMode && styles.textDark]}>
                  |‹
                </Text>
              </Pressable>
              <Pressable
                accessibilityLabel={
                  status === 'playing' ? 'Pause narration' : 'Resume narration'
                }
                disabled={busy || (status !== 'playing' && status !== 'paused')}
                onPress={togglePlayback}
                style={[
                  styles.playButton,
                  darkMode && styles.playButtonDark,
                  busy && styles.playButtonBusy,
                ]}
              >
                {(darkMode || busy) && (
                  <GoldGradientBackground borderRadius={24} />
                )}
                {busy ? (
                  <ActivityIndicator color="#171614" />
                ) : (
                  <Text
                    style={[styles.playText, darkMode && styles.playTextDark]}
                  >
                    {status === 'playing' ? 'Ⅱ' : '▶'}
                  </Text>
                )}
              </Pressable>
              <Pressable
                accessibilityLabel="Next narration chunk"
                disabled={!canSkip || currentChunk >= totalChunks}
                onPress={nextChunk}
                style={[
                  styles.skipButton,
                  (!canSkip || currentChunk >= totalChunks) && styles.disabled,
                ]}
              >
                <Text style={[styles.skipText, darkMode && styles.textDark]}>
                  ›|
                </Text>
              </Pressable>
            </View>

            {(status === 'playing' || status === 'paused') && (
              <Pressable
                accessibilityLabel="Stop narration"
                onPress={() => {
                  stop();
                  onClose();
                }}
                style={styles.stopButton}
              >
                <Text style={[styles.stopText, darkMode && styles.mutedDark]}>
                  STOP NARRATION
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

export default ImmersiveListeningScreen;
