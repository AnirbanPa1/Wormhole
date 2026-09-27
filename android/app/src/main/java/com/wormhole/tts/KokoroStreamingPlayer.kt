package com.wormhole.tts

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import java.util.concurrent.ArrayBlockingQueue
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicLong
import kotlin.math.max

data class KokoroStreamSnapshot(
    val positionMs: Long,
    val bufferedDurationMs: Long,
    val isPlaying: Boolean,
)

/**
 * Produces Kokoro passages on the model executor and feeds their PCM samples
 * into one long-lived AudioTrack. This avoids WAV files and MediaPlayer
 * teardown/recreation between passages.
 */
class KokoroStreamingPlayer(
    private val generationExecutor: ExecutorService,
    private val synthesize: (String, Int, Float) -> KokoroGenerationResult,
    private val listener: Listener,
) {
    interface Listener {
        fun onBuffering(sessionId: Long, index: Int, total: Int)
        fun onChunkStarted(
            sessionId: Long,
            index: Int,
            total: Int,
            text: String,
        )
        fun onCompleted(sessionId: Long)
        fun onError(sessionId: Long, error: Throwable)
    }

    private sealed interface QueueItem {
        data class Audio(
            val index: Int,
            val total: Int,
            val text: String,
            val samples: FloatArray,
            val sampleRate: Int,
        ) : QueueItem

        data object End : QueueItem
        data object Cancelled : QueueItem
        data class Failure(val error: Throwable) : QueueItem
    }

    private val playbackExecutor = Executors.newSingleThreadExecutor()
    private val sessionCounter = AtomicLong(0L)
    private val generatedFrames = AtomicLong(0L)
    private val trackLock = Any()

    @Volatile
    private var activeSessionId = 0L

    @Volatile
    private var activeQueue: ArrayBlockingQueue<QueueItem>? = null

    @Volatile
    private var audioTrack: AudioTrack? = null

    @Volatile
    private var sampleRate = 24_000

    @Volatile
    private var pauseRequested = false

    fun start(
        chunks: List<String>,
        startIndex: Int,
        voiceId: Int,
        speed: Float,
    ): Long {
        require(chunks.isNotEmpty()) { "There is no text to read." }
        require(startIndex in chunks.indices) {
            "Invalid starting passage ${startIndex + 1} of ${chunks.size}."
        }

        stop()

        val sessionId = sessionCounter.incrementAndGet()
        val queue = ArrayBlockingQueue<QueueItem>(BUFFERED_PASSAGE_CAPACITY)
        activeSessionId = sessionId
        activeQueue = queue
        generatedFrames.set(0L)
        pauseRequested = false

        playbackExecutor.execute {
            consume(sessionId, queue)
        }
        generationExecutor.execute {
            produce(
                sessionId = sessionId,
                queue = queue,
                chunks = chunks,
                startIndex = startIndex,
                voiceId = voiceId,
                speed = speed,
            )
        }

        return sessionId
    }

    fun pause(): KokoroStreamSnapshot {
        pauseRequested = true
        synchronized(trackLock) {
            audioTrack?.let { track ->
                if (track.playState == AudioTrack.PLAYSTATE_PLAYING) {
                    track.pause()
                }
            }
        }
        return snapshot()
    }

    fun resume(): KokoroStreamSnapshot {
        pauseRequested = false
        synchronized(trackLock) {
            audioTrack?.let { track ->
                if (track.state == AudioTrack.STATE_INITIALIZED &&
                    track.playState != AudioTrack.PLAYSTATE_PLAYING
                ) {
                    track.play()
                }
            }
        }
        return snapshot()
    }

    fun stop(): KokoroStreamSnapshot {
        val snapshot = snapshot()
        activeSessionId = sessionCounter.incrementAndGet()
        activeQueue?.let { queue ->
            queue.clear()
            queue.offer(QueueItem.Cancelled)
        }
        activeQueue = null
        pauseRequested = false
        releaseTrack()
        generatedFrames.set(0L)
        return snapshot
    }

    fun snapshot(): KokoroStreamSnapshot {
        val track = audioTrack
        val rate = sampleRate.coerceAtLeast(1)
        val playedFrames = track?.playbackHeadPosition
            ?.toLong()
            ?.and(0xffffffffL)
            ?: 0L
        return KokoroStreamSnapshot(
            positionMs = playedFrames * 1000L / rate,
            bufferedDurationMs = generatedFrames.get() * 1000L / rate,
            isPlaying = track?.playState == AudioTrack.PLAYSTATE_PLAYING,
        )
    }

    fun isActive(): Boolean = activeQueue != null

    fun release() {
        stop()
        playbackExecutor.shutdownNow()
    }

    private fun produce(
        sessionId: Long,
        queue: ArrayBlockingQueue<QueueItem>,
        chunks: List<String>,
        startIndex: Int,
        voiceId: Int,
        speed: Float,
    ) {
        try {
            for (index in startIndex until chunks.size) {
                if (!isCurrent(sessionId)) {
                    return
                }

                val result = synthesize(chunks[index], voiceId, speed)
                if (!isCurrent(sessionId)) {
                    return
                }

                generatedFrames.addAndGet(result.audio.samples.size.toLong())
                if (!offerWhileCurrent(
                        sessionId,
                        queue,
                        QueueItem.Audio(
                            index = index,
                            total = chunks.size,
                            text = chunks[index],
                            samples = result.audio.samples,
                            sampleRate = result.audio.sampleRate,
                        ),
                    )
                ) {
                    return
                }
            }
            offerWhileCurrent(sessionId, queue, QueueItem.End)
        } catch (error: Throwable) {
            offerWhileCurrent(sessionId, queue, QueueItem.Failure(error))
        }
    }

    private fun consume(
        sessionId: Long,
        queue: ArrayBlockingQueue<QueueItem>,
    ) {
        var framesWritten = 0L
        var track: AudioTrack? = null
        val prefetchedAudio = ArrayDeque<QueueItem.Audio>()
        var prefetchedFrames = 0L
        var reachedEnd = false

        try {
            // Build an audio-duration reserve before starting playback. Counting PCM
            // frames instead of passages keeps the startup buffer consistent when
            // sentence length, punctuation, voice, or playback speed changes.
            listener.onBuffering(sessionId, -1, -1)
            while (isCurrent(sessionId) && !reachedEnd) {
                when (val item = queue.take()) {
                    is QueueItem.Audio -> {
                        if (prefetchedAudio.isNotEmpty()) {
                            check(item.sampleRate == prefetchedAudio.first().sampleRate) {
                                "Kokoro changed sample rate during startup buffering."
                            }
                        }
                        prefetchedAudio.addLast(item)
                        prefetchedFrames += item.samples.size
                        val bufferedMs = prefetchedFrames * 1000L /
                            item.sampleRate.coerceAtLeast(1)
                        if (bufferedMs >= STARTUP_BUFFER_DURATION_MS) {
                            break
                        }
                    }
                    QueueItem.End -> reachedEnd = true
                    QueueItem.Cancelled -> return
                    is QueueItem.Failure -> throw item.error
                }
            }

            while (isCurrent(sessionId)) {
                val nextItem = if (prefetchedAudio.isNotEmpty()) {
                    prefetchedAudio.removeFirst()
                } else if (reachedEnd) {
                    QueueItem.End
                } else {
                    takeNextItem(sessionId, queue, track, framesWritten)
                }

                when (val item = nextItem) {
                    is QueueItem.Audio -> {
                        if (!isCurrent(sessionId)) {
                            return
                        }
                        if (track == null) {
                            sampleRate = item.sampleRate
                            track = createAudioTrack(item.sampleRate)
                            synchronized(trackLock) {
                                if (!isCurrent(sessionId)) {
                                    track.release()
                                    return
                                }
                                audioTrack = track
                                if (!pauseRequested) {
                                    track.play()
                                }
                            }
                        } else {
                            check(item.sampleRate == sampleRate) {
                                "Kokoro changed sample rate from $sampleRate to ${item.sampleRate}."
                            }
                        }

                        listener.onChunkStarted(
                            sessionId,
                            item.index,
                            item.total,
                            item.text,
                        )
                        framesWritten += writeSamples(sessionId, track, item.samples)
                    }
                    QueueItem.End -> {
                        reachedEnd = true
                        waitUntilPlayed(sessionId, track, framesWritten)
                        if (isCurrent(sessionId)) {
                            listener.onCompleted(sessionId)
                        }
                        return
                    }
                    QueueItem.Cancelled -> return
                    is QueueItem.Failure -> throw item.error
                }
            }
        } catch (error: Throwable) {
            if (isCurrent(sessionId)) {
                listener.onError(sessionId, error)
            }
        } finally {
            if (activeSessionId == sessionId) {
                activeQueue = null
                releaseTrack()
            }
        }
    }

    /**
     * Waits for the producer without claiming that playback is buffering while
     * AudioTrack still has PCM left to play.
     */
    private fun takeNextItem(
        sessionId: Long,
        queue: ArrayBlockingQueue<QueueItem>,
        track: AudioTrack?,
        framesWritten: Long,
    ): QueueItem {
        var bufferingReported = false
        while (isCurrent(sessionId)) {
            queue.poll(QUEUE_POLL_INTERVAL_MS, TimeUnit.MILLISECONDS)?.let {
                return it
            }

            val playedFrames = track?.playbackHeadPosition
                ?.toLong()
                ?.and(0xffffffffL)
                ?: framesWritten
            if (!bufferingReported && playedFrames >= framesWritten) {
                bufferingReported = true
                listener.onBuffering(sessionId, -1, -1)
            }
        }
        return QueueItem.Cancelled
    }

    private fun writeSamples(
        sessionId: Long,
        track: AudioTrack,
        samples: FloatArray,
    ): Long {
        val pcm = ShortArray(samples.size) { index ->
            (samples[index].coerceIn(-1f, 1f) * Short.MAX_VALUE)
                .toInt()
                .toShort()
        }
        var offset = 0
        while (offset < pcm.size && isCurrent(sessionId)) {
            val written = track.write(
                pcm,
                offset,
                pcm.size - offset,
                AudioTrack.WRITE_BLOCKING,
            )
            check(written >= 0) { "AudioTrack write failed with code $written." }
            offset += written
        }
        return offset.toLong()
    }

    private fun waitUntilPlayed(
        sessionId: Long,
        track: AudioTrack?,
        framesWritten: Long,
    ) {
        if (track == null) {
            return
        }
        while (isCurrent(sessionId)) {
            val played = track.playbackHeadPosition.toLong().and(0xffffffffL)
            if (played >= framesWritten) {
                return
            }
            Thread.sleep(PLAYBACK_DRAIN_POLL_MS)
        }
    }

    private fun offerWhileCurrent(
        sessionId: Long,
        queue: ArrayBlockingQueue<QueueItem>,
        item: QueueItem,
    ): Boolean {
        while (isCurrent(sessionId)) {
            if (queue.offer(item, QUEUE_OFFER_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
                return true
            }
        }
        return false
    }

    private fun isCurrent(sessionId: Long): Boolean =
        activeSessionId == sessionId && activeQueue != null

    private fun createAudioTrack(rate: Int): AudioTrack {
        val minimumBytes = AudioTrack.getMinBufferSize(
            rate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT,
        )
        check(minimumBytes > 0) {
            "Android could not allocate a Kokoro playback buffer."
        }
        val bufferBytes = max(minimumBytes, rate / 4 * PCM_BYTES_PER_SAMPLE)
        return AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_MEDIA)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build(),
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(rate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build(),
            )
            .setBufferSizeInBytes(bufferBytes)
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()
            .also { track ->
                check(track.state == AudioTrack.STATE_INITIALIZED) {
                    "Android failed to initialize streaming audio playback."
                }
            }
    }

    private fun releaseTrack() {
        synchronized(trackLock) {
            audioTrack?.let { track ->
                runCatching { track.pause() }
                runCatching { track.flush() }
                runCatching { track.release() }
            }
            audioTrack = null
        }
    }

    private companion object {
        const val BUFFERED_PASSAGE_CAPACITY = 6
        const val STARTUP_BUFFER_DURATION_MS = 10_000L
        const val PCM_BYTES_PER_SAMPLE = 2
        const val QUEUE_OFFER_TIMEOUT_MS = 100L
        const val QUEUE_POLL_INTERVAL_MS = 25L
        const val PLAYBACK_DRAIN_POLL_MS = 25L
    }
}
