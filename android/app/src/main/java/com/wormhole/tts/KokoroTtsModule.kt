package com.wormhole.tts



import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors
import java.io.File
import java.util.UUID
import java.io.BufferedInputStream
import java.io.FileInputStream
import java.io.FileOutputStream
import java.net.URL

import android.media.MediaPlayer
import org.apache.commons.compress.archivers.tar.TarArchiveInputStream
import org.apache.commons.compress.compressors.bzip2.BZip2CompressorInputStream

class KokoroTtsModule(
    reactContext: ReactApplicationContext,
): ReactContextBaseJavaModule(reactContext) {
    
    private val engine = KokoroEngine()
    private val executor = Executors.newSingleThreadExecutor()
    private val modelExecutor = Executors.newSingleThreadExecutor()
    
    private var mediaPlayer: MediaPlayer? = null
    
    private var listenerCount = 0
    private var currentAudioPath: String? = null
    
    private var playbackCompletionPromise: Promise? = null
    
    companion object {
        private const val PLAYBACK_FINISHED_EVENT = "KokoroPlaybackFinished"
        private const val MODEL_URL =
            "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-en-v0_19.tar.bz2"
        private const val MODEL_FOLDER = "kokoro-en-v0_19"
        private const val ARCHIVE_FOLDER = "kokoro-int8-en-v0_19"
    }
    
    override fun getName(): String {
        return "KokoroTts"
    }
    
    // ----------------------- Kokoro Model Implementation -------------------------- 
    
    @ReactMethod
    fun initialize(
        modelDirectory: String,
        threadCount: Double,
        promise: Promise,
    ) {
        executor.execute {
            try {
                val info = engine.initialize(
                    modelDirectory = modelDirectory,
                    threadCount = threadCount.toInt(),
                )
                
                val result = Arguments.createMap().apply {
                    // Add modelPath as a string.
                    putString("modelPath", info.modelPath)
                    // Add sampleRate as an integer.
                    putInt("sampleRate", info.sampleRate)
                    // Add speakerCount as an integer.
                    putInt("speakerCount", info.speakerCount)
                    // Add loadTimeMs as a double.
                    putDouble("loadTimeMs", info.loadTimeMs.toDouble())
                    // Add threadCount as an integer.
                    putInt("threadCount", info.threadCount)
                }
                
                promise.resolve(result)
            } catch (error: Throwable) {
                promise.reject(
                    "E_KOKORO_INITIALIZE",
                    error.message,
                    error,
                )
            }
        }
    }
    
    override fun invalidate() {
        executor.execute {
            engine.release()
        }
        
        // Already-submitted operations execute in order:
        // initialize/synthesize → release → shutdown.
        executor.shutdown()
        modelExecutor.shutdownNow()
        
        reactApplicationContext.runOnUiQueueThread {
            playbackCompletionPromise?.resolve(false)
            playbackCompletionPromise = null
    
            mediaPlayer?.release()
            mediaPlayer = null
            currentAudioPath = null
        }
        
        super.invalidate()
    }
    
    @ReactMethod
    fun synthesize(
        text: String,
        voiceId: Double,
        speed: Double,
        promise: Promise,
    ) {
        executor.execute {
            try {
                val result = engine.synthesize(
                    text = text,
                    voiceId = voiceId.toInt(),
                    speed = speed.toFloat(),
                )
                
                val outputDirectory = File(
                    reactApplicationContext.cacheDir,
                    "kokoro-audio",
                )
                
                val outputFile = File(
                    outputDirectory,
                    "${UUID.randomUUID()}.wav",
                )
                
                val wavFile = WavWriter.write(
                    audio = result.audio,
                    outputPath = outputFile.absolutePath,
                )
                
                val response = Arguments.createMap().apply {
                    putString("filePath", wavFile.absolutePath)
                    putInt("sampleRate", result.audio.sampleRate)
                    putDouble("generationMs", result.generationMs.toDouble())
                    putDouble("durationMs", result.durationMs.toDouble())
                    putDouble("realTimeFactor", result.realTimeFactor)
                    putDouble("sizeBytes", wavFile.length().toDouble())
                }
                
                promise.resolve(response)
            } catch (error: Throwable) {
                promise.reject(
                    "E_KOKORO_SYNTHESIZE",
                    error.message ?: "Speech synthesis failed",
                    error,
                )
            }
        }
    }  
    
    @ReactMethod
    fun prepareModelDirectory(promise: Promise) {
        try {
            val directory = getModelDirectory()
            
            check(directory.isDirectory || directory.mkdirs()) {
                "Unable to create model directory: ${directory.absolutePath}"
            }
            
            promise.resolve(directory.absolutePath)
        } catch (error: Throwable) {
            promise.reject(
                "E_KOKORO_MODEL_DIRECTORY",
                error.message,
                error,
            )
        }
    }
    
    // ----------------------- Kokoro Model Control -------------------------- 
    
    @ReactMethod
    fun play(filePath: String, promise: Promise) {
        reactApplicationContext.runOnUiQueueThread {
            try {
                val audioFile = File(filePath).canonicalFile
                
                currentAudioPath = audioFile.absolutePath
                
                require(audioFile.isFile) {
                    "Audio file does not exist: ${audioFile.absolutePath}"
                }
                
                mediaPlayer?.release()
                
                val newPlayer = MediaPlayer()
                mediaPlayer = newPlayer
                
                newPlayer.setDataSource(audioFile.absolutePath)
                
                newPlayer.setOnCompletionListener { 
                    completedPlayer -> 
                    if (mediaPlayer !== completedPlayer) {
                        completedPlayer.release()
                        return@setOnCompletionListener 
                    }
                    
                    val completedPath = currentAudioPath
                    val completionPromise = playbackCompletionPromise
                    playbackCompletionPromise = null
                    
                    completedPlayer.release()
                    mediaPlayer = null
                    currentAudioPath = null
                    
                    completionPromise?.resolve(true)
                    
                    if (completedPath != null) {
                        emitPlaybackFinished(completedPath)
                    }
                }
                
                newPlayer.prepare()
                
                val durationMs = newPlayer.duration
                
                newPlayer.start()
                promise.resolve(durationMs)
            } catch (error: Throwable) {
                playbackCompletionPromise?.resolve(false)
                playbackCompletionPromise = null
                
                mediaPlayer?.release()
                mediaPlayer = null
                currentAudioPath = null
                
                promise.reject(
                    "E_KOKORO_PLAYBACK",
                    error.message ?: "Audio playback failed",
                    error,
                )
            }
        }
    }
    
    @ReactMethod
    fun stop() {
        reactApplicationContext.runOnUiQueueThread {
            playbackCompletionPromise?.resolve(false)
            playbackCompletionPromise = null
            
            mediaPlayer?.release()
            mediaPlayer = null
            currentAudioPath = null
        }
    }
    
    @ReactMethod
    fun pause(promise: Promise) {
        reactApplicationContext.runOnUiQueueThread {
            try {
                val player = checkNotNull(mediaPlayer) {
                    "Nothing is currently loaded."
                }
                
                if (player.isPlaying) {
                    player.pause()
                }
                
                promise.resolve(player.currentPosition)
            } catch (error: Throwable) {
                promise.reject(
                    "E_KOKORO_PAUSE",
                    error.message ?: "Unable to pause playback",
                    error,
                )
            }
        }
    }
    
    @ReactMethod
    fun resume(promise: Promise) {
        reactApplicationContext.runOnUiQueueThread {
            try {
                val player = checkNotNull(mediaPlayer) {
                    "Nothing is currently paused."
                }
                
                if (!player.isPlaying) {
                    player.start()
                }
                
                promise.resolve(player.currentPosition)
            } catch (error: Throwable) {
                promise.reject(
                    "E_KOKORO_RESUME",
                    error.message ?: "Unable to resume playback",
                    error,
                )
            }
        }
    }

    @ReactMethod
    fun getModelStatus(promise: Promise) {
        modelExecutor.execute {
            try {
                promise.resolve(createModelStatus())
            } catch (error: Throwable) {
                promise.reject(
                    "E_KOKORO_MODEL_STATUS",
                    error.message ?: "Unable to inspect Kokoro model",
                    error,
                )
            }
        }
    }

    @ReactMethod
    fun downloadModel(promise: Promise) {
        modelExecutor.execute {
            val modelsDirectory = File(reactApplicationContext.filesDir, "models")
            val targetDirectory = getModelDirectory()
            val stagingDirectory = File(
                modelsDirectory,
                ".kokoro-download-${UUID.randomUUID()}",
            )
            val archiveFile = File(
                reactApplicationContext.cacheDir,
                "kokoro-int8-en-v0_19-${UUID.randomUUID()}.tar.bz2",
            )

            try {
                if (isModelInstalled(targetDirectory)) {
                    promise.resolve(createModelStatus())
                    return@execute
                }

                check(modelsDirectory.isDirectory || modelsDirectory.mkdirs()) {
                    "Unable to create models directory"
                }
                check(stagingDirectory.mkdirs()) {
                    "Unable to create model staging directory"
                }

                val connection = URL(MODEL_URL).openConnection().apply {
                    connectTimeout = 30_000
                    readTimeout = 60_000
                }
                connection.getInputStream().use { input ->
                    FileOutputStream(archiveFile).use { output ->
                        input.copyTo(output, 128 * 1024)
                    }
                }

                BZip2CompressorInputStream(
                    BufferedInputStream(FileInputStream(archiveFile)),
                ).use { compressed ->
                    TarArchiveInputStream(compressed).use { archive ->
                        var entry = archive.nextTarEntry
                        while (entry != null) {
                            if (!entry.isSymbolicLink && !entry.isLink) {
                                val destination = File(stagingDirectory, entry.name)
                                    .canonicalFile
                                val stagingPath = stagingDirectory.canonicalPath + File.separator
                                check(destination.path.startsWith(stagingPath)) {
                                    "Unsafe path in Kokoro model archive"
                                }

                                if (entry.isDirectory) {
                                    check(destination.isDirectory || destination.mkdirs()) {
                                        "Unable to create ${destination.absolutePath}"
                                    }
                                } else {
                                    val parent = requireNotNull(destination.parentFile) {
                                        "Archive entry has no parent directory"
                                    }
                                    check(parent.isDirectory || parent.mkdirs()) {
                                        "Unable to create ${parent.absolutePath}"
                                    }
                                    FileOutputStream(destination).use { output ->
                                        archive.copyTo(output, 128 * 1024)
                                    }
                                }
                            }
                            entry = archive.nextTarEntry
                        }
                    }
                }

                val extractedDirectory = File(stagingDirectory, ARCHIVE_FOLDER)
                check(isModelInstalled(extractedDirectory)) {
                    "Downloaded Kokoro model is incomplete"
                }

                if (targetDirectory.exists()) {
                    check(targetDirectory.deleteRecursively()) {
                        "Unable to replace the incomplete Kokoro model"
                    }
                }
                check(extractedDirectory.renameTo(targetDirectory)) {
                    "Unable to install the downloaded Kokoro model"
                }

                promise.resolve(createModelStatus())
            } catch (error: Throwable) {
                promise.reject(
                    "E_KOKORO_MODEL_DOWNLOAD",
                    error.message ?: "Unable to download Kokoro model",
                    error,
                )
            } finally {
                archiveFile.delete()
                stagingDirectory.deleteRecursively()
            }
        }
    }

    private fun getModelDirectory(): File = File(
        reactApplicationContext.filesDir,
        "models/$MODEL_FOLDER",
    )

    private fun isModelInstalled(directory: File): Boolean =
        directory.isDirectory &&
            (File(directory, "model.int8.onnx").isFile ||
                File(directory, "model.onnx").isFile) &&
            File(directory, "voices.bin").isFile &&
            File(directory, "tokens.txt").isFile &&
            File(directory, "espeak-ng-data").isDirectory

    private fun directorySize(directory: File): Long =
        if (!directory.exists()) {
            0L
        } else {
            directory.walkTopDown()
                .filter { it.isFile }
                .sumOf { it.length() }
        }

    private fun createModelStatus() = Arguments.createMap().apply {
        val directory = getModelDirectory()
        putString("directory", directory.absolutePath)
        putBoolean("installed", isModelInstalled(directory))
        putDouble("sizeBytes", directorySize(directory).toDouble())
    }

    @ReactMethod
    fun getPlaybackPosition(promise: Promise) {
        reactApplicationContext.runOnUiQueueThread {
            try {
                val player = checkNotNull(mediaPlayer) {
                    "Nothing is currently loaded."
                }

                val result = Arguments.createMap().apply {
                    putInt("positionMs", player.currentPosition)
                    putInt("durationMs", player.duration.coerceAtLeast(0))
                    putBoolean("isPlaying", player.isPlaying)
                }

                promise.resolve(result)
            } catch (error: Throwable) {
                promise.reject(
                    "E_KOKORO_PLAYBACK_POSITION",
                    error.message ?: "Unable to read playback position",
                    error,
                )
            }
        }
    }
    
    // ----------------------- Kokoro Model Chunk Process Implementation -------------------------- 
    
    @ReactMethod
    fun addListener(eventName: String) {
        listenerCount += 1
    }
    
    @ReactMethod
    fun removeListeners(count: Double) {
        listenerCount = (listenerCount - count.toInt()).coerceAtLeast(0)
    }
    
    private fun emitPlaybackFinished(filePath: String) {
        
        val payload = Arguments.createMap().apply {
            putString("filePath", filePath)
        }
        
        reactApplicationContext.emitDeviceEvent(
            PLAYBACK_FINISHED_EVENT, 
            payload,
        )
    }
    
    @ReactMethod
    fun waitForPlaybackCompletion(promise: Promise) {
        reactApplicationContext.runOnUiQueueThread {
            playbackCompletionPromise?.resolve(false)
            playbackCompletionPromise = promise
        }
    }
}
