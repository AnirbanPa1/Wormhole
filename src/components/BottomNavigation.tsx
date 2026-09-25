import React from 'react';
import {Pressable, StyleSheet, Text, View} from 'react-native';
import type {LucideIcon} from 'lucide-react-native';
import BookA from 'lucide-react-native/icons/book-a';
import Bolt from 'lucide-react-native/icons/bolt';
import CircleUserRound from 'lucide-react-native/icons/circle-user-round';
import Library from 'lucide-react-native/icons/library';
import {colors} from '../constants/theme';
import {useAppSettings} from '../features/settings/AppSettingsProvider';
import FloatingNavigationContainer from './FloatingNavigationContainer';

export type MainTab = 'library' | 'saved' | 'settings' | 'profile';

type BottomNavigationProps = {
  active: MainTab;
  onNavigate(tab: MainTab): void;
};

const tabs: Array<{id: MainTab; icon: LucideIcon; label: string}> = [
  {id: 'library', icon: Library, label: 'Library'},
  {id: 'saved', icon: BookA, label: 'Saved Words'},
  {id: 'settings', icon: Bolt, label: 'Settings'},
  {id: 'profile', icon: CircleUserRound, label: 'Profile'},
];

function BottomNavigation({
  active,
  onNavigate,
}: BottomNavigationProps): React.JSX.Element {
  const {darkMode} = useAppSettings();

  return (
    <FloatingNavigationContainer>
      {tabs.map(tab => {
        const selected = tab.id === active;
        const Icon = tab.icon;
        const iconColor = selected
          ? colors.ink
          : darkMode
            ? colors.darkMuted
            : colors.muted;
        return (
          <Pressable
            accessibilityLabel={`Open ${tab.label}`}
            accessibilityRole="tab"
            accessibilityState={{selected}}
            key={tab.id}
            onPress={() => onNavigate(tab.id)}
            style={[styles.tab, selected && styles.tabActive]}>
            <View style={styles.glyph}>
              <Icon color={iconColor} size={20} strokeWidth={selected ? 2.5 : 2} />
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
    </FloatingNavigationContainer>
  );
}

const styles = StyleSheet.create({
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 16,
    marginHorizontal: 2,
  },
  tabActive: {backgroundColor: colors.focus},
  glyph: {
    minWidth: 34,
    height: 28,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    color: colors.muted,
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  activeText: {color: colors.ink},
  textDark: {color: colors.darkMuted},
});

export default BottomNavigation;
