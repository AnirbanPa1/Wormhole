import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  BackHandler,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Headphones,
  ScanText,
  type LucideIcon,
} from 'lucide-react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import GoldGradientBackground from '../components/GoldGradientBackground';
import {colors} from '../constants/theme';
import {useAppSettings} from '../features/settings/AppSettingsProvider';
import styles from './GettingStartedScreen.styles';

type GettingStartedScreenProps = {
  onFinish(): Promise<void>;
};

type GettingStartedPage = {
  eyebrow: string;
  title: string;
  copy: string;
  note: string;
  icon: LucideIcon;
};

const pages: GettingStartedPage[] = [
  {
    eyebrow: 'YOUR LITTLE LIBRARY',
    title: 'Bring your books through the wormhole',
    copy: 'Import PDFs from your phone and keep your books, reading position, and progress available offline.',
    note: 'Your original PDF stays untouched.',
    icon: BookOpen,
  },
  {
    eyebrow: 'OFFLINE NARRATION',
    title: 'Listen without sending your book anywhere',
    copy: 'Download Kokoro once from Settings, choose a voice and speed, then generate narration entirely on your device.',
    note: 'The voice model is optional and uses private app storage.',
    icon: Headphones,
  },
  {
    eyebrow: 'READ YOUR WAY',
    title: 'Read, listen, capture, and understand',
    copy: 'Use immersive listening, follow the highlighted passage, or capture a page and tap unfamiliar words for offline definitions.',
    note: 'You can change the experience anytime in Settings.',
    icon: ScanText,
  },
];

function GettingStartedScreen({
  onFinish,
}: GettingStartedScreenProps): React.JSX.Element {
  const {darkMode} = useAppSettings();
  const [pageIndex, setPageIndex] = useState(0);
  const [finishing, setFinishing] = useState(false);
  const page = pages[pageIndex];
  const Icon = page.icon;
  const isLastPage = pageIndex === pages.length - 1;

  const finish = useCallback(async () => {
    if (finishing) {
      return;
    }
    setFinishing(true);
    try {
      await onFinish();
    } catch {
      Alert.alert(
        'Could not save your choice',
        'Please try again so Wormhole can remember that you finished setup.',
      );
      setFinishing(false);
    }
  }, [finishing, onFinish]);

  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (pageIndex > 0) {
          setPageIndex(current => current - 1);
        } else {
          finish().catch(() => undefined);
        }
        return true;
      },
    );
    return () => subscription.remove();
  }, [finish, pageIndex]);

  return (
    <SafeAreaView
      style={[styles.safeArea, darkMode && styles.safeAreaDark]}>
      <View style={styles.topBar}>
        <View style={[styles.brandMark, darkMode && styles.brandMarkDark]}>
          <Image
            accessibilityIgnoresInvertColors
            source={require('../../assets/branding/wormhole-icon.png')}
            style={styles.brandMarkImage}
          />
        </View>
        <Pressable
          accessibilityLabel="Skip getting started"
          disabled={finishing}
          onPress={finish}
          style={({pressed}) => [
            styles.skipButton,
            darkMode && styles.skipButtonDark,
            pressed && styles.pressed,
          ]}>
          <Text style={[styles.skipText, darkMode && styles.textDark]}>
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        <View style={styles.contentWidth}>
          <View style={[styles.artCard, darkMode && styles.artCardDark]}>
            <View style={styles.artHalo}>
              <GoldGradientBackground borderRadius={75} />
            </View>
            <View style={styles.artPageBack} />
            <View style={[styles.artPage, darkMode && styles.artPageDark]}>
              <Text style={styles.artWordmark}>WORMHOLE</Text>
              <View style={styles.artRule} />
              <Icon color={colors.focus} size={68} strokeWidth={1.5} />
              <Text style={styles.artPageNumber}>0{pageIndex + 1}</Text>
            </View>
          </View>

          <View style={styles.copyBlock}>
            <Text style={styles.eyebrow}>{page.eyebrow}</Text>
            <Text style={[styles.title, darkMode && styles.textDark]}>
              {page.title}
            </Text>
            <Text style={[styles.copy, darkMode && styles.mutedDark]}>
              {page.copy}
            </Text>
            <View style={[styles.note, darkMode && styles.noteDark]}>
              <View style={styles.noteDot} />
              <Text style={[styles.noteText, darkMode && styles.mutedDark]}>
                {page.note}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dots}>
          {pages.map((item, index) => (
            <View
              key={item.eyebrow}
              style={[
                styles.dot,
                darkMode && styles.dotDark,
                index === pageIndex && styles.dotActive,
              ]}
            />
          ))}
        </View>
        <View style={styles.actions}>
          <Pressable
            accessibilityLabel="Previous introduction page"
            disabled={pageIndex === 0 || finishing}
            onPress={() => setPageIndex(current => current - 1)}
            style={({pressed}) => [
              styles.backButton,
              darkMode && styles.backButtonDark,
              pageIndex === 0 && styles.hiddenButton,
              pressed && styles.pressed,
            ]}>
            <ChevronLeft
              color={darkMode ? colors.darkInk : colors.ink}
              size={22}
              strokeWidth={2.25}
            />
          </Pressable>
          <Pressable
            accessibilityLabel={isLastPage ? 'Get started' : 'Next page'}
            disabled={finishing}
            onPress={
              isLastPage
                ? finish
                : () => setPageIndex(current => current + 1)
            }
            style={({pressed}) => [
              styles.nextButton,
              pressed && styles.pressed,
              finishing && styles.disabled,
            ]}>
            <GoldGradientBackground borderRadius={16} />
            {finishing ? (
              <ActivityIndicator color={colors.ink} />
            ) : (
              <>
                <Text style={styles.nextButtonText}>
                  {isLastPage ? 'Get started' : 'Next'}
                </Text>
                <ChevronRight color={colors.ink} size={20} strokeWidth={2.5} />
              </>
            )}
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

export default GettingStartedScreen;
