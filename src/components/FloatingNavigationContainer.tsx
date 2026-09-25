import React, { type PropsWithChildren } from 'react';
import {
  StyleSheet,
  type StyleProp,
  View,
  type ViewProps,
  type ViewStyle,
  useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../constants/theme';
import { useAppSettings } from '../features/settings/AppSettingsProvider';

const PORTRAIT_SIDE_OFFSET = 14;
const LANDSCAPE_MAX_WIDTH = 560;
const BOTTOM_GAP = 8;
const CONTAINER_MIN_HEIGHT = 66;
const CONTAINER_MARGIN_BOTTOM = 8;
const CONTENT_CLEARANCE = 6;

export type FloatingNavigationLayout = {
  bottomOffset: number;
  sideOffset: number;
  obstructionHeight: number;
};

export function useFloatingNavigationLayout(): FloatingNavigationLayout {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const isLandscape = width > height;
  const bottomOffset = Math.max(BOTTOM_GAP, insets.bottom + BOTTOM_GAP);
  const sideOffset = isLandscape
    ? Math.max(
        PORTRAIT_SIDE_OFFSET,
        (width -
          Math.min(LANDSCAPE_MAX_WIDTH, width - PORTRAIT_SIDE_OFFSET * 2)) /
          2,
      )
    : PORTRAIT_SIDE_OFFSET;

  return {
    bottomOffset,
    sideOffset,
    obstructionHeight:
      bottomOffset +
      CONTAINER_MIN_HEIGHT +
      CONTAINER_MARGIN_BOTTOM +
      CONTENT_CLEARANCE,
  };
}

type FloatingNavigationContainerProps = PropsWithChildren<{
  pointerEvents?: ViewProps['pointerEvents'];
  style?: StyleProp<ViewStyle>;
}>;

function FloatingNavigationContainer({
  children,
  pointerEvents,
  style,
}: FloatingNavigationContainerProps): React.JSX.Element {
  const { darkMode } = useAppSettings();
  const { bottomOffset, sideOffset } = useFloatingNavigationLayout();

  return (
    <View
      pointerEvents={pointerEvents}
      style={[
        styles.container,
        { bottom: bottomOffset, left: sideOffset, right: sideOffset },
        darkMode && styles.containerDark,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 20,
    minHeight: CONTAINER_MIN_HEIGHT,
    marginBottom: CONTAINER_MARGIN_BOTTOM,
    paddingHorizontal: 8,
    paddingVertical: 6,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 22,
    shadowColor: colors.shadow,
    shadowOpacity: 0.1,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  containerDark: {
    backgroundColor: colors.darkSurface,
    borderColor: colors.darkBorder,
  },
});

export default FloatingNavigationContainer;
