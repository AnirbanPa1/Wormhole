import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
import {ZoomPdfView} from 'react-native-pdf-light/Zoom';
import {SafeAreaView} from 'react-native-safe-area-context';
import {loadTextLayer, saveTextLayer} from '../storage/text-layers';
import {addCachedWord} from '../storage/word-cache';
import {extractTextLayerPage} from '../services/pdf-text-extractor.service';
import {
  initDictionary,
  lookup,
  type DictionaryResult,
} from '../services/dictionary.service';
import TextLayerOverlay from '../components/TextLayerOverlay';
import DictionarySheet from '../components/DictionarySheet';
import {colors} from '../constants/theme';
import styles from './ReaderScreen.styles';
import type {LibraryDocument} from '../types/library';
import type {TextLayer, WordBox} from '../types/text-layer';

interface ReaderScreenProps {
  document: LibraryDocument;
  onBack: () => void;
  onPageChange: (page: number) => void;
  onTextLayerReady: (id: string) => void;
}

function ReaderScreen({
  document,
  onBack,
  onPageChange,
  onTextLayerReady,
}: ReaderScreenProps): React.JSX.Element {
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const [page, setPage] = useState(
    Math.min(document.currentPage, document.pageCount - 1),
  );
  const [stageSize, setStageSize] = useState({
    width: windowWidth,
    height: Math.max(180, windowHeight - 160),
  });
  const [zoomedPage, setZoomedPage] = useState<number | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const pagerRef = useRef<FlatList<number>>(null);
  const scrollX = useRef(new Animated.Value(page * stageSize.width)).current;
  const previousPagerWidth = useRef(stageSize.width);
  const pages = useMemo(
    () => Array.from({length: document.pageCount}, (_, index) => index),
    [document.pageCount],
  );
  const pagerWidth = Math.max(1, stageSize.width);
  const pageWidth = Math.max(1, Math.min(pagerWidth - 28, 720));
  const pageHeight = Math.max(180, stageSize.height - 12);

  const [layer, setLayer] = useState<TextLayer | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [activeWord, setActiveWord] = useState<WordBox | null>(null);
  const [dictionaryResult, setDictionaryResult] =
    useState<DictionaryResult | null>(null);

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

  // Restore an already-extracted text layer for this document on open.
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
    const {width, height} = event.nativeEvent.layout;
    setStageSize(current =>
      Math.abs(current.width - width) < 1 && Math.abs(current.height - height) < 1
        ? current
        : {width, height},
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

    setControlsVisible(true);
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

    setExtracting(true);
    try {
      const extracted = await extractTextLayerPage(
        document.localUri,
        document.id,
        page,
      );
      const capturedPage = extracted.pages[0];
      if (capturedPage?.hasText) {
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
      } else {
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
    } finally {
      setExtracting(false);
    }
  }, [
    document.id,
    document.localUri,
    extracting,
    exitSelectionMode,
    layer,
    onTextLayerReady,
    page,
    selectionMode,
  ]);

  const handleWordPress = useCallback(
    async (word: WordBox) => {
      await initDictionary();
      const result = lookup(word.text);
      setActiveWord(word);
      setDictionaryResult(result);
      setSheetVisible(true);
      addCachedWord(word.text, result).catch(() => undefined);
    },
    [],
  );

  const goToPage = useCallback(
    (nextPage: number) => {
      if (nextPage < 0 || nextPage >= document.pageCount) {
        return;
      }
      pagerRef.current?.scrollToIndex({index: nextPage, animated: true});
    },
    [document.pageCount],
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
    ({item: pageNumber}: {item: number}) => {
      const inputRange = [
        (pageNumber - 1) * pagerWidth,
        pageNumber * pagerWidth,
        (pageNumber + 1) * pagerWidth,
      ];
      const animatedStyle = {
        opacity: scrollX.interpolate({
          inputRange,
          outputRange: [0.14, 1, 0.14],
          extrapolate: 'clamp' as const,
        }),
        transform: [
          {perspective: 1100},
          {
            translateX: scrollX.interpolate({
              inputRange,
              outputRange: [pagerWidth * 0.38, 0, pagerWidth * -0.38],
              extrapolate: 'clamp',
            }),
          },
          {
            rotateY: scrollX.interpolate({
              inputRange,
              outputRange: ['78deg', '0deg', '-78deg'],
              extrapolate: 'clamp',
            }),
          },
          {
            scale: scrollX.interpolate({
              inputRange,
              outputRange: [0.97, 1, 0.97],
              extrapolate: 'clamp',
            }),
          },
        ],
      };
      const pageLayer = layer?.pages.find(p => p.pageIndex === pageNumber) ?? null;
      return (
        <View style={[styles.pageSlot, {width: pagerWidth}]}>
          <Animated.View
            style={[
              styles.pageFrame,
              {width: pageWidth, height: pageHeight},
              animatedStyle,
            ]}>
            <ZoomPdfView
              maximumZoom={3}
              onError={event => Alert.alert('PDF error', event.message)}
              onZoomIn={() => {
                setZoomedPage(pageNumber);
                setControlsVisible(false);
              }}
              onZoomReset={() => {
                setZoomedPage(current =>
                  current === pageNumber ? null : current,
                );
                setControlsVisible(true);
              }}
              page={pageNumber}
              resizeMode="contain"
              source={document.localUri}
              style={styles.pdfPage}
            />
            <TextLayerOverlay
              frameHeight={pageHeight}
              frameWidth={pageWidth}
              onWordPress={handleWordPress}
              page={pageLayer}
              scanning={extracting && pageNumber === page}
              selectedWord={pageNumber === page ? activeWord : null}
              visible={selectionMode && pageNumber === page}
            />
            <View pointerEvents="none" style={styles.pageEdgeLeft} />
          </Animated.View>
        </View>
      );
    },
    [
      activeWord,
      document.localUri,
      extracting,
      handleWordPress,
      layer,
      page,
      pageHeight,
      pageWidth,
      pagerWidth,
      selectionMode,
      scrollX,
    ],
  );

  return (
    <SafeAreaView style={styles.readerSafeArea}>
      <View style={styles.reader}>
        <View style={[styles.readerTopBar, !controlsVisible && styles.hidden]}>
          <Pressable accessibilityLabel="Back" onPress={handleBack} style={styles.iconButton}>
            <Text style={styles.iconButtonText}>‹</Text>
          </Pressable>
          <Text numberOfLines={1} style={styles.readerTitle}>
            {document.title}
          </Text>
          <Pressable
            accessibilityLabel={
              selectionMode ? 'Exit word selection' : 'Capture words on this page'
            }
            disabled={extracting || zoomedPage !== null}
            onPress={toggleWordCapture}
            style={[
              styles.analyzeButton,
              selectionMode && styles.analyzeButtonActive,
            ]}>
            {extracting ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : selectionMode ? (
              <Text style={styles.analyzeButtonText}>X</Text>
            ) : (
              <View style={styles.captureGlyph}>
                <View style={[styles.captureCorner, styles.captureCornerTopLeft]} />
                <View style={[styles.captureCorner, styles.captureCornerTopRight]} />
                <View style={[styles.captureCorner, styles.captureCornerBottomLeft]} />
                <View style={[styles.captureCorner, styles.captureCornerBottomRight]} />
              </View>
            )}
          </Pressable>
        </View>

        <View onLayout={handleStageLayout} style={styles.readerStage}>
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
            key={`reader-pager-${Math.round(pagerWidth)}`}
            keyExtractor={item => String(item)}
            maxToRenderPerBatch={3}
            onMomentumScrollEnd={handlePageSettled}
            onScroll={Animated.event(
              [{nativeEvent: {contentOffset: {x: scrollX}}}],
              {useNativeDriver: true},
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
            scrollEnabled={!selectionMode && zoomedPage === null}
            scrollEventThrottle={16}
            showsHorizontalScrollIndicator={false}
            style={styles.pager}
            windowSize={5}
          />
        </View>

        <View
          pointerEvents={selectionMode ? 'none' : 'auto'}
          style={[
            styles.readerControls,
            (!controlsVisible || selectionMode) && styles.hidden,
          ]}>
          <Pressable
            accessibilityLabel="Previous page"
            disabled={page === 0}
            onPress={() => goToPage(page - 1)}
            style={[styles.pageButton, page === 0 && styles.disabledButton]}>
            <Text style={styles.pageButtonText}>‹</Text>
          </Pressable>
          <View style={styles.pageCounter}>
            <Text style={styles.pageCounterText}>{page + 1} / {document.pageCount}</Text>
            <View style={styles.readerProgressTrack}>
              <View style={[styles.readerProgressFill, {width: `${((page + 1) / document.pageCount) * 100}%`}]} />
            </View>
          </View>
          <Pressable
            accessibilityLabel="Next page"
            disabled={page >= document.pageCount - 1}
            onPress={() => goToPage(page + 1)}
            style={[styles.pageButton, page >= document.pageCount - 1 && styles.disabledButton]}>
            <Text style={styles.pageButtonText}>›</Text>
          </Pressable>
        </View>
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
