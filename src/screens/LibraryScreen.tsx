import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import BottomNavigation, {type MainTab} from '../components/BottomNavigation';
import {colors} from '../constants/theme';
import {useAppSettings} from '../features/settings/AppSettingsProvider';
import type {LibraryDocument} from '../types/library';
import styles from './LibraryScreen.styles';

type LibraryScreenProps = {
  documents: LibraryDocument[];
  loading: boolean;
  importing: boolean;
  onImport(): void;
  onOpen(document: LibraryDocument): void;
  onNavigate(tab: MainTab): void;
};

function progressFor(document: LibraryDocument): number {
  if (document.pageCount <= 0) {
    return 0;
  }
  return Math.min(100, ((document.currentPage + 1) / document.pageCount) * 100);
}

function formatLibrarySize(documents: LibraryDocument[]): string | null {
  const knownSizes = documents
    .map(document => document.size)
    .filter((size): size is number => typeof size === 'number');
  if (knownSizes.length === 0) {
    return null;
  }
  const megabytes = knownSizes.reduce((total, size) => total + size, 0) / 1048576;
  return `${megabytes < 10 ? megabytes.toFixed(1) : megabytes.toFixed(0)} MB`;
}

function BookCover({
  document,
  index,
  compact = false,
}: {
  document: LibraryDocument;
  index: number;
  compact?: boolean;
}) {
  return (
    <View
      style={[
        styles.bookCover,
        compact && styles.bookCoverCompact,
        index % 2 === 0 ? styles.coverTerracotta : styles.coverOlive,
      ]}>
      <View style={styles.coverRule} />
      <Text
        numberOfLines={compact ? 3 : 4}
        style={[styles.coverTitle, compact && styles.coverTitleCompact]}>
        {document.title}
      </Text>
      <Text style={styles.coverMark}>WORMHOLE</Text>
    </View>
  );
}

function LibraryScreen({
  documents,
  loading,
  importing,
  onImport,
  onOpen,
  onNavigate,
}: LibraryScreenProps): React.JSX.Element {
  const {darkMode} = useAppSettings();
  const currentBook =
    documents.find(document => document.currentPage > 0) ?? documents[0];
  const recentBooks = documents.filter(document => document.id !== currentBook?.id);
  const librarySize = formatLibrarySize(documents);

  return (
    <SafeAreaView style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <View style={styles.brandBar}>
        <View style={styles.brandMark}>
          <Text style={styles.brandMarkText}>W</Text>
        </View>
        <View style={styles.brandCopy}>
          <Text style={[styles.brandName, darkMode && styles.textDark]}>Wormhole</Text>
          <Text style={[styles.brandTagline, darkMode && styles.mutedDark]}>
            Our little library
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Open profile"
          onPress={() => onNavigate('profile')}
          style={styles.avatarButton}>
          <Text style={styles.avatarText}>W</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}>
          <View style={styles.titleRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.eyebrow}>QUIET SHELVES</Text>
              <Text style={[styles.title, darkMode && styles.textDark]}>Library</Text>
              <Text style={[styles.bookCount, darkMode && styles.mutedDark]}>
                {documents.length} {documents.length === 1 ? 'book' : 'books'} saved offline
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Import a PDF"
              disabled={importing}
              onPress={onImport}
              style={({pressed}) => [
                styles.importButton,
                pressed && styles.pressed,
                importing && styles.disabled,
              ]}>
              {importing ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.importButtonText}>+ PDF</Text>
              )}
            </Pressable>
          </View>

          {documents.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyBook}>
                <View style={styles.emptyBookSpine} />
                <Text style={styles.emptyBookGlyph}>Aa</Text>
              </View>
              <Text style={[styles.emptyTitle, darkMode && styles.textDark]}>
                Your shelf is waiting
              </Text>
              <Text style={[styles.emptyCopy, darkMode && styles.mutedDark]}>
                Import a PDF from your phone. Wormhole keeps a private local copy
                so you can read and listen offline.
              </Text>
              <Pressable onPress={onImport} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Choose a PDF</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={[styles.sectionLabel, darkMode && styles.mutedDark]}>
                CURRENTLY READING
              </Text>
              <Pressable
                accessibilityLabel={`Continue ${currentBook.title}`}
                onPress={() => onOpen(currentBook)}
                style={({pressed}) => [
                  styles.currentCard,
                  darkMode && styles.cardDark,
                  pressed && styles.pressed,
                ]}>
                <BookCover document={currentBook} index={0} />
                <View style={styles.currentMeta}>
                  <Text
                    numberOfLines={3}
                    style={[styles.currentTitle, darkMode && styles.textDark]}>
                    {currentBook.title}
                  </Text>
                  <Text style={[styles.pageDetails, darkMode && styles.mutedDark]}>
                    Page {Math.min(currentBook.currentPage + 1, currentBook.pageCount)} of{' '}
                    {currentBook.pageCount}
                  </Text>
                  <View style={styles.progressTrack}>
                    <View
                      style={[styles.progressFill, {width: `${progressFor(currentBook)}%`}]}
                    />
                  </View>
                  <Text style={styles.continueText}>Continue reading</Text>
                  {currentBook.hasTextLayer && (
                    <View style={styles.dictBadge}>
                      <Text style={styles.dictBadgeText}>Dictionary ready</Text>
                    </View>
                  )}
                </View>
              </Pressable>

              {recentBooks.length > 0 && (
                <>
                  <Text
                    style={[
                      styles.sectionLabel,
                      styles.recentLabel,
                      darkMode && styles.mutedDark,
                    ]}>
                    RECENT BOOKS
                  </Text>
                  {recentBooks.map((document, index) => (
                    <Pressable
                      accessibilityLabel={`Open ${document.title}`}
                      key={document.id}
                      onPress={() => onOpen(document)}
                      style={({pressed}) => [
                        styles.bookCard,
                        darkMode && styles.cardDark,
                        pressed && styles.pressed,
                      ]}>
                      <BookCover document={document} index={index + 1} compact />
                      <View style={styles.bookMeta}>
                        <Text
                          numberOfLines={2}
                          style={[styles.bookTitle, darkMode && styles.textDark]}>
                          {document.title}
                        </Text>
                        <Text style={[styles.pageDetails, darkMode && styles.mutedDark]}>
                          Page {Math.min(document.currentPage + 1, document.pageCount)} of{' '}
                          {document.pageCount}
                        </Text>
                        <View style={styles.progressTrack}>
                          <View
                            style={[
                              styles.progressFill,
                              {width: `${progressFor(document)}%`},
                            ]}
                          />
                        </View>
                      </View>
                      <Text style={styles.cardArrow}>›</Text>
                    </Pressable>
                  ))}
                </>
              )}

              <View style={styles.storageSummary}>
                <Text style={[styles.storageText, darkMode && styles.mutedDark]}>
                  Stored locally on this device
                  {librarySize ? ` · ${librarySize}` : ''}
                </Text>
              </View>
            </>
          )}
        </ScrollView>
      )}

      <BottomNavigation active="library" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

export default LibraryScreen;
