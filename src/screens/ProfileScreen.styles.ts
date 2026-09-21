import {StyleSheet} from 'react-native';
import {colors} from '../constants/theme';

const styles = StyleSheet.create({
  safeArea: {flex: 1, backgroundColor: colors.background},
  safeAreaDark: {backgroundColor: colors.darkBackground},
  header: {paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8},
  eyebrow: {fontSize: 10, letterSpacing: 2, color: colors.accent, fontWeight: '900'},
  headerTitle: {fontFamily: 'serif', fontSize: 34, lineHeight: 40, fontWeight: '700', color: colors.ink},
  content: {alignItems: 'center', paddingHorizontal: 24, paddingTop: 24, paddingBottom: 112},
  avatar: {width: 94, height: 94, borderRadius: 30, backgroundColor: colors.ink, borderWidth: 2, borderColor: colors.focus, alignItems: 'center', justifyContent: 'center', transform: [{rotate: '-3deg'}], shadowColor: colors.shadow, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: {width: 0, height: 10}, elevation: 6},
  avatarText: {fontFamily: 'serif', fontSize: 42, color: colors.focus, fontWeight: '800'},
  name: {fontFamily: 'serif', fontSize: 25, color: colors.ink, fontWeight: '700', marginTop: 20},
  subtitle: {fontSize: 14, lineHeight: 21, color: colors.muted, textAlign: 'center', maxWidth: 310, marginTop: 8},
  statsCard: {width: '100%', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 18, flexDirection: 'row', marginTop: 30, paddingVertical: 20, shadowColor: colors.shadow, shadowOpacity: 0.07, shadowRadius: 14, shadowOffset: {width: 0, height: 7}, elevation: 3},
  cardDark: {backgroundColor: colors.darkSurface, borderColor: colors.darkBorder},
  stat: {flex: 1, alignItems: 'center'},
  statValue: {fontFamily: 'serif', fontSize: 21, color: colors.ink, fontWeight: '700'},
  statLabel: {fontSize: 10, letterSpacing: 1.5, color: colors.muted, fontWeight: '800', marginTop: 5},
  divider: {width: 1, backgroundColor: colors.border},
  dividerDark: {backgroundColor: colors.darkBorder},
  notice: {width: '100%', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.border, borderRadius: 18, marginTop: 16, padding: 18},
  noticeTitle: {fontSize: 16, color: colors.ink, fontWeight: '800'},
  noticeCopy: {fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 7},
  textDark: {color: colors.darkInk},
  mutedDark: {color: colors.darkMuted},
  versionNote: {fontSize: 10, color: colors.muted, marginTop: 24},
});

export default styles;
