package com.voxora.tts



import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors
import java.io.File
import java.util.UUID

import android.media.MediaPlayer

class KokoroTtsModule(
    reactContext: ReactApplicationContext,
): ReactContextBaseJavaModule(reactContext) {
    
    private val engine = KokoroEngine()
    private val executor = Executors.newSingleThreadExecutor()
    
    private var mediaPlayer: MediaPlayer? = null
    
    private var listenerCount = 0
    private var currentAudioPath: String? = null
    
    private var playbackCompletionPromise: Promise? = null
    
    companion object {
        private const val PLAYBACK_FINISHED_EVENT = "KokoroPlaybackFinished"
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
            val directory = File(
                reactApplicationContext.filesDir,
                "models/kokoro-en-v0_19",
            )
            
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