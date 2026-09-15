package com.voxora.tts

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors
import java.io.File
import java.util.UUID

class KokoroTtsModule(
    reactContext: ReactApplicationContext,
): ReactContextBaseJavaModule(reactContext) {
    
    private val engine = KokoroEngine()
    private val executor = Executors.newSingleThreadExecutor()
    
    override fun getName(): String {
        return "KokoroTts"
    }
    
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
}