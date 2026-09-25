import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  formatPos,
  type DictionaryResult,
} from '../services/dictionary.service';
import { colors } from '../constants/theme';
import {useAppSettings} from '../features/settings/AppSettingsProvider';

interface DictionarySheetProps {
  visible: boolean;
  /** The word the user selected (may not match a dictionary lemma). */
  word: string | null;
  /** The resolved lookup result; null means the word was not found. */
  result: DictionaryResult | null;
  onClose: () => void;
}

function DictionarySheet({
  visible,
  word,
  result,
  onClose,
}: DictionarySheetProps): React.JSX.Element | null {
  const {darkMode} = useAppSettings();

  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={visible}>
      <View style={styles.backdropWrap}>
        <Pressable
          accessibilityLabel="Close dictionary"
          onPress={onClose}
          style={styles.backdrop}
        />
        <View style={[styles.sheet, darkMode && styles.sheetDark]}>
          <View style={[styles.grabber, darkMode && styles.grabberDark]} />
          <View style={styles.header}>
            <Text style={[styles.word, darkMode && styles.textDark]}>
              {word ?? ''}
            </Text>
            <Pressable
              accessibilityLabel="Close"
              onPress={onClose}
              style={[styles.closeButton, darkMode && styles.closeButtonDark]}>
              <Text style={[styles.closeButtonText, darkMode && styles.textDark]}>
                ✕
              </Text>
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.body}
            showsVerticalScrollIndicator={false}>
            {!word ? (
              <Text style={[styles.empty, darkMode && styles.mutedDark]}>
                No word selected.
              </Text>
            ) : !result || result.entries.length === 0 ? (
              <View>
                <Text style={[styles.notFoundTitle, darkMode && styles.textDark]}>
                  Not in dictionary
                </Text>
                <Text style={[styles.copy, darkMode && styles.mutedDark]}>
                  “{word}” could not be found in the bundled offline dictionaries.
                </Text>
              </View>
            ) : (
              <View>
                {result.matchedLemma !== word && (
                  <Text style={[styles.matched, darkMode && styles.accentTextDark]}>
                    Found as “{result.matchedLemma}”
                  </Text>
                )}
                {result.entries.map((entry, index) => (
                  <View
                    key={`${entry.pos}-${index}`}
                    style={[
                      styles.entryBlock,
                      darkMode && styles.entryBlockDark,
                    ]}>
                    <View style={styles.posRow}>
                      <View style={styles.posBadge}>
                        <Text style={styles.posBadgeText}>
                          {formatPos(entry.pos).toUpperCase()}
                        </Text>
                      </View>
                      {index === 0 && (
                        <Text
                          style={[
                            styles.meaningLabel,
                            darkMode && styles.mutedDark,
                          ]}>
                          {entry.source === 'simple-wiktionary'
                            ? 'SIMPLE DEFINITION'
                            : 'MEANING'}
                        </Text>
                      )}
                    </View>
                    {entry.defs.map((definition, defIndex) => (
                      <Text
                        key={defIndex}
                        style={[styles.definition, darkMode && styles.textDark]}>
                        {entry.defs.length > 1 ? `${defIndex + 1}. ` : ''}
                        {definition}
                      </Text>
                    ))}
                    {entry.examples?.map((example, exampleIndex) => (
                      <View key={exampleIndex} style={styles.exampleBlock}>
                        <Text
                          style={[
                            styles.exampleLabel,
                            darkMode && styles.mutedDark,
                          ]}>
                          EXAMPLE
                        </Text>
                        <Text style={[styles.example, darkMode && styles.textDark]}>
                          “{example}”
                        </Text>
                      </View>
                    ))}
                    {entry.syn.length > 0 && (
                      <View style={styles.synRow}>
                        <Text
                          style={[styles.synLabel, darkMode && styles.mutedDark]}>
                          Synonyms
                        </Text>
                        <Text
                          style={[
                            styles.synText,
                            darkMode && styles.accentTextDark,
                          ]}>
                          {entry.syn.join(', ')}
                        </Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            <Text style={[styles.attribution, darkMode && styles.mutedDark]}>
              Simple English Wiktionary · OEWN fallback
            </Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdropWrap: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { flex: 1, backgroundColor: 'rgba(24,18,12,0.12)' },
  sheet: {
    maxHeight: '72%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    backgroundColor: colors.background,
    paddingTop: 10,
    paddingHorizontal: 44,
    paddingBottom: 28,
  },
  sheetDark: {backgroundColor: colors.darkBackground},
  grabber: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  grabberDark: {backgroundColor: colors.darkBorder},
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  word: {
    fontSize: 30,
    fontFamily: 'serif',
    fontWeight: '700',
    color: colors.ink,
    flexShrink: 1,
    marginRight: 12,
  },
  closeButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.paper,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  closeButtonText: { fontSize: 16, color: colors.ink },
  closeButtonDark: {
    backgroundColor: colors.darkSurface,
    borderColor: colors.darkBorder,
  },
  textDark: {color: colors.darkInk},
  mutedDark: {color: colors.darkMuted},
  accentTextDark: {color: colors.focus},
  body: { paddingBottom: 20 },
  empty: { fontSize: 15, color: colors.muted, paddingVertical: 12 },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.ink,
    fontFamily: 'serif',
    marginBottom: 6,
  },
  copy: { fontSize: 15, lineHeight: 22, color: colors.muted },
  matched: {
    fontSize: 13,
    color: colors.accentDark,
    fontWeight: '700',
    marginBottom: 12,
  },
  entryBlock: {
    marginBottom: 22,
    paddingBottom: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  entryBlockDark: {borderBottomColor: colors.darkBorder},
  posRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  posBadge: {
    backgroundColor: colors.focus,
    borderRadius: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  posBadgeText: { color: colors.ink, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },
  meaningLabel: { marginLeft: 10, fontSize: 11, letterSpacing: 1.4, color: colors.muted, fontWeight: '700' },
  definition: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.ink,
    marginBottom: 4,
  },
  exampleBlock: { marginTop: 10 },
  exampleLabel: {
    fontSize: 10,
    letterSpacing: 1.1,
    color: colors.muted,
    fontWeight: '700',
  },
  example: {
    marginTop: 3,
    fontSize: 14,
    lineHeight: 21,
    color: colors.ink,
    fontStyle: 'italic',
  },
  synRow: { marginTop: 8 },
  synLabel: { fontSize: 11, letterSpacing: 1.2, color: colors.muted, fontWeight: '700' },
  synText: { fontSize: 14, color: colors.accentDark, marginTop: 3, lineHeight: 20 },
  attribution: {
    marginTop: 8,
    fontSize: 11,
    color: colors.muted,
    textAlign: 'center',
  },
});

export default DictionarySheet;
