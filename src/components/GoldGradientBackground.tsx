import React from 'react';
import {StyleSheet, View, type StyleProp, type ViewStyle} from 'react-native';
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
  return (
    <View
      pointerEvents="none"
      style={[styles.container, {borderRadius}, style]}>
      <Svg height="100%" width="100%">
        <Defs>
          <LinearGradient id="wormholeGold" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={goldGradient.start} />
            <Stop offset="0.38" stopColor={goldGradient.middle} />
            <Stop offset="0.72" stopColor={goldGradient.deep} />
            <Stop offset="1" stopColor={goldGradient.end} />
          </LinearGradient>
        </Defs>
        <Rect height="100%" width="100%" fill="url(#wormholeGold)" />
      </Svg>
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
