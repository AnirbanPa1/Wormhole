import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, BackHandler, StatusBar, StyleSheet, View } from 'react-native';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { PdfUtil } from 'react-native-pdf-light';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import LibraryScreen from './src/screens/LibraryScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import SavedWordsScreen from './src/screens/SavedWordsScreen';
import { initDictionary } from './src/services/dictionary.service';
import {
  loadLibrary,
  removeImportedPdf,
  saveLibrary,
} from './src/storage/library';
import { removeTextLayer } from './src/storage/text-layers';
import type { LibraryDocument } from './src/types/library';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import ImmersiveListeningScreen from './src/screens/ImmersiveListeningScreen';
import GettingStartedScreen from './src/screens/GettingStartedScreen';
import type { MainTab } from './src/components/BottomNavigation';
import {
  recordDocumentOpened,
  recordReadingProgress,
} from './src/features/library/library-progress';
import {
  completeGettingStarted,
  hasCompletedGettingStarted,
} from './src/storage/getting-started';

import { KokoroTtsProvider } from './src/features/tts/KokoroTtsProvider';
import {
  AppSettingsProvider,
  useAppSettings,
} from './src/features/settings/AppSettingsProvider';

function AppStatusBar({
  readerOpen,
  immersiveOpen,
}: {
  readerOpen: boolean;
  immersiveOpen: boolean;
}): React.JSX.Element {
  const { darkMode } = useAppSettings();
  return (
    <StatusBar
      barStyle={
        immersiveOpen
          ? darkMode
            ? 'light-content'
            : 'dark-content'
          : readerOpen || darkMode
          ? 'light-content'
          : 'dark-content'
      }
    />
  );
}

function App(): React.JSX.Element {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [selected, setSelected] = useState<LibraryDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<MainTab>('library');
  const [immersiveOpen, setImmersiveOpen] = useState(false);
  const [onboardingChecked, setOnboardingChecked] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const documentsRef = useRef<LibraryDocument[]>([]);
  const librarySaveQueue = useRef<Promise<void>>(Promise.resolve());

  const navigate = useCallback((tab: MainTab) => {
    setView(tab);
  }, []);

  useEffect(() => {
    if (view === 'library' || selected) {
      return;
    }

    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        setView('library');
        return true;
      },
    );
    return () => subscription.remove();
  }, [selected, view]);

  useEffect(() => {
    loadLibrary()
      .then(storedDocuments => {
        documentsRef.current = storedDocuments;
        setDocuments(storedDocuments);
      })
      .catch(() => {
        Alert.alert(
          'Library unavailable',
          'Your saved books could not be loaded.',
        );
      })
      .finally(() => setLoading(false));
    initDictionary();
  }, []);

  useEffect(() => {
    hasCompletedGettingStarted()
      .then(completed => setOnboardingOpen(!completed))
      .catch(() => setOnboardingOpen(true))
      .finally(() => setOnboardingChecked(true));
  }, []);

  const finishGettingStarted = useCallback(async () => {
    await completeGettingStarted();
    setOnboardingOpen(false);
  }, []);

  const enqueueLibrarySave = useCallback((next: LibraryDocument[]) => {
    const pendingSave = librarySaveQueue.current
      .catch(() => undefined)
      .then(() => saveLibrary(next));
    librarySaveQueue.current = pendingSave.catch(() => undefined);
    return pendingSave;
  }, []);

  const persist = useCallback(
    async (next: LibraryDocument[]) => {
      documentsRef.current = next;
      setDocuments(next);
      await enqueueLibrarySave(next);
    },
    [enqueueLibrarySave],
  );

  const updateDocument = useCallback(
    (
      id: string,
      update: (document: LibraryDocument) => LibraryDocument,
      showSaveError = false,
    ): LibraryDocument | null => {
      let updatedDocument: LibraryDocument | null = null;
      const next = documentsRef.current.map(document => {
        if (document.id !== id) {
          return document;
        }
        updatedDocument = update(document);
        return updatedDocument;
      });

      if (!updatedDocument) {
        return null;
      }

      documentsRef.current = next;
      setDocuments(next);
      setSelected(current => (current?.id === id ? updatedDocument : current));
      enqueueLibrarySave(next).catch(() => {
        if (showSaveError) {
          Alert.alert(
            'Progress not saved',
            'Wormhole could not save this page.',
          );
        }
      });
      return updatedDocument;
    },
    [enqueueLibrarySave],
  );

  const importPdf = useCallback(async () => {
    if (importing) {
      return;
    }

    setImporting(true);
    try {
      const [picked] = await pick({
        type: [types.pdf],
        allowMultiSelection: false,
        mode: 'import',
      });

      if (!picked.hasRequestedType) {
        throw new Error('Please choose a PDF file.');
      }

      const safeName = (picked.name ?? `book-${Date.now()}.pdf`).replace(
        /[^a-zA-Z0-9._-]/g,
        '_',
      );
      const [copy] = await keepLocalCopy({
        files: [{ uri: picked.uri, fileName: `${Date.now()}-${safeName}` }],
        destination: 'documentDirectory',
      });

      if (copy.status !== 'success') {
        throw new Error(copy.copyError || 'The PDF could not be copied.');
      }

      const pageCount = await PdfUtil.getPageCount(copy.localUri);
      const document: LibraryDocument = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
        title: (picked.name ?? 'Untitled book').replace(/\.pdf$/i, ''),
        localUri: copy.localUri,
        pageCount,
        currentPage: 0,
        importedAt: new Date().toISOString(),
        size: picked.size,
        hasTextLayer: false,
      };

      await persist([document, ...documentsRef.current]);
      setSelected(document);
    } catch (error) {
      if (
        isErrorWithCode(error) &&
        error.code === errorCodes.OPERATION_CANCELED
      ) {
        return;
      }
      Alert.alert(
        'Could not import PDF',
        error instanceof Error ? error.message : 'Please try another file.',
      );
    } finally {
      setImporting(false);
    }
  }, [importing, persist]);

  const saveProgress = useCallback(
    (id: string, currentPage: number) => {
      const readAt = new Date().toISOString();
      updateDocument(
        id,
        document => recordReadingProgress(document, currentPage, readAt),
        true,
      );
    },
    [updateDocument],
  );

  const openDocument = useCallback(
    (document: LibraryDocument) => {
      setImmersiveOpen(false);
      const openedAt = new Date().toISOString();
      const updated = updateDocument(
        document.id,
        current => recordDocumentOpened(current, openedAt),
        true,
      );
      setSelected(updated ?? recordDocumentOpened(document, openedAt));
    },
    [updateDocument],
  );

  const markTextLayerReady = useCallback(
    (id: string) => {
      updateDocument(id, document => ({ ...document, hasTextLayer: true }));
    },
    [updateDocument],
  );

  const removeBook = useCallback(
    async (id: string) => {
      const document = documentsRef.current.find(item => item.id === id);
      if (!document) {
        return;
      }

      const next = documentsRef.current.filter(item => item.id !== id);
      await persist(next);
      await Promise.all([
        removeImportedPdf(document),
        removeTextLayer(document.id),
      ]);
    },
    [persist],
  );

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <AppSettingsProvider>
          <KokoroTtsProvider>
            <AppStatusBar
              immersiveOpen={immersiveOpen}
              readerOpen={selected !== null}
            />
            {!onboardingChecked ? (
              <View style={styles.bootScreen} />
            ) : onboardingOpen ? (
              <GettingStartedScreen onFinish={finishGettingStarted} />
            ) : selected ? (
              <View style={styles.readerStack}>
                <View
                  accessibilityElementsHidden={immersiveOpen}
                  importantForAccessibility={
                    immersiveOpen ? 'no-hide-descendants' : 'auto'
                  }
                  style={styles.readerStack}
                >
                  <ReaderScreen
                    document={selected}
                    onBack={() => {
                      setImmersiveOpen(false);
                      setSelected(null);
                    }}
                    onOpenImmersive={() => setImmersiveOpen(true)}
                    onPageChange={page => saveProgress(selected.id, page)}
                    onTextLayerReady={markTextLayerReady}
                  />
                </View>
                {immersiveOpen && (
                  <View style={styles.immersiveLayer}>
                    <ImmersiveListeningScreen
                      document={selected}
                      onClose={() => setImmersiveOpen(false)}
                    />
                  </View>
                )}
              </View>
            ) : view === 'saved' ? (
              <SavedWordsScreen onNavigate={navigate} />
            ) : view === 'profile' ? (
              <ProfileScreen
                documents={documents}
                onNavigate={navigate}
                onRemoveBook={removeBook}
              />
            ) : view === 'settings' ? (
              <SettingsScreen
                onNavigate={navigate}
                onShowGettingStarted={() => setOnboardingOpen(true)}
              />
            ) : (
              <LibraryScreen
                documents={documents}
                loading={loading}
                importing={importing}
                onImport={importPdf}
                onOpen={openDocument}
                onNavigate={navigate}
              />
            )}
          </KokoroTtsProvider>
        </AppSettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  bootScreen: { flex: 1, backgroundColor: '#FBFAF7' },
  readerStack: { flex: 1 },
  immersiveLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 20,
    elevation: 20,
  },
});

export default App;
