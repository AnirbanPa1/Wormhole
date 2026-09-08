package com.voxora.tts

import com.k2fsa.sherpa.onnx.GenerateAudio
import com.k2fsa.sherpa.onnx.OfflineTts
import com.k2fsa.sherpa.onnx.OfflineTtsConfig
import com.k2fsa.sherpa.onnx.OfflineTtsKokoroModelConfig
import com.k2fsa.sherpa.onnx.OfflineTtsModelConfig
import java.io.File

data class KokoroModelInfo(
    val modelPath: String,
    val sampleRate: Int,
    val speakerCount: Int,
    val loadTimeMs: Long,
    val threadCount: Int,
)

data class KokoroGenerationResult(
    val audio: GenerateAudio,
    val generationMs: Long,
    val durationMs: Long,
    val realTimeFactor: Double,
)


class KokoroEngine {
    private var tts: OfflineTts? = null

    private var loadedModelDirectory: String? = null
    private var loadedThreadCount: Int? = null

    /**
     * Loads Kokoro and keeps the native sherpa-onnx session alive.
     *
     * Expected model directory:
     *
     * kokoro/
     * ├── model.int8.onnx OR model.onnx
     * ├── voices.bin
     * ├── tokens.txt
     * ├── espeak-ng-data/
     * └── lexicon*.txt      (optional)
     */

    @Synchronized
    fun initialize(
        modelDirectory: String,
        threadCount: Int,
    ): KokoroModelInfo {
        require(threadCount > 0) {
            "threadCount must be greater than 0"
        }

        val directory = File(modelDirectory).canonicalFile

        require(directory.exists()) {
            "Kokoro model directory does not exist: ${directory.absolutePath}"
        }

        require(directory.isDirectory) {
            "Kokoro model path is not a directory: ${directory.absolutePath}"
        }

        /*
         * Prefer the quantized model because that is the model
         * Wormhole intends to benchmark first.
         */
        val modelFile = when {
            File(directory, "model.int8.onnx").isFile ->
                File(directory, "model.int8.onnx")

            File(directory, "model.onnx").isFile ->
                File(directory, "model.onnx")

            else -> throw IllegalArgumentException(
                "Missing kokoro model. Expected model.int8.onnx or model.onnx" + 
                "inside ${directory.absolutePath}",
            )
        }

        val voicesFile = File(directory, "voices.bin")
        val tokensFile = File(directory, "tokens.txt")
        val espeakDirectory = File(directory, "espeak-ng-data")

        require(voicesFile.isFile) {
            "Missing voices.bin: ${voicesFile.absolutePath}"
        }

        require(espeakDirectory.isDirectory) {
            "Missing espeak-ng-data directory: ${espeakDirectory.absolutePath}"
        }

        /*
         * initialize() should be idempotent.
         *
         * If the exact same model + thread configuration is already
         * loaded, don't load the ~82M parameter model again.
         */

        if (
            tts != null &&
            loadedModelDirectory == directory.absolutePath &&
            loadedThreadCount == threadCount
        ) {
            val engine = tts!!

            return KokoroModelInfo(
                modelPath = modelFile.absolutePath,
                sampleRate = engine.sampleRate,
                speakerCount = engine.numSpeakers,
                loadTimeMs = 0,
                threadCount = threadCount,
            )
        }

        /*
         * If another model/configuration was loaded previously,
         * dispose it before creating the new session.
         */

        release()

        val = kokoroBuilder = OfflineTtsKokoroModelConfig.builder()
                                                          .setModel(modelFile.absolutePath)
                                                          .setVoices(voicesFile.absolutePath)
                                                          .setTokens(tokensFile.absolutePath)
                                                          .setDataDir(espeakDirectory.absolutePath)

        /*
         * A lexicon isn't required by the standard English example,
         * but some sherpa Kokoro model packs include one.
         *
         * Use it when present.
         */

        findLexicon(directory)?.let { 
            lexicon -> kokoroBuilder.setLexicon(lexicon.absolutePath)
            }

        val KokoroConfig = kokoroBuilder.build()

        val modelConfig = OfflineTtsModelConfig.builder()
                                                .setKokoro(KokoroConfig)
                                                .setNumThreads(threadCount)
                                                .setDebug(false)
                                                .setProvider("cpu")
                                                .build()

        val config = OfflineTtsConfig.builder()
                                      .setModel(modelConfig)
                                      .build()

        val start = System.nanoTime()

        val newTts = OfflineTts(config)

        val loadTimeMs = (System.nanoTime() - start) / 1_000_000L

        tts = newTts
        loadedModelDirectory = directory.absolutePath
        loadedThreadCount = threadCount

        return KokoroModelInfo(
            modelPath = modelFile.absolutePath,
            sampleRate = newTts.sampleRate,
            speakerCount = newTts.numSpeakers,
            loadTimeMs = loadTimeMs,
            threadCount = threadCount,
        )
                                                        
    }

    /**
     * Runs Kokoro inference.
     *
     * This does NOT write a WAV file.
     * WavWriter.kt will handle that separately.
     */

    @Synchronized
    fun synthesize(
        text: String,
        voiceId: Int,
        speed: Float
    ): KokoroGenerationResult {
        val engine = tts
            ?: throw IllegalArgumentException(
                "Kokoro is not initialized. Call initialize() first.",
            )

        require(text.isNotBlank()) {
            "Cannot synthesize empty text"
        }

        require(speed > 0.0f) {
            "speed must be greater than 0"
        }

        val speakerCount = engine.numSpeakers

        require(
            speakerCount <= 0 || 
                voiceId in 0 until speakerCount
        ) {
            "Invalid vocieId $voiceId. " + "Available speakers: $speakerCount"
        }

        val start = System.nanoTime()

        val audio = engine.generate(
            text,
            voiceId,
            speed,
        )

        val generationNs = System.nanoTime() - start

        val generationMs = generationNs / 1_000_000L

        val samples = audio.samples
        val sampleRate = audio.sampleRate

        if (samples.isEmpty()) {
            throw IllegalArgumentException(
                "Kokoro generated zero audio samples",
            )
        }

        if (sampleRate <= 0) {
            throw IllegalArgumentException(
                "Kokoro returned invalid sample rate: $sampleRate",
            )
        }

        val rtf = 
            if (durationSeconds > 0.0) {
                generationSeconds / durationSeconds
            } else {
                Double.POSITIVE_INFINITY
            }

        return KokoroGenerationResult(
            audio = audio,
            generationMs = generationMs,
            durationMs = durationMs,
            realTimeFactor = rtf,
        )
    }

    /**
     * Frees the native sherpa-onnx TTS session.
     */
    @Synchronized
    fun release() {
        tts?.release()

        tts = null
        loadedModelDirectory = null
        loadedThreadCount = null
    }

    fun isInitialized(): Boolean {
        return tts != null
    }

    /**
     * Different Kokoro packs use slightly different lexicon names,
     * e.g. lexicon-us-en.txt.
     */
    private fun findLexicon(
        directory: File,
    ): File? {
        return directory
            .listFiles()
            ?.firstOrNull { file ->
                file.isFile &&
                    file.name.startsWith("lexicon") && 
                    file.name.endsWith(".txt")
            }
    }
}