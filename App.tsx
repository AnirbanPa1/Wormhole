import React, {useCallback, useEffect, useState} from 'react';
import {Alert, BackHandler, StatusBar, StyleSheet} from 'react-native';
import {
  errorCodes,
  isErrorWithCode,
  keepLocalCopy,
  pick,
  types,
} from '@react-native-documents/picker';
import {GestureHandlerRootView} from 'react-native-gesture-handler';
import {PdfUtil} from 'react-native-pdf-light';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import LibraryScreen from './src/screens/LibraryScreen';
import ReaderScreen from './src/screens/ReaderScreen';
import SavedWordsScreen from './src/screens/SavedWordsScreen';
import {initDictionary} from './src/services/dictionary.service';
import {loadLibrary, saveLibrary} from './src/storage/library';
import type {LibraryDocument} from './src/types/library';
import TtsSpikeScreen from './src/screens/TtsSpikeScreen';

type AppView = 'library' | 'saved' | 'tts';

function App(): React.JSX.Element {
  const [documents, setDocuments] = useState<LibraryDocument[]>([]);
  const [selected, setSelected] = useState<LibraryDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [view, setView] = useState<AppView>('tts');

  useEffect(() => {
    if (view !== 'saved' || selected) {
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
      .then(setDocuments)
      .catch(() => {
        Alert.alert('Library unavailable', 'Your saved books could not be loaded.');
      })
      .finally(() => setLoading(false));
    initDictionary();
  }, []);

  const persist = useCallback(async (next: LibraryDocument[]) => {
    setDocuments(next);
    await saveLibrary(next);
  }, []);

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
        files: [{uri: picked.uri, fileName: `${Date.now()}-${safeName}`}],
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

      await persist([document, ...documents]);
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
  }, [documents, importing, persist]);

  const saveProgress = useCallback((id: string, currentPage: number) => {
    setDocuments(current => {
      const next = current.map(document =>
        document.id === id ? {...document, currentPage} : document,
      );
      saveLibrary(next).catch(() => {
        Alert.alert('Progress not saved', 'Wormhole could not save this page.');
      });
      return next;
    });
    setSelected(current =>
      current?.id === id ? {...current, currentPage} : current,
    );
  }, []);

  const markTextLayerReady = useCallback((id: string) => {
    setDocuments(current => {
      const next = current.map(document =>
        document.id === id ? {...document, hasTextLayer: true} : document,
      );
      saveLibrary(next).catch(() => undefined);
      return next;
    });
    setSelected(current =>
      current?.id === id ? {...current, hasTextLayer: true} : current,
    );
  }, []);

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle={selected ? 'light-content' : 'dark-content'} />
        {view === 'tts' ? (
          <TtsSpikeScreen />
        ) : selected ? (
          <ReaderScreen
            document={selected}
            onBack={() => setSelected(null)}
            onPageChange={page => saveProgress(selected.id, page)}
            onTextLayerReady={markTextLayerReady}
          />
        ) : view === 'saved' ? (
          <SavedWordsScreen onBack={() => setView('library')} />
        ) : (
          <LibraryScreen
            documents={documents}
            loading={loading}
            importing={importing}
            onImport={importPdf}
            onOpen={setSelected}
            onShowSaved={() => setView('saved')}
          />
        )}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {flex: 1},
});

export default App;
