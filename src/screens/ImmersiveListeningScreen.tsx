import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  Easing,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {KOKORO_VOICES, useAppSettings} from '../features/settings/AppSettingsProvider';
import {getPlaybackPosition} from '../features/tts/kokoro-client';
import {useKokoroTts} from '../features/tts/KokoroTtsProvider';
import {chunkTextForSpeech} from '../features/tts/tts-text-chunker';
import type {LibraryDocument} from '../types/library';
import styles from './ImmersiveListeningScreen.styles';

type ImmersiveListeningScreenProps = {
  document: LibraryDocument;
  onClose(): void;
};

const WAVEFORM = [
  10, 18, 26, 15, 35, 23, 42, 29, 17, 38, 48, 31, 20, 43, 34, 16, 28,
  46, 37, 22, 14, 32, 44, 25, 18, 36, 29, 13, 24, 39, 20,
];

// Temporarily hidden while the immersive playback UI is being refined.
const SHOW_PROGRESS_VISUALS = false;
const SHOW_PLAYBACK_TIMERS = false;

function formatTime(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function ImmersiveListeningScreen({
  document,
  onClose,
}: ImmersiveListeningScreenProps): React.JSX.Element {
  const {voiceId, speed, darkMode} = useAppSettings();
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
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [waveformWidth, setWaveformWidth] = useState(0);
  const animatedProgress = useRef(new Animated.Value(0)).current;

  const chunks = useMemo(
    () => chunkTextForSpeech(narrationText, {maxCharacters: 160}),
    [narrationText],
  );
  const activeIndex = Math.max(0, currentChunk - 1);
  const activeText =
    currentChunkText || chunks[activeIndex]?.text || 'Preparing your page...';
  const previousText = activeIndex > 0 ? chunks[activeIndex - 1]?.text : null;
  const nextText = chunks[activeIndex + 1]?.text ?? null;
  const animatedProgressWidth = animatedProgress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });
  const voice = KOKORO_VOICES.find(item => item.id === voiceId);
  const busy = status === 'initializing' || status === 'preparing';
  const canSkip = status === 'playing' || status === 'paused';

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      onClose();
      return true;
    });
    return () => subscription.remove();
  }, [onClose]);

  useEffect(() => {
    animatedProgress.stopAnimation();
    animatedProgress.setValue(0);
    setPositionMs(0);
    setDurationMs(0);
  }, [animatedProgress, currentChunk]);

  useEffect(() => {
    if (status !== 'playing' && status !== 'paused') {
      return;
    }

    let cancelled = false;
    const refresh = () => {
      getPlaybackPosition()
        .then(position => {
          if (!cancelled) {
            setPositionMs(position.positionMs);
            setDurationMs(position.durationMs);

            const nextProgress =
              position.durationMs > 0
                ? Math.max(
                    0,
                    Math.min(1, position.positionMs / position.durationMs),
                  )
                : 0;
            animatedProgress.stopAnimation();
            Animated.timing(animatedProgress, {
              toValue: nextProgress,
              duration: status === 'playing' ? 420 : 120,
              easing: Easing.linear,
              useNativeDriver: false,
            }).start();
          }
        })
        .catch(() => undefined);
    };
    refresh();
    const timer = setInterval(refresh, 400);
    return () => {
      cancelled = true;
      clearInterval(timer);
      animatedProgress.stopAnimation();
    };
  }, [animatedProgress, status, currentChunk]);

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
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Return to reader"
          onPress={onClose}
          style={[styles.headerButton, darkMode && styles.headerButtonDark]}>
          <Text style={[styles.headerButtonText, darkMode && styles.headerButtonTextDark]}>‹</Text>
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>IMMERSIVE MODE</Text>
          <Text style={[styles.headerTitle, darkMode && styles.textDark]}>
            Listening to a book
          </Text>
        </View>
        <View style={[styles.pageBadge, darkMode && styles.pageBadgeDark]}>
          <Text style={[styles.pageBadgeText, darkMode && styles.pageBadgeTextDark]}>
            {document.currentPage + 1}
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.coverScene}>
          <View style={styles.accentOrb} />
          <View style={[styles.coverShadow, darkMode && styles.coverShadowDark]} />
          <View style={[styles.cover, darkMode && styles.coverDark]}>
            <Text style={styles.coverMark}>WORMHOLE</Text>
            <View style={styles.coverRule} />
            <Text numberOfLines={5} style={styles.coverTitle}>{document.title}</Text>
            <Text style={styles.coverPage}>PAGE {document.currentPage + 1}</Text>
          </View>
        </View>

        <Text
          numberOfLines={2}
          style={[styles.bookTitle, darkMode && styles.textDark]}>
          {document.title}
        </Text>
        <Text style={[styles.narratorMeta, darkMode && styles.mutedDark]}>
          {voice?.name ?? 'Kokoro'} · {speed}x · Offline
        </Text>

        <View style={styles.transcript}>
          {previousText && (
            <Text
              numberOfLines={2}
              style={[styles.contextText, darkMode && styles.contextTextDark]}>
              {previousText}
            </Text>
          )}
          <View style={styles.activeTextWrap}>
            <View style={styles.activeTextAccent} />
            <Text style={[styles.activeText, darkMode && styles.textDark]}>
              {error || activeText}
            </Text>
          </View>
          {nextText && (
            <Text
              numberOfLines={2}
              style={[styles.contextText, darkMode && styles.contextTextDark]}>
              {nextText}
            </Text>
          )}
        </View>

        {SHOW_PROGRESS_VISUALS && (
          <View
            onLayout={event => setWaveformWidth(event.nativeEvent.layout.width)}
            style={styles.waveformShell}>
            <View style={styles.waveform}>
              {WAVEFORM.map((height, index) => (
                <View
                  key={`${height}-${index}`}
                  style={[
                    styles.waveBar,
                    darkMode && styles.waveBarDark,
                    {height},
                  ]}
                />
              ))}
            </View>
            <Animated.View
              pointerEvents="none"
              style={[
                styles.waveformProgressClip,
                {width: animatedProgressWidth},
              ]}>
              <View style={[styles.waveformProgress, {width: waveformWidth}]}>
                {WAVEFORM.map((height, index) => (
                  <View
                    key={`active-${height}-${index}`}
                    style={[styles.waveBar, styles.waveBarActive, {height}]}
                  />
                ))}
              </View>
            </Animated.View>
          </View>
        )}

        <View
          style={[
            styles.timeRow,
            !SHOW_PLAYBACK_TIMERS && styles.timeRowCentered,
          ]}>
          {SHOW_PLAYBACK_TIMERS && (
            <Text style={[styles.timeText, darkMode && styles.mutedDark]}>
              {formatTime(positionMs)}
            </Text>
          )}
          <Text style={[styles.chunkText, darkMode && styles.textDark]}>
            {totalChunks > 0 ? `${currentChunk} / ${totalChunks}` : 'Preparing'}
          </Text>
          {SHOW_PLAYBACK_TIMERS && (
            <Text style={[styles.timeText, darkMode && styles.mutedDark]}>
              {formatTime(durationMs)}
            </Text>
          )}
        </View>
        {SHOW_PROGRESS_VISUALS && (
          <View
            style={[
              styles.progressTrack,
              darkMode && styles.progressTrackDark,
            ]}>
            <Animated.View
              style={[styles.progressFill, {width: animatedProgressWidth}]}
            />
          </View>
        )}

        <View style={styles.controls}>
          <Pressable
            accessibilityLabel="Previous narration chunk"
            disabled={!canSkip || currentChunk <= 1}
            onPress={previousChunk}
            style={[styles.skipButton, (!canSkip || currentChunk <= 1) && styles.disabled]}>
            <Text style={[styles.skipText, darkMode && styles.textDark]}>|‹</Text>
          </Pressable>
          <Pressable
            accessibilityLabel={status === 'playing' ? 'Pause narration' : 'Resume narration'}
            disabled={busy || (status !== 'playing' && status !== 'paused')}
            onPress={togglePlayback}
            style={[
              styles.playButton,
              darkMode && styles.playButtonDark,
              busy && styles.playButtonBusy,
            ]}>
            {busy ? (
              <ActivityIndicator color="#171614" />
            ) : (
              <Text style={[styles.playText, darkMode && styles.playTextDark]}>
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
            ]}>
            <Text style={[styles.skipText, darkMode && styles.textDark]}>›|</Text>
          </Pressable>
        </View>

        {(status === 'playing' || status === 'paused') && (
          <Pressable
            accessibilityLabel="Stop narration"
            onPress={() => {
              stop();
              onClose();
            }}
            style={styles.stopButton}>
            <Text style={[styles.stopText, darkMode && styles.mutedDark]}>
              STOP NARRATION
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default ImmersiveListeningScreen;
