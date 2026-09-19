import React, {useEffect, useState} from 'react';
import {ScrollView, Text, View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import BottomNavigation, {type MainTab} from '../components/BottomNavigation';
import {useAppSettings} from '../features/settings/AppSettingsProvider';
import {loadWordCache} from '../storage/word-cache';
import styles from './ProfileScreen.styles';

type ProfileScreenProps = {
  bookCount: number;
  onNavigate(tab: MainTab): void;
};

function ProfileScreen({bookCount, onNavigate}: ProfileScreenProps): React.JSX.Element {
  const {darkMode} = useAppSettings();
  const [wordCount, setWordCount] = useState(0);

  useEffect(() => {
    loadWordCache()
      .then(words => setWordCount(words.length))
      .catch(() => setWordCount(0));
  }, []);

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR SPACE</Text>
        <Text style={[styles.headerTitle, darkMode && styles.textDark]}>Profile</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>W</Text>
        </View>
        <Text style={[styles.name, darkMode && styles.textDark]}>Wormhole Reader</Text>
        <Text style={[styles.subtitle, darkMode && styles.mutedDark]}>
          Your quiet corner for books, words, and offline narration.
        </Text>

        <View style={[styles.statsCard, darkMode && styles.cardDark]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, darkMode && styles.textDark]}>{bookCount}</Text>
            <Text style={[styles.statLabel, darkMode && styles.mutedDark]}>BOOKS</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, darkMode && styles.textDark]}>{wordCount}</Text>
            <Text style={[styles.statLabel, darkMode && styles.mutedDark]}>SAVED WORDS</Text>
          </View>
        </View>

        <View style={[styles.notice, darkMode && styles.cardDark]}>
          <Text style={[styles.noticeTitle, darkMode && styles.textDark]}>Local profile</Text>
          <Text style={[styles.noticeCopy, darkMode && styles.mutedDark]}>
            This is a simple device-only profile for now. Your books, vocabulary,
            reading position, and narration preferences stay on this device.
          </Text>
        </View>
        <Text style={[styles.versionNote, darkMode && styles.mutedDark]}>
          Wormhole · Our little library
        </Text>
      </ScrollView>
      <BottomNavigation active="profile" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

export default ProfileScreen;
