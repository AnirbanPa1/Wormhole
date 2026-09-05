import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  clearWordCache,
  loadWordCache,
  type CachedWord,
} from '../storage/word-cache';
import { formatPos } from '../services/dictionary.service';
import { colors } from '../constants/theme';
import styles from './SavedWordsScreen.styles';

interface SavedWordsScreenProps {
  onBack: () => void;
}

function SavedWordsScreen({
  onBack,
}: SavedWordsScreenProps): React.JSX.Element {
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<CachedWord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    loadWordCache()
      .then(setWords)
      .catch(() => setWords([]))
      .finally(() => setLoading(false));
  }, []);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear saved words?',
      'This removes every word you have looked up from this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            clearWordCache()
              .then(() => setWords([]))
              .catch(() => Alert.alert('Could not clear words', 'Please try again.'));
          },
        },
      ],
    );
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Back to library"
          onPress={onBack}
          style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <View style={styles.headerText}>
          <Text style={styles.eyebrow}>YOUR LOOKUPS</Text>
          <Text style={styles.title}>Saved Words</Text>
        </View>
        <Pressable
          accessibilityLabel="Clear saved words"
          disabled={words.length === 0}
          onPress={handleClear}
          style={[styles.clearButton, words.length === 0 && styles.disabled]}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : words.length === 0 ? (
        <View style={styles.centered}>
          <Text style={styles.emptyTitle}>No words saved yet</Text>
          <Text style={styles.emptyCopy}>
            Long-press a word on any extracted page of a book to look it up. The
            words you look up appear here so you can review them later.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.list}>
          <Text style={styles.countLabel}>
            {words.length} WORD{words.length === 1 ? '' : 'S'}
          </Text>
          {words.map(item => {
            const isOpen = expanded === item.word;
            const first = item.result?.entries[0];
            const notFound = !item.result || item.result.entries.length === 0;
            return (
              <Pressable
                key={item.word}
                onPress={() =>
                  setExpanded(current => (current === item.word ? null : item.word))
                }
                style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.cardWord}>{item.word}</Text>
                  {first ? (
                    <Text style={styles.cardPos}>
                      {formatPos(first.pos).toUpperCase()}
                    </Text>
                  ) : (
                    <Text style={styles.cardPosMuted}>—</Text>
                  )}
                </View>

                {notFound ? (
                  <Text style={styles.cardNotFound}>Not found in dictionary</Text>
                ) : isOpen ? (
                  <View style={styles.cardDetail}>
                    {item.result?.entries.map((entry, ei) => (
                      <View key={`${entry.pos}-${ei}`} style={styles.entry}>
                        <Text style={styles.entryPos}>
                          {formatPos(entry.pos).toUpperCase()}
                        </Text>
                        {entry.defs.map((def, di) => (
                          <Text key={di} style={styles.definition}>
                            {entry.defs.length > 1 ? `${di + 1}. ` : ''}
                            {def}
                          </Text>
                        ))}
                        {entry.examples?.[0] && (
                          <Text style={styles.example}>
                            “{entry.examples[0]}”
                          </Text>
                        )}
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text numberOfLines={1} style={styles.cardPreview}>
                    {first?.defs[0]}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.footer}>
        <Text style={styles.attribution}>
          Simple English Wiktionary · OEWN fallback
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default SavedWordsScreen;
