package com.wormhole.tts

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.MediaMetadata
import android.media.session.MediaSession
import android.media.session.PlaybackState
import android.os.Build
import android.os.IBinder
import com.wormhole.MainActivity

class KokoroPlaybackService : Service() {
    private lateinit var mediaSession: MediaSession
    private var title = DEFAULT_TITLE
    private var subtitle = "Offline narration"
    private var durationMs = 0L
    private var positionMs = 0L
    private var playbackState = PlaybackState.STATE_BUFFERING

    override fun onCreate() {
        super.onCreate()
        running = true
        createNotificationChannel()
        mediaSession = MediaSession(this, "WormholeKokoro").apply {
            setCallback(
                object : MediaSession.Callback() {
                    override fun onPlay() = dispatchControl(CONTROL_PLAY)
                    override fun onPause() = dispatchControl(CONTROL_PAUSE)
                    override fun onStop() = dispatchControl(CONTROL_STOP)
                    override fun onSkipToPrevious() = dispatchControl(CONTROL_PREVIOUS)
                    override fun onSkipToNext() = dispatchControl(CONTROL_NEXT)
                },
            )
            isActive = true
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_PLAY -> dispatchControl(CONTROL_PLAY)
            ACTION_PAUSE -> dispatchControl(CONTROL_PAUSE)
            ACTION_STOP -> dispatchControl(CONTROL_STOP)
            ACTION_PREVIOUS -> dispatchControl(CONTROL_PREVIOUS)
            ACTION_NEXT -> dispatchControl(CONTROL_NEXT)
            ACTION_SHOW, ACTION_UPDATE -> {
                title = intent.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotBlank() }
                    ?: title
                subtitle = intent.getStringExtra(EXTRA_SUBTITLE)
                    ?.takeIf { it.isNotBlank() }
                    ?: subtitle
                durationMs = intent.getLongExtra(EXTRA_DURATION, durationMs)
                    .coerceAtLeast(0L)
                positionMs = intent.getLongExtra(EXTRA_POSITION, positionMs)
                    .coerceAtLeast(0L)
                playbackState = intent.getIntExtra(EXTRA_STATE, playbackState)
                publishState()
            }
        }
        return START_NOT_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        running = false
        mediaSession.isActive = false
        mediaSession.release()
        super.onDestroy()
    }

    private fun dispatchControl(control: String) {
        if (!KokoroTtsModule.handleMediaControl(control)) {
            stopPlayback(this)
        }
    }

    private fun publishState() {
        val actions = PlaybackState.ACTION_PLAY or
            PlaybackState.ACTION_PAUSE or
            PlaybackState.ACTION_PLAY_PAUSE or
            PlaybackState.ACTION_STOP or
            PlaybackState.ACTION_SKIP_TO_PREVIOUS or
            PlaybackState.ACTION_SKIP_TO_NEXT
        mediaSession.setPlaybackState(
            PlaybackState.Builder()
                .setActions(actions)
                .setState(
                    playbackState,
                    positionMs,
                    if (playbackState == PlaybackState.STATE_PLAYING) 1f else 0f,
                )
                .build(),
        )
        mediaSession.setMetadata(
            MediaMetadata.Builder()
                .putString(MediaMetadata.METADATA_KEY_TITLE, title)
                .putString(MediaMetadata.METADATA_KEY_ARTIST, "Wormhole")
                .putString(MediaMetadata.METADATA_KEY_DISPLAY_SUBTITLE, subtitle)
                .putLong(MediaMetadata.METADATA_KEY_DURATION, durationMs)
                .build(),
        )

        val notification = buildNotification()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                NOTIFICATION_ID,
                notification,
                android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
            )
        } else {
            startForeground(NOTIFICATION_ID, notification)
        }
    }

    private fun buildNotification(): Notification {
        val isPlaying = playbackState == PlaybackState.STATE_PLAYING
        val toggleAction = if (isPlaying) ACTION_PAUSE else ACTION_PLAY
        val toggleIcon = if (isPlaying) {
            android.R.drawable.ic_media_pause
        } else {
            android.R.drawable.ic_media_play
        }
        val toggleLabel = if (isPlaying) "Pause" else "Play"

        val openApp = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java).apply {
                flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            },
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val toggle = PendingIntent.getService(
            this,
            1,
            Intent(this, KokoroPlaybackService::class.java).setAction(toggleAction),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val stop = PendingIntent.getService(
            this,
            2,
            Intent(this, KokoroPlaybackService::class.java).setAction(ACTION_STOP),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val previous = PendingIntent.getService(
            this,
            3,
            Intent(this, KokoroPlaybackService::class.java).setAction(ACTION_PREVIOUS),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )
        val next = PendingIntent.getService(
            this,
            4,
            Intent(this, KokoroPlaybackService::class.java).setAction(ACTION_NEXT),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            Notification.Builder(this)
        }
        return builder
            .setSmallIcon(android.R.drawable.ic_media_play)
            .setContentTitle(title)
            .setContentText(subtitle)
            .setContentIntent(openApp)
            .setOnlyAlertOnce(true)
            .setOngoing(playbackState != PlaybackState.STATE_STOPPED)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setCategory(Notification.CATEGORY_TRANSPORT)
            .addAction(android.R.drawable.ic_media_previous, "Previous passage", previous)
            .addAction(toggleIcon, toggleLabel, toggle)
            .addAction(android.R.drawable.ic_media_next, "Next passage", next)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Stop", stop)
            .setStyle(
                Notification.MediaStyle()
                    .setMediaSession(mediaSession.sessionToken)
                    .setShowActionsInCompactView(0, 1, 2),
            )
            .build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return
        }
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        manager.createNotificationChannel(
            NotificationChannel(
                CHANNEL_ID,
                "Narration playback",
                NotificationManager.IMPORTANCE_LOW,
            ).apply {
                description = "Controls for Wormhole offline narration"
                setShowBadge(false)
            },
        )
    }

    companion object {
        const val CONTROL_PLAY = "play"
        const val CONTROL_PAUSE = "pause"
        const val CONTROL_STOP = "stop"
        const val CONTROL_PREVIOUS = "previous"
        const val CONTROL_NEXT = "next"

        private const val DEFAULT_TITLE = "Wormhole narration"
        private const val CHANNEL_ID = "kokoro_playback"
        private const val NOTIFICATION_ID = 82020
        private const val ACTION_SHOW = "com.wormhole.tts.SHOW_PLAYBACK"
        private const val ACTION_UPDATE = "com.wormhole.tts.UPDATE_PLAYBACK"
        private const val ACTION_PLAY = "com.wormhole.tts.PLAY"
        private const val ACTION_PAUSE = "com.wormhole.tts.PAUSE"
        private const val ACTION_STOP = "com.wormhole.tts.STOP"
        private const val ACTION_PREVIOUS = "com.wormhole.tts.PREVIOUS"
        private const val ACTION_NEXT = "com.wormhole.tts.NEXT"
        private const val EXTRA_TITLE = "title"
        private const val EXTRA_SUBTITLE = "subtitle"
        private const val EXTRA_DURATION = "duration"
        private const val EXTRA_POSITION = "position"
        private const val EXTRA_STATE = "state"

        @Volatile
        private var running = false

        fun showPlayback(
            context: Context,
            title: String,
            subtitle: String,
            durationMs: Long,
            positionMs: Long,
            state: Int,
        ) {
            val intent = Intent(context, KokoroPlaybackService::class.java)
                .setAction(if (running) ACTION_UPDATE else ACTION_SHOW)
                .putExtra(EXTRA_TITLE, title)
                .putExtra(EXTRA_SUBTITLE, subtitle)
                .putExtra(EXTRA_DURATION, durationMs)
                .putExtra(EXTRA_POSITION, positionMs)
                .putExtra(EXTRA_STATE, state)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && !running) {
                context.startForegroundService(intent)
            } else {
                context.startService(intent)
            }
        }

        fun stopPlayback(context: Context) {
            context.stopService(Intent(context, KokoroPlaybackService::class.java))
        }
    }
}
