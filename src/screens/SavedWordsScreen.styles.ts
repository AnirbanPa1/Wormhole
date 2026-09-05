import {StyleSheet} from 'react-native';
import {colors} from '../constants/theme';

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: colors.background},
  centered: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36},
  header: {paddingHorizontal: 20, paddingTop: 14, paddingBottom: 12, flexDirection: 'row', alignItems: 'center'},
  backButton: {width: 40, height: 40, alignItems: 'center', justifyContent: 'center', marginRight: 6},
  backButtonText: {fontSize: 34, lineHeight: 36, color: colors.ink, fontWeight: '300'},
  headerText: {flex: 1},
  eyebrow: {fontSize: 11, letterSpacing: 2.1, color: colors.accentDark, fontWeight: '700'},
  title: {fontSize: 26, color: colors.ink, fontFamily: 'serif', fontWeight: '700', marginTop: 2},
  clearButton: {height: 36, paddingHorizontal: 14, borderRadius: 18, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center'},
  clearButtonText: {fontSize: 13, fontWeight: '700', color: colors.accentDark},
  disabled: {opacity: 0.35},
  emptyTitle: {fontFamily: 'serif', fontSize: 22, fontWeight: '700', color: colors.ink, textAlign: 'center'},
  emptyCopy: {fontSize: 15, lineHeight: 23, color: colors.muted, textAlign: 'center', marginTop: 12, maxWidth: 330},
  list: {paddingHorizontal: 20, paddingBottom: 24},
  countLabel: {fontSize: 11, letterSpacing: 1.8, fontWeight: '700', color: colors.muted, marginBottom: 12},
  card: {backgroundColor: colors.paper, borderRadius: 16, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 12},
  cardHeader: {flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between'},
  cardWord: {fontSize: 19, fontFamily: 'serif', fontWeight: '700', color: colors.ink},
  cardPos: {backgroundColor: colors.accent, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3, color: colors.white, fontSize: 11, fontWeight: '800', overflow: 'hidden'},
  cardPosMuted: {fontSize: 14, color: colors.muted},
  cardNotFound: {marginTop: 8, fontSize: 13, color: colors.muted},
  cardPreview: {marginTop: 8, fontSize: 13, lineHeight: 18, color: colors.muted},
  cardDetail: {marginTop: 12},
  entry: {marginBottom: 10},
  entryPos: {fontSize: 11, letterSpacing: 1.2, color: colors.accentDark, fontWeight: '700', marginBottom: 4},
  definition: {fontSize: 14, lineHeight: 20, color: colors.ink},
  example: {
    marginTop: 6,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    fontStyle: 'italic',
  },
  footer: {alignItems: 'center', paddingVertical: 12},
  attribution: {fontSize: 11, color: colors.muted},
});

export default styles;