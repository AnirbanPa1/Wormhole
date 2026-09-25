import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextLayerPage, WordBox } from '../types/text-layer';

interface TextLayerOverlayProps {
  page: TextLayerPage | null;
  /** Width of the rendered page frame (px). */
  frameWidth: number;
  /** Height of the rendered page frame (px). */
  frameHeight: number;
  /** Horizontal inset used by the PDF zoom surface at its resting scale. */
  horizontalInset?: number;
  /** Vertical inset used by the PDF zoom surface at its resting scale. */
  verticalInset?: number;
  onWordPress: (word: WordBox) => void;
  selectedWord?: WordBox | null;
  highlightedWordRange?: {start: number; end: number} | null;
  scanning?: boolean;
  visible: boolean;
}

interface HighlightBand {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Merge consecutive word boxes into a single band for each visual line. */
function buildHighlightBands(
  words: WordBox[],
  range: {start: number; end: number} | null,
): HighlightBand[] {
  if (range === null || words.length === 0) {
    return [];
  }

  const start = Math.max(0, range.start);
  const end = Math.min(words.length - 1, range.end);
  if (start > end) {
    return [];
  }

  return words.slice(start, end + 1).reduce<HighlightBand[]>((bands, word) => {
    const previous = bands.at(-1);
    if (previous) {
      const previousCenter = previous.y + previous.height / 2;
      const wordCenter = word.y + word.height / 2;
      const sameLine =
        Math.abs(previousCenter - wordCenter) <=
        Math.max(previous.height, word.height) * 0.65;
      const horizontalGap = word.x - (previous.x + previous.width);
      const visuallyAdjacent =
        horizontalGap >= -0.01 &&
        horizontalGap <= Math.max(0.04, word.height * 4);

      if (sameLine && visuallyAdjacent) {
        const right = Math.max(previous.x + previous.width, word.x + word.width);
        const bottom = Math.max(previous.y + previous.height, word.y + word.height);
        previous.x = Math.min(previous.x, word.x);
        previous.y = Math.min(previous.y, word.y);
        previous.width = right - previous.x;
        previous.height = bottom - previous.y;
        return bands;
      }
    }

    bands.push({...word});
    return bands;
  }, []);
}

/**
 * Renders the capture outline and tappable word boxes over the current PDF
 * page. A selected word remains highlighted behind the dictionary sheet.
 *
 * The overlay uses normalized (0..1) word coordinates and maps them onto the
 * "contained" rectangle of the rendered page, so it stays aligned no matter
 * what device size or zoom is applied to the PDF view underneath.
 */
function TextLayerOverlay({
  page,
  frameWidth,
  frameHeight,
  horizontalInset = 0,
  verticalInset = 0,
  onWordPress,
  selectedWord = null,
  highlightedWordRange = null,
  scanning = false,
  visible,
}: TextLayerOverlayProps): React.JSX.Element | null {
  const scanPosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible || !scanning) {
      scanPosition.stopAnimation();
      scanPosition.setValue(0);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(scanPosition, {
          duration: 850,
          toValue: 1,
          useNativeDriver: true,
        }),
        Animated.timing(scanPosition, {
          duration: 850,
          toValue: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [scanPosition, scanning, visible]);

  const geometry = useMemo(() => {
    if (!page || page.pageWidth <= 0 || page.pageHeight <= 0) {
      return null;
    }
    const pageAspect = page.pageWidth / page.pageHeight;
    const contentWidth = Math.max(1, frameWidth - horizontalInset * 2);
    const contentHeight = Math.max(1, frameHeight - verticalInset * 2);
    const frameAspect = contentWidth / contentHeight;

    let rectWidth: number;
    let rectHeight: number;
    if (frameAspect > pageAspect) {
      // Frame is wider than the page -> page is height-constrained.
      rectHeight = contentHeight;
      rectWidth = rectHeight * pageAspect;
    } else {
      // Frame is taller than the page -> page is width-constrained.
      rectWidth = contentWidth;
      rectHeight = rectWidth / pageAspect;
    }

    const rectX = horizontalInset + (contentWidth - rectWidth) / 2;
    // ZoomPdfView's `contain` rendering is horizontally centered but anchored
    // to the top of its frame. Vertically centering this overlay introduced a
    // false offset whenever the rendered PDF was shorter than the frame.
    const rectY = verticalInset;
    return { rectX, rectY, rectWidth, rectHeight };
  }, [frameHeight, frameWidth, horizontalInset, page, verticalInset]);

  const highlightBands = useMemo(
    () => buildHighlightBands(page?.words ?? [], highlightedWordRange),
    [highlightedWordRange, page?.words],
  );

  if (!visible && highlightedWordRange === null) {
    return null;
  }

  const rectX = geometry?.rectX ?? 0;
  const rectY = geometry?.rectY ?? 0;
  const rectWidth = geometry?.rectWidth ?? frameWidth;
  const rectHeight = geometry?.rectHeight ?? frameHeight;
  const translateY = scanPosition.interpolate({
    inputRange: [0, 1],
    outputRange: [0, Math.max(0, rectHeight - 2)],
  });

  return (
    <View
      pointerEvents={visible ? 'box-none' : 'none'}
      style={StyleSheet.absoluteFill}
      testID="text-layer-overlay">
      {visible && (
        <View
          pointerEvents="none"
          style={[
            styles.captureOutline,
            {left: rectX, top: rectY, width: rectWidth, height: rectHeight},
          ]}
        />
      )}
      {scanning && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.scanLine,
            {
              left: rectX + 2,
              top: rectY,
              width: Math.max(0, rectWidth - 4),
              transform: [{translateY}],
            },
          ]}
        />
      )}
      {visible && (
        <View pointerEvents="none" style={styles.captureHint}>
          <Text style={styles.captureHintText}>
            {scanning ? 'Scanning this page...' : 'Tap a word'}
          </Text>
        </View>
      )}
      {!scanning && geometry && highlightBands.map((band, index) => (
        <View
          key={`narration-band-${index}`}
          pointerEvents="none"
          style={[
            styles.narratedBand,
            {
              left: rectX + band.x * rectWidth,
              top: rectY + band.y * rectHeight,
              width: band.width * rectWidth,
              height: band.height * rectHeight,
            },
          ]}
        />
      ))}
      {!scanning && page?.hasText && geometry && page.words.map((word, index) => {
        const selected = selectedWord === word;
        return (
        <Pressable
          accessibilityLabel={word.text}
          accessibilityRole="button"
          hitSlop={2}
          key={`${word.text}-${index}`}
          onPress={() => onWordPress(word)}
          style={[
            styles.wordBox,
            selected && styles.selectedWord,
            {
              left: rectX + word.x * rectWidth,
              top: rectY + word.y * rectHeight,
              width: word.width * rectWidth,
              height: word.height * rectHeight,
            },
          ]}
        />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  captureOutline: {
    position: 'absolute',
    borderColor: '#E47B52',
    borderRadius: 3,
    borderWidth: 2,
    backgroundColor: 'rgba(228,123,82,0.025)',
  },
  scanLine: {
    position: 'absolute',
    height: 2,
    backgroundColor: '#E47B52',
    shadowColor: '#E47B52',
    shadowOpacity: 0.9,
    shadowRadius: 5,
    elevation: 4,
  },
  captureHint: {
    position: 'absolute',
    alignSelf: 'center',
    top: 12,
    backgroundColor: 'rgba(33,29,25,0.88)',
    borderRadius: 15,
    paddingHorizontal: 13,
    paddingVertical: 7,
  },
  captureHintText: {
    color: '#FFF9EF',
    fontSize: 12,
    fontWeight: '700',
  },
  wordBox: {
    position: 'absolute',
    backgroundColor: 'transparent',
    borderRadius: 2,
  },
  selectedWord: {
    backgroundColor: 'rgba(239,173,76,0.48)',
    borderColor: 'rgba(190,105,35,0.9)',
    borderWidth: 1,
  },
  narratedBand: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 205, 79, 0.52)',
    borderColor: 'rgba(218, 132, 29, 0.9)',
    borderRadius: 3,
    borderWidth: 1,
  },
});

export default TextLayerOverlay;
