import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors} from '../constants/theme';
import styles from './LibraryScreen.styles';
import type {LibraryDocument} from '../types/library';

interface LibraryScreenProps {
  documents: LibraryDocument[];
  loading: boolean;
  importing: boolean;
  onImport: () => void;
  onOpen: (document: LibraryDocument) => void;
  onShowSaved: () => void;
}

function LibraryScreen({
  documents,
  loading,
  importing,
  onImport,
  onOpen,
  onShowSaved,
}: LibraryScreenProps): React.JSX.Element {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.libraryHeader}>
        <View>
          <Text style={styles.eyebrow}>OUR LITTLE LIBRARY</Text>
          <Text style={styles.title}>Wormhole</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Import a PDF"
          disabled={importing}
          onPress={onImport}
          style={({pressed}) => [styles.importButton, pressed && styles.pressed]}>
          {importing ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.importButtonText}>＋ PDF</Text>
          )}
        </Pressable>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Open saved words"
        onPress={onShowSaved}
        style={styles.savedWordsButton}>
        <View style={styles.savedWordsGlyph}>
          <Text style={styles.savedWordsGlyphText}>Aa</Text>
        </View>
        <View style={styles.savedWordsMeta}>
          <Text style={styles.savedWordsTitle}>Dictionary & Saved Words</Text>
          <Text style={styles.savedWordsSub}>
            Review words you have looked up, offline.
          </Text>
        </View>
        <Text style={styles.savedWordsArrow}>›</Text>
      </Pressable>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : documents.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyBook}>
            <View style={styles.emptyBookSpine} />
            <Text style={styles.emptyBookGlyph}>Aa</Text>
          </View>
          <Text style={styles.emptyTitle}>Your shelf is waiting</Text>
          <Text style={styles.emptyCopy}>
            Import a PDF from your phone. Wormhole keeps a private local copy so
            you can return to it offline.
          </Text>
          <Pressable onPress={onImport} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Choose a PDF</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.shelf}>
          <Text style={styles.sectionLabel}>{documents.length} BOOKS</Text>
          {documents.map((document, index) => (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Open ${document.title}`}
              key={document.id}
              onPress={() => onOpen(document)}
              style={({pressed}) => [styles.bookCard, pressed && styles.pressed]}>
              <View
                style={[
                  styles.bookCover,
                  index % 2 === 0 ? styles.coverTerracotta : styles.coverOlive,
                ]}>
                <View style={styles.coverRule} />
                <Text numberOfLines={3} style={styles.coverTitle}>
                  {document.title}
                </Text>
                <Text style={styles.coverMark}>WORMHOLE</Text>
              </View>
              <View style={styles.bookMeta}>
                <Text numberOfLines={2} style={styles.bookTitle}>
                  {document.title}
                </Text>
                <Text style={styles.bookDetails}>
                  Page {Math.min(document.currentPage + 1, document.pageCount)} of{' '}
                  {document.pageCount}
                </Text>
                <View style={styles.progressTrack}>
                  <View
                    style={[
                      styles.progressFill,
                      {
                        width: `${Math.max(
                          3,
                          ((document.currentPage + 1) / document.pageCount) * 100,
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.continueText}>Continue reading →</Text>
                {document.hasTextLayer && (
                  <View style={styles.dictBadge}>
                    <Text style={styles.dictBadgeText}>● Dictionary ready</Text>
                  </View>
                )}
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

export default LibraryScreen;
