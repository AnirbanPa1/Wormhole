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
import java.io.InputStream
import java.io.OutputStream
import java.net.URL
import java.security.MessageDigest
import java.lang.ref.WeakReference

import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.session.PlaybackState
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
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
    private var currentPlaybackTitle = "Wormhole narration"
    private var currentPlaybackSubtitle = "Offline narration"
    
    private var playbackCompletionPromise: Promise? = null
    
    companion object {
        private const val PLAYBACK_FINISHED_EVENT = "KokoroPlaybackFinished"
        private const val MEDIA_CONTROL_EVENT = "KokoroMediaControl"
        private const val MODEL_DOWNLOAD_PROGRESS_EVENT =
            "KokoroModelDownloadProgress"
        private const val MODEL_DOWNLOAD_CHANNEL = "kokoro_model_download"
        private const val MODEL_DOWNLOAD_NOTIFICATION_ID = 82019
        private const val MODEL_URL =
            "https://github.com/k2-fsa/sherpa-onnx/releases/download/tts-models/kokoro-int8-en-v0_19.tar.bz2"
        private const val MODEL_FOLDER = "kokoro-en-v0_19"
        private const val ARCHIVE_FOLDER = "kokoro-int8-en-v0_19"
        private const val MODEL_ARCHIVE_SHA256 =
            "c9f0dd393615805b0bab050c340834d5e684e732aec91c0e860cd30e982c08bd"
        private const val MAX_ARCHIVE_BYTES = 120L * 1024L * 1024L
        private const val MAX_EXTRACTED_BYTES = 600L * 1024L * 1024L
        private const val MAX_ENTRY_BYTES = 500L * 1024L * 1024L
        private const val MAX_ARCHIVE_ENTRIES = 2_000

        @Volatile
        private var activeInstance: WeakReference<KokoroTtsModule>? = null

        fun handleMediaControl(control: String): Boolean {
            val module = activeInstance?.get() ?: return false
            module.reactApplicationContext.runOnUiQueueThread {
                module.handleMediaControlOnUiThread(control)
            }
            return true
        }
    }

    init {
        activeInstance = WeakReference(this)
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
                val safeModelDirectory = requireDescendant(
                    File(modelDirectory),
                    File(reactApplicationContext.filesDir, "models"),
                    "Kokoro model directory",
                )
                if (!isModelInstalled(safeModelDirectory)) {
                    promise.reject(
                        "E_KOKORO_MODEL_MISSING",
                        "The offline Kokoro voice model is not installed for this Wormhole build.",
                    )
                    return@execute
                }
                val info = engine.initialize(
                    modelDirectory = safeModelDirectory.absolutePath,
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
        if (activeInstance?.get() === this) {
            activeInstance = null
        }
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
            KokoroPlaybackService.stopPlayback(reactApplicationContext)
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
    fun play(
        filePath: String,
        title: String,
        subtitle: String,
        promise: Promise,
    ) {
        reactApplicationContext.runOnUiQueueThread {
            try {
                val audioFile = requireDescendant(
                    File(filePath),
                    File(reactApplicationContext.cacheDir, "kokoro-audio"),
                    "Kokoro audio file",
                )
                
                currentAudioPath = audioFile.absolutePath
                currentPlaybackTitle = title.takeIf { it.isNotBlank() }
                    ?: "Wormhole narration"
                currentPlaybackSubtitle = subtitle.takeIf { it.isNotBlank() }
                    ?: "Offline narration"
                
                require(audioFile.isFile) {
                    "Audio file does not exist: ${audioFile.absolutePath}"
                }
                
                mediaPlayer?.release()
                
                val newPlayer = MediaPlayer()
                mediaPlayer = newPlayer
                newPlayer.setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                        .build(),
                )
                
                newPlayer.setDataSource(audioFile.absolutePath)
                
                newPlayer.setOnCompletionListener { 
                    completedPlayer -> 
                    if (mediaPlayer !== completedPlayer) {
                        completedPlayer.release()
                        return@setOnCompletionListener 
                    }
                    
                    val completedPath = currentAudioPath
                    val completionPromise = playbackCompletionPromise
                    val completedDuration = completedPlayer.duration
                        .coerceAtLeast(0)
                        .toLong()
                    playbackCompletionPromise = null
                    
                    completedPlayer.release()
                    mediaPlayer = null
                    currentAudioPath = null

                    KokoroPlaybackService.showPlayback(
                        reactApplicationContext,
                        currentPlaybackTitle,
                        "Preparing the next passage…",
                        completedDuration,
                        completedDuration,
                        PlaybackState.STATE_BUFFERING,
                    )
                    
                    completionPromise?.resolve(true)
                    
                    if (completedPath != null) {
                        emitPlaybackFinished(completedPath)
                    }
                }
                
                newPlayer.prepare()
                
                val durationMs = newPlayer.duration
                
                newPlayer.start()
                KokoroPlaybackService.showPlayback(
                    reactApplicationContext,
                    currentPlaybackTitle,
                    currentPlaybackSubtitle,
                    durationMs.toLong(),
                    0L,
                    PlaybackState.STATE_PLAYING,
                )
                promise.resolve(durationMs)
            } catch (error: Throwable) {
                playbackCompletionPromise?.resolve(false)
                playbackCompletionPromise = null
                
                mediaPlayer?.release()
                mediaPlayer = null
                currentAudioPath = null
                KokoroPlaybackService.stopPlayback(reactApplicationContext)
                
                promise.reject(
                    "E_KOKORO_PLAYBACK",
                    error.message ?: "Audio playback failed",
                    error,
                )
            }
        }
    }
    
    @ReactMethod
    fun stop(keepNotification: Boolean) {
        reactApplicationContext.runOnUiQueueThread {
            stopPlaybackOnUiThread(keepNotification)
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

                KokoroPlaybackService.showPlayback(
                    reactApplicationContext,
                    currentPlaybackTitle,
                    currentPlaybackSubtitle,
                    player.duration.coerceAtLeast(0).toLong(),
                    player.currentPosition.coerceAtLeast(0).toLong(),
                    PlaybackState.STATE_PAUSED,
                )
                
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

                KokoroPlaybackService.showPlayback(
                    reactApplicationContext,
                    currentPlaybackTitle,
                    currentPlaybackSubtitle,
                    player.duration.coerceAtLeast(0).toLong(),
                    player.currentPosition.coerceAtLeast(0).toLong(),
                    PlaybackState.STATE_PLAYING,
                )
                
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
                val contentLength = connection.contentLengthLong
                check(contentLength < 0L || contentLength <= MAX_ARCHIVE_BYTES) {
                    "Kokoro model archive exceeds the download safety limit"
                }
                emitModelDownloadProgress("downloading", 0L, contentLength)
                var lastProgressEmission = 0L
                connection.getInputStream().use { input ->
                    FileOutputStream(archiveFile).use { output ->
                        copyWithLimit(
                            input = input,
                            output = output,
                            maxBytes = MAX_ARCHIVE_BYTES,
                            label = "Kokoro model archive",
                        ) { copiedBytes ->
                            if (
                                copiedBytes - lastProgressEmission >= 512L * 1024L ||
                                (contentLength > 0L && copiedBytes >= contentLength)
                            ) {
                                lastProgressEmission = copiedBytes
                                emitModelDownloadProgress(
                                    "downloading",
                                    copiedBytes,
                                    contentLength,
                                )
                            }
                        }
                    }
                }
                emitModelDownloadProgress(
                    "verifying",
                    archiveFile.length(),
                    contentLength,
                )
                check(sha256(archiveFile) == MODEL_ARCHIVE_SHA256) {
                    "Kokoro model archive failed integrity verification"
                }

                emitModelDownloadProgress(
                    "installing",
                    archiveFile.length(),
                    contentLength,
                )
                BZip2CompressorInputStream(
                    BufferedInputStream(FileInputStream(archiveFile)),
                ).use { compressed ->
                    TarArchiveInputStream(compressed).use { archive ->
                        var entryCount = 0
                        var extractedBytes = 0L
                        var entry = archive.nextTarEntry
                        while (entry != null) {
                            entryCount += 1
                            check(entryCount <= MAX_ARCHIVE_ENTRIES) {
                                "Kokoro model archive contains too many entries"
                            }
                            check(!entry.isSymbolicLink && !entry.isLink) {
                                "Kokoro model archive contains a link entry"
                            }
                            check(entry.isDirectory || entry.isFile) {
                                "Kokoro model archive contains an unsupported entry"
                            }
                            check(entry.size in 0L..MAX_ENTRY_BYTES) {
                                "Kokoro model archive entry exceeds the safety limit"
                            }

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
                                val remainingBytes = MAX_EXTRACTED_BYTES - extractedBytes
                                check(remainingBytes > 0L) {
                                    "Kokoro model archive exceeds the extraction safety limit"
                                }
                                FileOutputStream(destination).use { output ->
                                    extractedBytes += copyWithLimit(
                                        input = archive,
                                        output = output,
                                        maxBytes = minOf(MAX_ENTRY_BYTES, remainingBytes),
                                        label = "Kokoro model archive extraction",
                                    )
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

                emitModelDownloadProgress(
                    "complete",
                    contentLength.coerceAtLeast(archiveFile.length()),
                    contentLength,
                )
                promise.resolve(createModelStatus())
            } catch (error: Throwable) {
                emitModelDownloadProgress("failed", 0L, -1L)
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

    private fun requireDescendant(
        candidate: File,
        root: File,
        label: String,
    ): File {
        val canonicalCandidate = candidate.canonicalFile
        val canonicalRoot = root.canonicalFile
        val rootPrefix = canonicalRoot.path + File.separator
        require(canonicalCandidate.path.startsWith(rootPrefix)) {
            "$label must stay inside ${canonicalRoot.absolutePath}"
        }
        return canonicalCandidate
    }

    private fun copyWithLimit(
        input: InputStream,
        output: OutputStream,
        maxBytes: Long,
        label: String,
        onProgress: ((Long) -> Unit)? = null,
    ): Long {
        val buffer = ByteArray(128 * 1024)
        var total = 0L
        while (true) {
            val count = input.read(buffer)
            if (count < 0) {
                return total
            }
            val nextTotal = total + count
            check(nextTotal <= maxBytes) {
                "$label exceeds the safety limit"
            }
            output.write(buffer, 0, count)
            total = nextTotal
            onProgress?.invoke(total)
        }
    }

    private fun sha256(file: File): String {
        val digest = MessageDigest.getInstance("SHA-256")
        FileInputStream(file).use { input ->
            val buffer = ByteArray(128 * 1024)
            while (true) {
                val count = input.read(buffer)
                if (count < 0) {
                    break
                }
                digest.update(buffer, 0, count)
            }
        }
        return digest.digest().joinToString("") { byte -> "%02x".format(byte) }
    }

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

    private fun handleMediaControlOnUiThread(control: String) {
        when (control) {
            KokoroPlaybackService.CONTROL_PAUSE -> {
                val player = mediaPlayer ?: return
                if (player.isPlaying) {
                    player.pause()
                }
                KokoroPlaybackService.showPlayback(
                    reactApplicationContext,
                    currentPlaybackTitle,
                    currentPlaybackSubtitle,
                    player.duration.coerceAtLeast(0).toLong(),
                    player.currentPosition.coerceAtLeast(0).toLong(),
                    PlaybackState.STATE_PAUSED,
                )
                emitMediaControl(control)
            }
            KokoroPlaybackService.CONTROL_PLAY -> {
                val player = mediaPlayer ?: return
                if (!player.isPlaying) {
                    player.start()
                }
                KokoroPlaybackService.showPlayback(
                    reactApplicationContext,
                    currentPlaybackTitle,
                    currentPlaybackSubtitle,
                    player.duration.coerceAtLeast(0).toLong(),
                    player.currentPosition.coerceAtLeast(0).toLong(),
                    PlaybackState.STATE_PLAYING,
                )
                emitMediaControl(control)
            }
            KokoroPlaybackService.CONTROL_STOP -> {
                stopPlaybackOnUiThread(keepNotification = false)
                emitMediaControl(control)
            }
            KokoroPlaybackService.CONTROL_PREVIOUS,
            KokoroPlaybackService.CONTROL_NEXT -> emitMediaControl(control)
        }
    }

    private fun stopPlaybackOnUiThread(keepNotification: Boolean) {
        val player = mediaPlayer
        val durationMs = player?.duration?.coerceAtLeast(0)?.toLong() ?: 0L
        val positionMs = player?.currentPosition?.coerceAtLeast(0)?.toLong() ?: 0L
        playbackCompletionPromise?.resolve(false)
        playbackCompletionPromise = null
        player?.release()
        mediaPlayer = null
        currentAudioPath = null
        if (keepNotification) {
            KokoroPlaybackService.showPlayback(
                reactApplicationContext,
                currentPlaybackTitle,
                "Preparing the selected passage…",
                durationMs,
                positionMs,
                PlaybackState.STATE_BUFFERING,
            )
        } else {
            KokoroPlaybackService.stopPlayback(reactApplicationContext)
        }
    }

    private fun emitMediaControl(control: String) {
        val payload = Arguments.createMap().apply {
            putString("action", control)
        }
        reactApplicationContext.emitDeviceEvent(MEDIA_CONTROL_EVENT, payload)
    }

    private fun emitModelDownloadProgress(
        phase: String,
        completedBytes: Long,
        totalBytes: Long,
    ) {
        val payload = Arguments.createMap().apply {
            putString("phase", phase)
            putDouble("completedBytes", completedBytes.toDouble())
            putDouble("totalBytes", totalBytes.toDouble())
            if (totalBytes > 0L) {
                putDouble(
                    "progress",
                    (completedBytes.toDouble() / totalBytes.toDouble())
                        .coerceIn(0.0, 1.0),
                )
            } else {
                putNull("progress")
            }
        }

        reactApplicationContext.emitDeviceEvent(
            MODEL_DOWNLOAD_PROGRESS_EVENT,
            payload,
        )
        showModelDownloadNotification(phase, completedBytes, totalBytes)
    }

    private fun showModelDownloadNotification(
        phase: String,
        completedBytes: Long,
        totalBytes: Long,
    ) {
        val manager = reactApplicationContext.getSystemService(
            Context.NOTIFICATION_SERVICE,
        ) as NotificationManager

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            manager.createNotificationChannel(
                NotificationChannel(
                    MODEL_DOWNLOAD_CHANNEL,
                    "Offline voice model downloads",
                    NotificationManager.IMPORTANCE_LOW,
                ).apply {
                    description = "Progress while Wormhole downloads offline narration"
                },
            )
        }

        val title = when (phase) {
            "verifying" -> "Verifying Kokoro model"
            "installing" -> "Installing Kokoro model"
            "complete" -> "Kokoro model ready"
            "failed" -> "Kokoro model download failed"
            else -> "Downloading Kokoro model"
        }
        val text = when {
            phase == "complete" -> "Offline narration is ready."
            phase == "failed" -> "Open Wormhole Settings to try again."
            phase == "downloading" && totalBytes > 0L -> {
                val percent = ((completedBytes * 100L) / totalBytes)
                    .coerceIn(0L, 100L)
                "$percent% downloaded"
            }
            phase == "downloading" -> "Download in progress"
            phase == "verifying" -> "Checking the downloaded model"
            else -> "Preparing files for offline narration"
        }

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(reactApplicationContext, MODEL_DOWNLOAD_CHANNEL)
        } else {
            Notification.Builder(reactApplicationContext)
        }
            .setSmallIcon(
                if (phase == "complete") {
                    android.R.drawable.stat_sys_download_done
                } else {
                    android.R.drawable.stat_sys_download
                },
            )
            .setContentTitle(title)
            .setContentText(text)
            .setOnlyAlertOnce(true)
            .setOngoing(phase != "complete" && phase != "failed")
            .setAutoCancel(phase == "complete" || phase == "failed")

        if (phase == "downloading") {
            if (totalBytes > 0L) {
                val percent = ((completedBytes * 100L) / totalBytes)
                    .coerceIn(0L, 100L)
                    .toInt()
                builder.setProgress(100, percent, false)
            } else {
                builder.setProgress(0, 0, true)
            }
        } else if (phase != "complete" && phase != "failed") {
            builder.setProgress(0, 0, true)
        }

        manager.notify(MODEL_DOWNLOAD_NOTIFICATION_ID, builder.build())
    }
    
    @ReactMethod
    fun waitForPlaybackCompletion(promise: Promise) {
        reactApplicationContext.runOnUiQueueThread {
            playbackCompletionPromise?.resolve(false)
            playbackCompletionPromise = promise
        }
    }
}
