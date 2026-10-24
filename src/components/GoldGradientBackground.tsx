import React, {useCallback, useState} from 'react';
import {
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Svg, {
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from 'react-native-svg';
import {goldGradient} from '../constants/theme';

type GoldGradientBackgroundProps = {
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

function GoldGradientBackground({
  borderRadius = 0,
  style,
}: GoldGradientBackgroundProps): React.JSX.Element {
  const [size, setSize] = useState({width: 0, height: 0});

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;

    setSize(current =>
      Math.abs(current.width - width) < 0.5 &&
      Math.abs(current.height - height) < 0.5
        ? current
        : {width, height},
    );
  }, []);

  return (
    <View
      onLayout={handleLayout}
      pointerEvents="none"
      style={[styles.container, {borderRadius}, style]}>
      {size.width > 0 && size.height > 0 && (
        <Svg
          height={size.height}
          key={`${size.width}:${size.height}`}
          style={StyleSheet.absoluteFill}
          width={size.width}>
          <Defs>
            <LinearGradient id="wormholeGold" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={goldGradient.start} />
              <Stop offset="0.38" stopColor={goldGradient.middle} />
              <Stop offset="0.72" stopColor={goldGradient.deep} />
              <Stop offset="1" stopColor={goldGradient.end} />
            </LinearGradient>
          </Defs>
          <Rect
            fill="url(#wormholeGold)"
            height={size.height}
            rx={borderRadius}
            ry={borderRadius}
            width={size.width}
          />
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
});

export default React.memo(GoldGradientBackground);
