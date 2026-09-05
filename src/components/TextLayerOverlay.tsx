import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { TextLayerPage, WordBox } from '../types/text-layer';

interface TextLayerOverlayProps {
  page: TextLayerPage | null;
  /** Width of the rendered page frame (px). */
  frameWidth: number;
  /** Height of the rendered page frame (px). */
  frameHeight: number;
  onWordPress: (word: WordBox) => void;
  selectedWord?: WordBox | null;
  scanning?: boolean;
  visible: boolean;
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
  onWordPress,
  selectedWord = null,
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
    const frameAspect = frameWidth / frameHeight;

    let rectWidth: number;
    let rectHeight: number;
    if (frameAspect > pageAspect) {
      // Frame is wider than the page -> page is height-constrained.
      rectHeight = frameHeight;
      rectWidth = rectHeight * pageAspect;
    } else {
      // Frame is taller than the page -> page is width-constrained.
      rectWidth = frameWidth;
      rectHeight = rectWidth / pageAspect;
    }

    const rectX = (frameWidth - rectWidth) / 2;
    const rectY = (frameHeight - rectHeight) / 2;
    return { rectX, rectY, rectWidth, rectHeight };
  }, [frameHeight, frameWidth, page]);

  if (!visible) {
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
      pointerEvents="box-none"
      style={StyleSheet.absoluteFill}
      testID="text-layer-overlay">
      <View
        pointerEvents="none"
        style={[
          styles.captureOutline,
          {left: rectX, top: rectY, width: rectWidth, height: rectHeight},
        ]}
      />
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
      <View pointerEvents="none" style={styles.captureHint}>
        <Text style={styles.captureHintText}>
          {scanning ? 'Scanning this page...' : 'Tap a word'}
        </Text>
      </View>
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
});

export default TextLayerOverlay;
