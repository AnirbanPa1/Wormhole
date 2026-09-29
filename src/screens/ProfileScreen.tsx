import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Book, Trash2 } from 'lucide-react-native';
import BottomNavigation, { type MainTab } from '../components/BottomNavigation';
import { colors } from '../constants/theme';
import { useAppSettings } from '../features/settings/AppSettingsProvider';
import {
  isDocumentComplete,
  sortDocumentsByReadingActivity,
} from '../features/library/library-progress';
import { loadWordCache } from '../storage/word-cache';
import type { LibraryDocument } from '../types/library';
import styles from './ProfileScreen.styles';

type ProfileScreenProps = {
  documents: LibraryDocument[];
  onNavigate(tab: MainTab): void;
  onRemoveBook(id: string): Promise<void>;
};

function ProfileScreen({
  documents,
  onNavigate,
  onRemoveBook,
}: ProfileScreenProps): React.JSX.Element {
  const { darkMode } = useAppSettings();
  const [wordCount, setWordCount] = useState(0);
  const [removingBookId, setRemovingBookId] = useState<string | null>(null);
  const shelf = useMemo(
    () => sortDocumentsByReadingActivity(documents),
    [documents],
  );

  useEffect(() => {
    loadWordCache()
      .then(words => setWordCount(words.length))
      .catch(() => setWordCount(0));
  }, []);

  const confirmRemoveBook = (document: LibraryDocument) => {
    Alert.alert(
      'Remove this book?',
      `Wormhole will remove “${document.title}”, its reading progress, and its private imported copy. Your original PDF will not be changed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            setRemovingBookId(document.id);
            onRemoveBook(document.id)
              .catch(error => {
                Alert.alert(
                  'Book removal incomplete',
                  error instanceof Error
                    ? error.message
                    : 'Some local book data could not be removed.',
                );
              })
              .finally(() => setRemovingBookId(null));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>YOUR SPACE</Text>
        <Text style={[styles.headerTitle, darkMode && styles.textDark]}>
          Profile
        </Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.avatar}>
          <Image
            accessibilityIgnoresInvertColors
            accessibilityLabel="Profile"
            source={require('../../assets/branding/profile-icon.png')}
            style={styles.avatarIcon}
          />
        </View>
        <Text style={[styles.name, darkMode && styles.textDark]}>
          Wormhole Reader
        </Text>
        <Text style={[styles.subtitle, darkMode && styles.mutedDark]}>
          Your quiet corner for books, words, and offline narration.
        </Text>

        <View style={[styles.statsCard, darkMode && styles.cardDark]}>
          <View style={styles.stat}>
            <Text style={[styles.statValue, darkMode && styles.textDark]}>
              {documents.length}
            </Text>
            <Text style={[styles.statLabel, darkMode && styles.mutedDark]}>
              BOOKS
            </Text>
          </View>
          <View style={[styles.divider, darkMode && styles.dividerDark]} />
          <View style={styles.stat}>
            <Text style={[styles.statValue, darkMode && styles.textDark]}>
              {wordCount}
            </Text>
            <Text style={[styles.statLabel, darkMode && styles.mutedDark]}>
              SAVED WORDS
            </Text>
          </View>
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, darkMode && styles.textDark]}>
            Your shelf
          </Text>
          <Text style={[styles.sectionCount, darkMode && styles.mutedDark]}>
            {documents.length} {documents.length === 1 ? 'book' : 'books'}
          </Text>
        </View>

        <View style={[styles.shelfCard, darkMode && styles.cardDark]}>
          {shelf.length === 0 ? (
            <View style={styles.emptyShelf}>
              <Text
                style={[styles.emptyShelfTitle, darkMode && styles.textDark]}
              >
                Nothing on the shelf yet
              </Text>
              <Text
                style={[styles.emptyShelfCopy, darkMode && styles.mutedDark]}
              >
                Imported PDFs will appear here.
              </Text>
            </View>
          ) : (
            shelf.map((document, index) => {
              const removing = removingBookId === document.id;
              const completed = isDocumentComplete(document);
              return (
                <View
                  key={document.id}
                  style={[
                    styles.shelfRow,
                    index < shelf.length - 1 && styles.shelfRowBorder,
                    darkMode &&
                      index < shelf.length - 1 &&
                      styles.shelfRowBorderDark,
                  ]}
                >
                  <View style={styles.shelfBookMark}>
                    <Book color={colors.focus} size={22} strokeWidth={2.2} />
                  </View>
                  <View style={styles.shelfMeta}>
                    <Text
                      numberOfLines={2}
                      style={[styles.shelfTitle, darkMode && styles.textDark]}
                    >
                      {document.title}
                    </Text>
                    <Text
                      style={[styles.shelfStatus, darkMode && styles.mutedDark]}
                    >
                      {completed
                        ? 'Completed'
                        : `Page ${Math.min(
                            document.currentPage + 1,
                            document.pageCount,
                          )} of ${document.pageCount}`}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityLabel={`Remove ${document.title}`}
                    disabled={removingBookId !== null}
                    hitSlop={8}
                    onPress={() => confirmRemoveBook(document)}
                    style={({ pressed }) => [
                      styles.removeButton,
                      darkMode && styles.removeButtonDark,
                      pressed && styles.removeButtonPressed,
                      removingBookId !== null && styles.removeButtonDisabled,
                    ]}
                  >
                    {removing ? (
                      <ActivityIndicator color={colors.accent} size="small" />
                    ) : (
                      <Trash2
                        color={darkMode ? colors.darkMuted : colors.muted}
                        size={18}
                        strokeWidth={2}
                      />
                    )}
                  </Pressable>
                </View>
              );
            })
          )}
        </View>

        <View
          style={[styles.sectionDivider, darkMode && styles.sectionDividerDark]}
        />

        <View style={[styles.notice, darkMode && styles.cardDark]}>
          <Text style={[styles.noticeTitle, darkMode && styles.textDark]}>
            Local profile
          </Text>
          <Text style={[styles.noticeCopy, darkMode && styles.mutedDark]}>
            This is a simple device-only profile for now. Your books,
            vocabulary, reading position, and narration preferences stay on this
            device.
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
