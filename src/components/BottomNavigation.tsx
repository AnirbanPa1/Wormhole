import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import {colors} from '../constants/theme';
import {useAppSettings} from '../features/settings/AppSettingsProvider';

export type MainTab = 'library' | 'saved' | 'settings' | 'profile';

type BottomNavigationProps = {
  active: MainTab;
  onNavigate(tab: MainTab): void;
};

const tabs: Array<{id: MainTab; glyph: string; label: string}> = [
  {id: 'library', glyph: 'L', label: 'Library'},
  {id: 'saved', glyph: 'Aa', label: 'Saved Words'},
  {id: 'settings', glyph: 'S', label: 'Settings'},
  {id: 'profile', glyph: 'P', label: 'Profile'},
];

function BottomNavigation({
  active,
  onNavigate,
}: BottomNavigationProps): React.JSX.Element {
  const {darkMode} = useAppSettings();

  return (
    <View style={[styles.container, darkMode && styles.containerDark]}>
      {tabs.map(tab => {
        const selected = tab.id === active;
        return (
          <Pressable
            accessibilityLabel={`Open ${tab.label}`}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            key={tab.id}
            onPress={() => onNavigate(tab.id)}
            style={styles.tab}>
            <View style={[styles.glyph, selected && styles.glyphActive]}>
              <Text
                style={[
                  styles.glyphText,
                  selected && styles.activeText,
                  darkMode && !selected && styles.textDark,
                ]}>
                {tab.glyph}
              </Text>
            </View>
            <Text
              numberOfLines={1}
              style={[
                styles.label,
                selected && styles.activeText,
                darkMode && !selected && styles.textDark,
              ]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 68,
    paddingHorizontal: 8,
    paddingTop: 7,
    paddingBottom: 5,
    flexDirection: 'row',
    backgroundColor: '#FFFAF6',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  containerDark: {
    backgroundColor: '#201D1A',
    borderTopColor: '#3B3732',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyph: {
    minWidth: 28,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glyphActive: {backgroundColor: '#F3D8CD'},
  glyphText: {
    color: colors.muted,
    fontSize: 13,
    fontFamily: 'serif',
    fontWeight: '800',
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  activeText: {color: colors.accentDark},
  textDark: {color: '#C9C0B5'},
});

export default BottomNavigation;
