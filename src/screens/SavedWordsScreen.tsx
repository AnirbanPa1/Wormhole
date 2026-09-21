import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import BottomNavigation, {type MainTab} from '../components/BottomNavigation';
import {colors} from '../constants/theme';
import {useAppSettings} from '../features/settings/AppSettingsProvider';
import {formatPos} from '../services/dictionary.service';
import {
  clearWordCache,
  loadWordCache,
  type CachedWord,
} from '../storage/word-cache';
import styles from './SavedWordsScreen.styles';

type SavedWordsScreenProps = {
  onNavigate(tab: MainTab): void;
};

function SavedWordsScreen({onNavigate}: SavedWordsScreenProps): React.JSX.Element {
  const {darkMode} = useAppSettings();
  const [loading, setLoading] = useState(true);
  const [words, setWords] = useState<CachedWord[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  useEffect(() => {
    loadWordCache()
      .then(setWords)
      .catch(() => setWords([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredWords = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) {
      return words;
    }
    return words.filter(item => item.word.toLowerCase().includes(normalized));
  }, [query, words]);

  const handleClear = useCallback(() => {
    Alert.alert(
      'Clear saved words?',
      'This removes every word you have looked up from this device.',
      [
        {text: 'Cancel', style: 'cancel'},
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
    <SafeAreaView style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <Text style={styles.eyebrow}>YOUR COLLECTION</Text>
          <Text style={[styles.title, darkMode && styles.textDark]}>Saved Words</Text>
          <Text style={[styles.subtitle, darkMode && styles.mutedDark]}>
            {words.length} {words.length === 1 ? 'word' : 'words'} from your reading
          </Text>
        </View>
        <Pressable
          accessibilityLabel="Clear saved words"
          disabled={words.length === 0}
          onPress={handleClear}
          style={[
            styles.clearButton,
            darkMode && styles.clearButtonDark,
            words.length === 0 && styles.disabled,
          ]}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </Pressable>
      </View>

      <View style={[styles.searchBox, darkMode && styles.searchBoxDark]}>
        <Text style={styles.searchGlyph}>Aa</Text>
        <TextInput
          accessibilityLabel="Search saved words"
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search saved words"
          placeholderTextColor={darkMode ? '#8E867C' : '#958D83'}
          style={[styles.searchInput, darkMode && styles.textDark]}
          value={query}
        />
        {query.length > 0 && (
          <Pressable accessibilityLabel="Clear search" onPress={() => setQuery('')}>
            <Text style={styles.searchClear}>×</Text>
          </Pressable>
        )}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.accent} size="large" />
        </View>
      ) : words.length === 0 ? (
        <View style={styles.centered}>
          <View style={styles.emptyGlyph}>
            <Text style={styles.emptyGlyphText}>Aa</Text>
          </View>
          <Text style={[styles.emptyTitle, darkMode && styles.textDark]}>
            No words saved yet
          </Text>
          <Text style={[styles.emptyCopy, darkMode && styles.mutedDark]}>
            Look up a word while reading and it will wait for you here, even
            when you are offline.
          </Text>
        </View>
      ) : filteredWords.length === 0 ? (
        <View style={styles.centered}>
          <Text style={[styles.emptyTitle, darkMode && styles.textDark]}>
            No matching words
          </Text>
          <Text style={[styles.emptyCopy, darkMode && styles.mutedDark]}>
            Try a different spelling or a shorter search.
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {filteredWords.map(item => {
            const isOpen = expanded === item.word;
            const first = item.result?.entries[0];
            const notFound = !item.result || item.result.entries.length === 0;
            return (
              <Pressable
                accessibilityLabel={`${item.word}, ${isOpen ? 'collapse' : 'show definition'}`}
                key={item.word}
                onPress={() =>
                  setExpanded(current => (current === item.word ? null : item.word))
                }
                style={[styles.card, darkMode && styles.cardDark]}>
                <View style={styles.cardHeader}>
                  <Text style={[styles.cardWord, darkMode && styles.textDark]}>
                    {item.word}
                  </Text>
                  {first ? (
                    <Text style={styles.cardPos}>
                      {formatPos(first.pos).toUpperCase()}
                    </Text>
                  ) : (
                    <Text style={[styles.cardPosMuted, darkMode && styles.mutedDark]}>—</Text>
                  )}
                </View>

                {notFound ? (
                  <Text style={[styles.cardNotFound, darkMode && styles.mutedDark]}>
                    Not found in the offline dictionary
                  </Text>
                ) : isOpen ? (
                  <View style={styles.cardDetail}>
                    {item.result?.entries.map((entry, entryIndex) => (
                      <View key={`${entry.pos}-${entryIndex}`} style={styles.entry}>
                        <Text style={styles.entryPos}>
                          {formatPos(entry.pos).toUpperCase()}
                        </Text>
                        {entry.defs.map((definition, definitionIndex) => (
                          <Text
                            key={definitionIndex}
                            style={[styles.definition, darkMode && styles.textDark]}>
                            {entry.defs.length > 1 ? `${definitionIndex + 1}. ` : ''}
                            {definition}
                          </Text>
                        ))}
                        {entry.examples?.[0] && (
                          <Text style={[styles.example, darkMode && styles.mutedDark]}>
                            “{entry.examples[0]}”
                          </Text>
                        )}
                      </View>
                    ))}
                    <Text style={styles.collapseHint}>Tap to collapse</Text>
                  </View>
                ) : (
                  <View style={styles.previewRow}>
                    <Text
                      numberOfLines={2}
                      style={[styles.cardPreview, darkMode && styles.mutedDark]}>
                      {first?.defs[0]}
                    </Text>
                    <Text style={styles.expandArrow}>›</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
          <Text style={[styles.attribution, darkMode && styles.mutedDark]}>
            Simple English Wiktionary · OEWN fallback
          </Text>
        </ScrollView>
      )}

      <BottomNavigation active="saved" onNavigate={onNavigate} />
    </SafeAreaView>
  );
}

export default SavedWordsScreen;
