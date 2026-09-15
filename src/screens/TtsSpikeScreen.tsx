import React, { useState } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context';
import { 
    initializeKokoro, 
    prepareKokoroModelDirectory, 
    synthesizeSpeech,
    type KokoroGenerationInfo, 
    type KokoroModelInfo
} from '../features/tts/kokoro-client';
import { Button, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

export default function TtsSpikeScreen(): React.JSX.Element {
    const [text, setText] = useState(
        'Welcome to Wormhole, our little library.'
    );

    const [modelInfo, setModelInfo] = useState<KokoroModelInfo | null>(null);
    const [generation, setGeneration] = useState<KokoroGenerationInfo | null>(null);

    const [status, setStatus] = useState('Not initialized');
    const [busy, setBusy] = useState(false);

    async function initialize(): Promise<void> {
        setBusy(true);
        setStatus('Loading Kokoro model...');

        try {
            const directory = await prepareKokoroModelDirectory();
            const info = await initializeKokoro(directory);

            setModelInfo(info);
            setStatus('Kokoro is ready.');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    }

    async function generate(): Promise<void> {
        setBusy(true);
        setGeneration(null);
        setStatus('Generating speech...');
        
        try {
            const result = await synthesizeSpeech(text, 2, 1);

            setGeneration(result);
            setStatus('WAV generated successfully');
        } catch (error) {
            setStatus(error instanceof Error ? error.message : String(error));
        } finally {
            setBusy(false);
        }
    }

  return (
    <SafeAreaView style={styles.screen}>
        <ScrollView contentContainerStyle={styles.content}>
            <Text style={styles.title}>Kokoro spike</Text>
            <Text style={styles.status}>{status}</Text>

            <Button 
                title="Initialize Kokoro"
                onPress={initialize}
                disabled={busy}
            />

            <TextInput 
                style={styles.input}
                value={text}
                onChangeText={setText}
                multiline
            />
            
            <Button 
                title='Generate WAV'
                onPress={generate}
                disabled={busy || !modelInfo || !text.trim()}
            />

            {modelInfo && (
                <View style={styles.result}>
                    <Text>{JSON.stringify(modelInfo, null, 2)}</Text>
                </View>
            )}

            {generation && (
                <View style={styles.result}>
                    <Text>{JSON.stringify(generation, null, 2)}</Text>
                </View>
            )}
        </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#f7f3eb',
    },

    content: {
        padding: 24,
        gap: 18,
    },

    title: {
        fontSize: 28,
        fontWeight: '700',
    },

    status: {
        fontSize: 16,
    },

    input: {
        minHeight: 120,
        borderWidth: 1,
        borderColor: '#aaa',
        borderRadius: 12,
        padding: 14,
        textAlignVertical: 'top',
        backgroundColor: '#fff',
        color: '#111',
    },

    result: {
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#fff',
    },
});