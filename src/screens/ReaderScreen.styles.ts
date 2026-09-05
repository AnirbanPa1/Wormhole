import {StyleSheet} from 'react-native';
import {colors} from '../constants/theme';

const styles = StyleSheet.create({
  readerSafeArea: {flex: 1, backgroundColor: colors.readerBg},
  reader: {flex: 1, backgroundColor: colors.readerBg},
  readerTopBar: {height: 58, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, zIndex: 5},
  iconButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center'},
  iconButtonText: {fontSize: 38, lineHeight: 40, color: colors.readerInk, fontWeight: '300'},
  readerTitle: {flex: 1, textAlign: 'center', color: colors.readerInk, fontFamily: 'serif', fontSize: 16, paddingHorizontal: 8},
  analyzeButton: {width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: colors.analyzeBg},
  analyzeButtonActive: {backgroundColor: colors.accent},
  analyzeButtonText: {fontSize: 15, lineHeight: 20, color: colors.readerInk, fontWeight: '800', letterSpacing: -1},
  captureGlyph: {width: 20, height: 20},
  captureCorner: {position: 'absolute', width: 7, height: 7, borderColor: colors.readerInk},
  captureCornerTopLeft: {left: 0, top: 0, borderLeftWidth: 2, borderTopWidth: 2},
  captureCornerTopRight: {right: 0, top: 0, borderRightWidth: 2, borderTopWidth: 2},
  captureCornerBottomLeft: {left: 0, bottom: 0, borderLeftWidth: 2, borderBottomWidth: 2},
  captureCornerBottomRight: {right: 0, bottom: 0, borderRightWidth: 2, borderBottomWidth: 2},
  readerStage: {flex: 1, justifyContent: 'center', alignItems: 'center', overflow: 'hidden'},
  pager: {flex: 1, width: '100%'},
  pageSlot: {flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 14},
  pageFrame: {backgroundColor: colors.white, transformOrigin: 'left center', shadowColor: '#000000', shadowOpacity: 0.48, shadowRadius: 18, shadowOffset: {width: 0, height: 8}, elevation: 14},
  pdfPage: {flex: 1, backgroundColor: colors.white},
  pageEdgeLeft: {position: 'absolute', top: 0, left: 0, bottom: 0, width: 12, backgroundColor: colors.pageEdge},
  readerControls: {height: 72, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18},
  hidden: {opacity: 0},
  pageButton: {width: 46, height: 46, borderRadius: 23, backgroundColor: colors.readerButtonBg, alignItems: 'center', justifyContent: 'center'},
  disabledButton: {opacity: 0.25},
  pageButtonText: {fontSize: 32, lineHeight: 34, color: colors.ink},
  pageCounter: {width: 150, marginHorizontal: 18, alignItems: 'center'},
  pageCounterText: {color: colors.readerSub, fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums']},
  readerProgressTrack: {height: 3, width: 150, backgroundColor: colors.trackDark, borderRadius: 2, overflow: 'hidden', marginTop: 8},
  readerProgressFill: {height: 3, backgroundColor: colors.accent, borderRadius: 2},
});

export default styles;