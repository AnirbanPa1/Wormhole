import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  BackHandler,
  FlatList,
  type LayoutChangeEvent,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import {
  PdfView,
  type LoadCompleteEvent,
  type PdfViewProps,
} from 'react-native-pdf-light';
import { ZoomPdfView } from 'react-native-pdf-light/Zoom';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import { SafeAreaView } from 'react-native-safe-area-context';
import DictionarySheet from '../components/DictionarySheet';
import FloatingNavigationContainer, {
  useFloatingNavigationLayout,
} from '../components/FloatingNavigationContainer';
import TextLayerOverlay from '../components/TextLayerOverlay';
import {
  initDictionary,
  lookup,
  type DictionaryResult,
} from '../services/dictionary.service';
import { extractTextLayerPage } from '../services/pdf-text-extractor.service';
import { loadTextLayer, saveTextLayer } from '../storage/text-layers';
import { addCachedWord } from '../storage/word-cache';
import type { LibraryDocument } from '../types/library';
import type { TextLayer, TextLayerPage, WordBox } from '../types/text-layer';
import styles from './ReaderScreen.styles';

import { useKokoroTts } from '../features/tts/KokoroTtsProvider';
import {
  downloadKokoroModel,
  isKokoroModelMissingError,
  requestKokoroDownloadNotificationPermission,
  requestKokoroNotificationPermission,
} from '../features/tts/kokoro-client';
import { useAppSettings } from '../features/settings/AppSettingsProvider';
import { X } from 'lucide-react-native';

type ReaderScreenProps = {
  document: LibraryDocument;
  onBack: () => void;
  onOpenImmersive: () => void;
  onPageChange: (page: number) => void;
  onTextLayerReady: (id: string) => void;
};

const PAGE_SIDE_INSET = 10;
const PAGE_VERTICAL_INSET = 10;
const FALLBACK_PAGE_ASPECT = 612 / 792;

type PdfOverlayState = {
  page: TextLayerPage | null;
  onWordPress: (word: WordBox) => void;
  highlightedWordRange: { start: number; end: number } | null;
  scanning: boolean;
  selectedWord: WordBox | null;
  visible: boolean;
};

const PdfOverlayContext = React.createContext<PdfOverlayState | null>(null);

function PdfPageWithOverlay(props: PdfViewProps): React.JSX.Element {
  const overlay = React.useContext(PdfOverlayContext);
  const onLayout = props.onLayout;
  const onLoadComplete = props.onLoadComplete;
  const [pageAspect, setPageAspect] = useState(
    overlay?.page && overlay.page.pageHeight > 0
      ? overlay.page.pageWidth / overlay.page.pageHeight
      : FALLBACK_PAGE_ASPECT,
  );
  const [frameSize, setFrameSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (overlay?.page && overlay.page.pageHeight > 0) {
      setPageAspect(overlay.page.pageWidth / overlay.page.pageHeight);
    }
  }, [overlay?.page]);

  const handleLoadComplete = useCallback(
    (event: LoadCompleteEvent) => {
      if (event.width > 0 && event.height > 0) {
        setPageAspect(event.width / event.height);
      }
      onLoadComplete?.(event);
    },
    [onLoadComplete],
  );

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      const { width, height } = event.nativeEvent.layout;
      setFrameSize(current =>
        Math.abs(current.width - width) < 1 &&
        Math.abs(current.height - height) < 1
          ? current
          : { width, height },
      );
      onLayout?.(event);
    },
    [onLayout],
  );

  return (
    <View
      onLayout={handleLayout}
      style={[styles.pdfRenderedPage, { aspectRatio: pageAspect }]}
    >
      <PdfView
        {...props}
        onLayout={undefined}
        onLoadComplete={handleLoadComplete}
        style={styles.pdfPage}
      />
      {overlay && frameSize.width > 0 && frameSize.height > 0 && (
        <TextLayerOverlay
          frameHeight={frameSize.height}
          frameWidth={frameSize.width}
          highlightedWordRange={overlay.highlightedWordRange}
          onWordPress={overlay.onWordPress}
          page={overlay.page}
          scanning={overlay.scanning}
          selectedWord={overlay.selectedWord}
          visible={overlay.visible}
        />
      )}
    </View>
  );
}

function ReaderScreen({
  document,
  onBack,
  onOpenImmersive,
  onPageChange,
  onTextLayerReady,
}: ReaderScreenProps): React.JSX.Element {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isLandscape = windowWidth > windowHeight;
  const { obstructionHeight: navigationObstructionHeight } =
    useFloatingNavigationLayout();
  const pdfViewInsets = useMemo(
    () => ({
      top: PAGE_VERTICAL_INSET,
      right: PAGE_SIDE_INSET,
      bottom:
        PAGE_VERTICAL_INSET + (isLandscape ? navigationObstructionHeight : 0),
      left: PAGE_SIDE_INSET,
    }),
    [isLandscape, navigationObstructionHeight],
  );
  const [page, setPage] = useState(
    Math.min(document.currentPage, document.pageCount - 1),
  );
  const [stageSize, setStageSize] = useState({
    width: windowWidth,
    height: Math.max(180, windowHeight - 160),
  });
  const [zoomedPage, setZoomedPage] = useState<number | null>(null);
  const [modelInstalling, setModelInstalling] = useState(false);
  const pagerRef = useRef<FlatList<number>>(null);
  const scrollX = useRef(new Animated.Value(page * stageSize.width)).current;
  const previousPagerWidth = useRef(stageSize.width);
  const pages = useMemo(
    () => Array.from({ length: document.pageCount }, (_, index) => index),
    [document.pageCount],
  );
  const pagerWidth = Math.max(1, stageSize.width);
  const [layer, setLayer] = useState<TextLayer | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeWord, setActiveWord] = useState<WordBox | null>(null);
  const [dictionaryResult, setDictionaryResult] =
    useState<DictionaryResult | null>(null);

  const {
    status: ttsStatus,
    currentChunkStartWordIndex,
    currentChunkEndWordIndex,
    read,
    pause,
    resume,
    stop,
  } = useKokoroTts();
  const { voiceId, speed, immersiveMode, darkMode } = useAppSettings();

  const currentPageLayer = useMemo(
    () => layer?.pages.find(item => item.pageIndex === page) ?? null,
    [layer, page],
  );

  const currentPageText = useMemo(() => {
    if (!currentPageLayer?.hasText) {
      return '';
    }

    return currentPageLayer.words
      .map(word => word.text.trim())
      .filter(Boolean)
      .join(' ');
  }, [currentPageLayer]);

  const captureCurrentPage =
    useCallback(async (): Promise<TextLayerPage | null> => {
      const cachedPage = layer?.pages.find(item => item.pageIndex === page);
      if (cachedPage) {
        return cachedPage.hasText ? cachedPage : null;
      }

      if (extracting) {
        return null;
      }

      setExtracting(true);
      try {
        const extracted = await extractTextLayerPage(
          document.localUri,
          document.id,
          page,
        );
        const capturedPage = extracted.pages[0];
        if (!capturedPage?.hasText) {
          return null;
        }

        const merged: TextLayer = {
          documentId: document.id,
          extractedAt: extracted.extractedAt,
          pages: [
            ...(layer?.pages.filter(item => item.pageIndex !== page) ?? []),
            capturedPage,
          ].sort((a, b) => a.pageIndex - b.pageIndex),
        };
        await saveTextLayer(merged);
        setLayer(merged);
        onTextLayerReady(document.id);
        return capturedPage;
      } finally {
        setExtracting(false);
      }
    }, [
      document.id,
      document.localUri,
      extracting,
      layer,
      onTextLayerReady,
      page,
    ]);

  const handleNarration = useCallback(async () => {
    let textToRead = '';
    try {
      if (ttsStatus === 'playing') {
        await pause();
        return;
      }

      if (ttsStatus === 'paused') {
        await resume();
        if (immersiveMode) {
          onOpenImmersive();
        }
        return;
      }

      textToRead = currentPageText;
      if (!textToRead) {
        const capturedPage = await captureCurrentPage();
        textToRead =
          capturedPage?.words
            .map(word => word.text.trim())
            .filter(Boolean)
            .join(' ') ?? '';
      }

      if (!textToRead) {
        Alert.alert(
          'Page text unavailable',
          'Wormhole could not find selectable text on this page. It may be a scanned image.',
        );
        return;
      }

      await requestKokoroNotificationPermission();
      await read(textToRead, voiceId, speed, document.title);
      if (immersiveMode) {
        onOpenImmersive();
      }
    } catch (error) {
      if (isKokoroModelMissingError(error)) {
        const notificationsAllowed =
          await requestKokoroDownloadNotificationPermission();
        if (!notificationsAllowed) {
          return;
        }

        setModelInstalling(true);
        try {
          await downloadKokoroModel();
          await read(textToRead, voiceId, speed, document.title);
          if (immersiveMode) {
            onOpenImmersive();
          }
        } catch (downloadError) {
          Alert.alert(
            'Model download failed',
            downloadError instanceof Error
              ? downloadError.message
              : 'Check your connection and available storage, then try again.',
          );
        } finally {
          setModelInstalling(false);
        }
        return;
      }

      Alert.alert(
        'Narration unavailable',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [
    captureCurrentPage,
    currentPageText,
    document.title,
    pause,
    read,
    resume,
    immersiveMode,
    onOpenImmersive,
    ttsStatus,
    voiceId,
    speed,
  ]);

  useEffect(() => {
    stop();
  }, [document.id, page, stop]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  const exitSelectionMode = useCallback(() => {
    setSelectionMode(false);
    setSheetVisible(false);
    setActiveWord(null);
    setDictionaryResult(null);
  }, []);

  const handleBack = useCallback(() => {
    if (sheetVisible) {
      setSheetVisible(false);
      return;
    }
    if (selectionMode) {
      exitSelectionMode();
      return;
    }
    onBack();
  }, [exitSelectionMode, onBack, selectionMode, sheetVisible]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        handleBack();
        return true;
      },
    );
    return () => subscription.remove();
  }, [handleBack]);

  useEffect(() => {
    let cancelled = false;
    loadTextLayer(document.id).then(existing => {
      if (cancelled) {
        return;
      }
      if (existing) {
        setLayer(existing);
        onTextLayerReady(document.id);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [document.id]);

  const handleStageLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setStageSize(current =>
      Math.abs(current.width - width) < 1 &&
      Math.abs(current.height - height) < 1
        ? current
        : { width, height },
    );
  }, []);

  useEffect(() => {
    if (Math.abs(previousPagerWidth.current - pagerWidth) < 1) {
      return;
    }

    previousPagerWidth.current = pagerWidth;
    setZoomedPage(null);
    scrollX.setValue(page * pagerWidth);
    const frame = requestAnimationFrame(() => {
      pagerRef.current?.scrollToOffset({
        offset: page * pagerWidth,
        animated: false,
      });
    });
    return () => cancelAnimationFrame(frame);
  }, [page, pagerWidth, scrollX]);

  const toggleWordCapture = useCallback(async () => {
    if (extracting) {
      return;
    }

    if (selectionMode) {
      exitSelectionMode();
      return;
    }

    setSelectionMode(true);
    setSheetVisible(false);
    setActiveWord(null);
    setDictionaryResult(null);

    const cachedPage = layer?.pages.find(item => item.pageIndex === page);
    if (cachedPage) {
      if (!cachedPage.hasText) {
        setSelectionMode(false);
        Alert.alert(
          'No text found',
          'This page has no selectable text. It may be a scanned image page.',
        );
      }
      return;
    }

    try {
      const capturedPage = await captureCurrentPage();
      if (!capturedPage?.hasText) {
        setSelectionMode(false);
        Alert.alert(
          'No text found',
          'This page has no selectable text. It may be a scanned image page.',
        );
      }
    } catch (error) {
      setSelectionMode(false);
      Alert.alert(
        'Page capture failed',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [
    captureCurrentPage,
    extracting,
    exitSelectionMode,
    layer,
    page,
    selectionMode,
  ]);

  const handleWordPress = useCallback(async (word: WordBox) => {
    await initDictionary();
    const result = lookup(word.text);
    setActiveWord(word);
    setDictionaryResult(result);
    setSheetVisible(true);
    addCachedWord(word.text, result).catch(() => undefined);
  }, []);

  const goToPage = useCallback(
    (nextPage: number) => {
      if (nextPage < 0 || nextPage >= document.pageCount) {
        return;
      }
      pagerRef.current?.scrollToIndex({ index: nextPage, animated: true });
    },
    [document.pageCount],
  );

  const landscapePageGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isLandscape && !selectionMode && zoomedPage === null)
        .maxPointers(1)
        .activeOffsetX([-24, 24])
        .failOffsetY([-18, 18])
        .runOnJS(true)
        .onEnd(event => {
          const projectedDistance = event.translationX + event.velocityX * 0.12;
          if (projectedDistance <= -72) {
            goToPage(page + 1);
          } else if (projectedDistance >= 72) {
            goToPage(page - 1);
          }
        }),
    [goToPage, isLandscape, page, selectionMode, zoomedPage],
  );

  const handlePageSettled = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const nextPage = Math.max(
        0,
        Math.min(
          document.pageCount - 1,
          Math.round(event.nativeEvent.contentOffset.x / pagerWidth),
        ),
      );
      if (nextPage !== page) {
        setPage(nextPage);
        onPageChange(nextPage);
      }
    },
    [document.pageCount, onPageChange, page, pagerWidth],
  );

  const renderPage = useCallback(
    ({ item: pageNumber }: { item: number }) => {
      const inputRange = [
        (pageNumber - 1) * pagerWidth,
        pageNumber * pagerWidth,
        (pageNumber + 1) * pagerWidth,
      ];
      const animatedStyle = {
        opacity: scrollX.interpolate({
          inputRange,
          outputRange: [0.2, 1, 0.2],
          extrapolate: 'clamp' as const,
        }),
        transform: [
          { perspective: 1100 },
          {
            rotateY: scrollX.interpolate({
              inputRange,
              outputRange: ['68deg', '0deg', '-68deg'],
              extrapolate: 'clamp',
            }),
          },
        ],
      };
      const pageLayer =
        layer?.pages.find(p => p.pageIndex === pageNumber) ?? null;

      return (
        <View style={[styles.pageSlot, { width: pagerWidth }]}>
          <Animated.View
            style={[
              styles.pageFrame,
              darkMode && styles.pageFrameDark,
              { width: pagerWidth, height: stageSize.height },
              animatedStyle,
            ]}
          >
            <PdfOverlayContext.Provider
              value={{
                page: pageLayer,
                onWordPress: handleWordPress,
                highlightedWordRange:
                  pageNumber === page &&
                  (ttsStatus === 'playing' || ttsStatus === 'paused') &&
                  currentChunkStartWordIndex >= 0 &&
                  currentChunkEndWordIndex >= currentChunkStartWordIndex
                    ? {
                        start: currentChunkStartWordIndex,
                        end: currentChunkEndWordIndex,
                      }
                    : null,
                scanning: extracting && pageNumber === page,
                selectedWord: pageNumber === page ? activeWord : null,
                visible:
                  zoomedPage === null && selectionMode && pageNumber === page,
              }}
            >
              <ZoomPdfView
                insets={pdfViewInsets}
                maximumZoom={3}
                onError={event => Alert.alert('PDF error', event.message)}
                onZoomIn={() => {
                  setZoomedPage(pageNumber);
                }}
                onZoomReset={() => {
                  setZoomedPage(current =>
                    current === pageNumber ? null : current,
                  );
                }}
                page={pageNumber}
                renderComponent={PdfPageWithOverlay}
                resizeMode={isLandscape ? 'fitWidth' : 'contain'}
                source={document.localUri}
              />
            </PdfOverlayContext.Provider>
          </Animated.View>
        </View>
      );
    },
    [
      activeWord,
      document.localUri,
      darkMode,
      extracting,
      handleWordPress,
      currentChunkEndWordIndex,
      currentChunkStartWordIndex,
      layer,
      isLandscape,
      page,
      pagerWidth,
      pdfViewInsets,
      selectionMode,
      stageSize.height,
      ttsStatus,
      scrollX,
      zoomedPage,
    ],
  );

  return (
    <SafeAreaView style={styles.readerSafeArea}>
      <View style={styles.reader}>
        <View style={styles.readerTopBar}>
          <Pressable
            accessibilityLabel="Back"
            onPress={handleBack}
            style={styles.iconButton}
          >
            <Text style={styles.iconButtonText}>‹</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.readerTitle}>
            {document.title}
          </Text>
          <Pressable
            accessibilityLabel={
              ttsStatus === 'playing'
                ? 'Pause narration'
                : ttsStatus === 'paused'
                ? 'Resume narration'
                : 'Read this page'
            }
            disabled={
              extracting ||
              modelInstalling ||
              ttsStatus === 'initializing' ||
              ttsStatus === 'preparing'
            }
            onPress={handleNarration}
            style={[
              styles.narrationButton,
              (ttsStatus === 'playing' || ttsStatus === 'paused') &&
                styles.narrationButtonActive,
            ]}
          >
            {extracting ||
            modelInstalling ||
            ttsStatus === 'initializing' ||
            ttsStatus === 'preparing' ? (
              <ActivityIndicator size="small" color="#171614" />
            ) : (
              <Text style={styles.narrationButtonText}>
                {ttsStatus === 'playing' ? 'Ⅱ' : '▶'}
              </Text>
            )}
          </Pressable>
          {(ttsStatus === 'playing' ||
            ttsStatus === 'paused' ||
            ttsStatus === 'preparing') && (
            <Pressable
              accessibilityLabel="Open immersive listening mode"
              onPress={onOpenImmersive}
              style={styles.immersiveButton}
            >
              <Text style={styles.immersiveButtonText}>♪</Text>
            </Pressable>
          )}
          <Pressable
            accessibilityLabel={
              selectionMode
                ? 'Exit word selection'
                : 'Capture words on this page'
            }
            disabled={extracting || zoomedPage !== null}
            onPress={toggleWordCapture}
            style={[
              styles.analyzeButton,
              selectionMode && styles.analyzeButtonActive,
            ]}
          >
            {extracting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : selectionMode ? (
              <X color="#171614" size={18} strokeWidth={2.5} />
            ) : (
              <View style={styles.captureGlyph}>
                <View
                  style={[styles.captureCorner, styles.captureCornerTopLeft]}
                />
                <View
                  style={[styles.captureCorner, styles.captureCornerTopRight]}
                />
                <View
                  style={[styles.captureCorner, styles.captureCornerBottomLeft]}
                />
                <View
                  style={[
                    styles.captureCorner,
                    styles.captureCornerBottomRight,
                  ]}
                />
              </View>
            )}
          </Pressable>
        </View>

        <View
          onLayout={handleStageLayout}
          style={[styles.readerStage, darkMode && styles.readerStageDark]}
        >
          <GestureDetector gesture={landscapePageGesture}>
            <Animated.View style={[styles.pager, darkMode && styles.pagerDark]}>
              <Animated.FlatList
                data={pages}
                decelerationRate="fast"
                disableIntervalMomentum
                getItemLayout={(_, index) => ({
                  length: pagerWidth,
                  offset: pagerWidth * index,
                  index,
                })}
                horizontal
                initialNumToRender={3}
                initialScrollIndex={page}
                keyExtractor={item => String(item)}
                maxToRenderPerBatch={3}
                onMomentumScrollEnd={handlePageSettled}
                onScroll={Animated.event(
                  [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                  { useNativeDriver: true },
                )}
                onScrollToIndexFailed={info =>
                  pagerRef.current?.scrollToOffset({
                    offset: info.index * pagerWidth,
                    animated: false,
                  })
                }
                pagingEnabled
                ref={pagerRef}
                renderItem={renderPage}
                scrollEnabled={
                  !isLandscape && !selectionMode && zoomedPage === null
                }
                scrollEventThrottle={16}
                showsHorizontalScrollIndicator={false}
                style={[styles.pager, darkMode && styles.pagerDark]}
                windowSize={5}
              />
            </Animated.View>
          </GestureDetector>
        </View>

        <FloatingNavigationContainer
          pointerEvents={selectionMode ? 'none' : 'auto'}
          style={selectionMode && styles.hidden}
        >
          <Pressable
            accessibilityLabel="Previous page"
            disabled={page === 0}
            onPress={() => goToPage(page - 1)}
            style={[styles.pageButton, page === 0 && styles.disabledButton]}
          >
            <ChevronLeft color="#171614" size={24} strokeWidth={2.25} />
          </Pressable>
          <View style={styles.pageCounter}>
            <Text
              style={[
                styles.pageCounterText,
                darkMode && styles.pageCounterTextDark,
              ]}
            >
              {page + 1} / {document.pageCount}
            </Text>
            <View style={styles.readerProgressTrack}>
              <View
                style={[
                  styles.readerProgressFill,
                  { width: `${((page + 1) / document.pageCount) * 100}%` },
                ]}
              />
            </View>
          </View>
          <Pressable
            accessibilityLabel="Next page"
            disabled={page >= document.pageCount - 1}
            onPress={() => goToPage(page + 1)}
            style={[
              styles.pageButton,
              page >= document.pageCount - 1 && styles.disabledButton,
            ]}
          >
            <ChevronRight color="#171614" size={24} strokeWidth={2.25} />
          </Pressable>
        </FloatingNavigationContainer>
      </View>

      <DictionarySheet
        onClose={() => setSheetVisible(false)}
        result={dictionaryResult}
        visible={sheetVisible}
        word={activeWord?.text ?? null}
      />
    </SafeAreaView>
  );
}

export default ReaderScreen;
