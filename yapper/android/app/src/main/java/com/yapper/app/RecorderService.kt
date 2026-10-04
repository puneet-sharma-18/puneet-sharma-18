package com.yapper.app

import android.Manifest
import android.app.Notification
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.util.Log
import androidx.core.content.ContextCompat
import java.util.UUID

/**
 * Foreground service (type microphone) that owns the [RecorderEngine].
 *
 * Actions:
 *  - ACTION_START: start a new recording (finalizing any stale interrupted one).
 *  - ACTION_RESUME: continue the interrupted recording if there is one, else start new.
 *  - ACTION_STOP: stop and finalize.
 *  - null intent (START_STICKY restart after process death): resume the active recording.
 */
class RecorderService : Service() {

    private val mainHandler = Handler(Looper.getMainLooper())
    private var engine: RecorderEngine? = null
    private var wakeLock: PowerManager.WakeLock? = null
    private var currentId: String? = null
    private var startedAt: Long = 0L
    private var silenced = false
    private var stopRequested = false
    private var fatalStopped = false
    private var pendingStartAction: String? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val action = intent?.action
        Log.i(TAG, "onStartCommand action=$action running=${engine != null}")

        if (action == ACTION_STOP) {
            pendingStartAction = null
            // If we were started with startForegroundService we must still call startForeground.
            if (engine == null) {
                tryStartForeground(buildNotification("Stopping…"))
                finishService()
            } else {
                requestStop()
            }
            return START_NOT_STICKY
        }

        // START / RESUME / sticky restart: go foreground immediately (Android 14 requirement).
        val active = engine
        if (active != null && active.isRunning) {
            tryStartForeground(buildNotification(statusText()))
            return START_STICKY
        }
        if (active != null) {
            // Previous engine is still flushing its last chunk; start again once it is done.
            tryStartForeground(buildNotification("Stopping and saving…"))
            pendingStartAction = action ?: ACTION_RESUME
            return START_STICKY
        }

        if (!hasMicPermission()) {
            tryStartForeground(buildNotification("Microphone permission missing"))
            Notifications.postStoppedAlert(this, "Microphone permission is missing. Open Yapper and grant it.")
            finishService()
            return START_NOT_STICKY
        }

        // Go foreground first, before any other work (Android 14 requirement).
        startedAt = 0L
        silenced = false
        stopRequested = false
        fatalStopped = false
        if (!tryStartForeground(buildNotification("Starting…"))) {
            // Not allowed to start a microphone FGS right now (e.g. from background on Android 14+).
            Notifications.postStoppedAlert(
                this,
                "Android did not allow recording to start in the background. Tap to resume."
            )
            stopSelf()
            return START_NOT_STICKY
        }

        // Decide which recording to run.
        val prefs = Prefs(this)
        val existing = RecordingStore.findActive(this)
        val meta: RecordingMeta
        val firstChunkStartMs: Long
        if (action == null || action == ACTION_RESUME) {
            if (existing != null) {
                meta = existing
                RecordingStore.deletePartFiles(this, meta.id)
                firstChunkStartMs = maxOf(
                    System.currentTimeMillis() - meta.startedAtMillis,
                    meta.timelineEndMs
                )
            } else if (action == null) {
                // Sticky restart but nothing to resume.
                finishService()
                return START_NOT_STICKY
            } else {
                meta = createNew(prefs)
                firstChunkStartMs = 0L
            }
        } else {
            // ACTION_START: finalize any interrupted recording, then start fresh.
            if (existing != null) {
                RecordingStore.deletePartFiles(this, existing.id)
                RecordingStore.finalizeStale(this, existing.id)
                UploadScheduler.enqueue(this, force = true)
            }
            meta = createNew(prefs)
            firstChunkStartMs = 0L
        }

        currentId = meta.id
        startedAt = meta.startedAtMillis
        // Refresh the notification so the chronometer counts from the recording start.
        tryStartForeground(buildNotification(statusText()))

        Notifications.cancelAlert(this)
        acquireWakeLock()

        val e = RecorderEngine(
            context = this,
            recordingId = meta.id,
            startedAtMillis = meta.startedAtMillis,
            firstSeq = meta.nextSeq,
            firstChunkStartMs = firstChunkStartMs,
            listener = engineListener,
        )
        engine = e
        RecorderState.set(
            RecorderUiState(
                isRecording = true,
                recordingId = meta.id,
                startedAtMillis = meta.startedAtMillis,
            )
        )
        e.start()
        return START_STICKY
    }

    private fun createNew(prefs: Prefs): RecordingMeta {
        val title = prefs.nextTitle.trim().ifEmpty { null }
        val lang = prefs.nextLanguage.ifEmpty { "auto" }
        val meta = RecordingStore.create(
            this,
            id = UUID.randomUUID().toString(),
            title = title,
            startedAtMillis = System.currentTimeMillis(),
            language = lang,
        )
        prefs.nextTitle = ""
        return meta
    }

    private val engineListener = object : RecorderEngine.Listener {
        override fun onChunkCompleted(seq: Int) {
            UploadScheduler.enqueue(applicationContext)
        }

        override fun onSilencedChanged(silenced: Boolean) {
            this@RecorderService.silenced = silenced
            RecorderState.update { it.copy(silenced = silenced) }
            updateNotification()
        }

        override fun onFatalError(message: String) {
            fatalStopped = true
            Notifications.postStoppedAlert(
                applicationContext,
                "$message. Tap to resume the same recording."
            )
        }

        override fun onStopped(timelineEndMs: Long) {
            mainHandler.post { onEngineStopped(timelineEndMs) }
        }
    }

    private fun onEngineStopped(timelineEndMs: Long) {
        val id = currentId
        if (id != null && !fatalStopped) {
            val now = System.currentTimeMillis()
            RecordingStore.update(this, id) { m ->
                m.state = RecordingMeta.STATE_FINISHED
                m.endedAtMillis = now
                m.durationMs = maxOf(timelineEndMs, m.timelineEndMs)
            }
        }
        // Always try to push what we have (on fatal: chunks so far; the recording stays open for resume).
        UploadScheduler.enqueue(applicationContext, force = true)
        engine = null
        currentId = null
        RecorderState.set(RecorderUiState())
        val pending = pendingStartAction
        pendingStartAction = null
        if (pending != null) {
            onStartCommand(Intent(this, RecorderService::class.java).setAction(pending), 0, 0)
        } else {
            finishService()
        }
    }

    private fun requestStop() {
        if (stopRequested) return
        stopRequested = true
        updateNotification("Stopping and saving…")
        val e = engine
        if (e == null) {
            finishService()
        } else {
            e.stop()
        }
    }

    private fun finishService() {
        releaseWakeLock()
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } catch (_: Exception) {}
        stopSelf()
    }

    override fun onDestroy() {
        val e = engine
        if (e != null && e.isRunning) {
            // We are being destroyed while still recording (should not normally happen).
            // Flush the current chunk; the recording stays in "recording" state so it can be resumed.
            Log.w(TAG, "onDestroy while recording; flushing")
            fatalStopped = true
            e.stop()
            Notifications.postStoppedAlert(this, "Recording was interrupted by the system.")
        }
        engine = null
        RecorderState.set(RecorderUiState())
        releaseWakeLock()
        super.onDestroy()
    }

    // ---------------------------------------------------------------- helpers

    private fun hasMicPermission(): Boolean =
        ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED

    private fun tryStartForeground(notification: Notification): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                startForeground(
                    Notifications.ID_RECORDING,
                    notification,
                    ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE
                )
            } else {
                startForeground(Notifications.ID_RECORDING, notification)
            }
            true
        } catch (e: Exception) {
            // ForegroundServiceStartNotAllowedException (API 31+) / SecurityException (API 34+)
            Log.e(TAG, "startForeground failed", e)
            false
        }
    }

    private fun statusText(): String = when {
        stopRequested -> "Stopping and saving…"
        silenced -> "Paused by another app – will continue automatically"
        else -> "Recording… tap to open"
    }

    private fun buildNotification(text: String): Notification {
        val base = if (startedAt > 0) startedAt else System.currentTimeMillis()
        return Notifications.buildRecording(this, base, text)
    }

    private fun updateNotification(text: String = statusText()) {
        if (engine == null && !stopRequested) return
        Notifications.notify(this, Notifications.ID_RECORDING, buildNotification(text))
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        val wl = pm.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Yapper:recording")
        wl.setReferenceCounted(false)
        wl.acquire()
        wakeLock = wl
    }

    private fun releaseWakeLock() {
        try {
            val wl = wakeLock
            if (wl != null && wl.isHeld) wl.release()
        } catch (_: Exception) {}
        wakeLock = null
    }

    companion object {
        private const val TAG = "RecorderService"
        const val ACTION_START = "com.yapper.app.action.START"
        const val ACTION_RESUME = "com.yapper.app.action.RESUME"
        const val ACTION_STOP = "com.yapper.app.action.STOP"

        /** Start (or resume) recording. Only call while the app is in the foreground. */
        fun start(context: Context, action: String = ACTION_START) {
            val intent = Intent(context, RecorderService::class.java).setAction(action)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, RecorderService::class.java).setAction(ACTION_STOP)
            try {
                context.startService(intent)
            } catch (e: Exception) {
                // Fallback (e.g. background restrictions): startForegroundService; service will call
                // startForeground before stopping.
                try {
                    ContextCompat.startForegroundService(context, intent)
                } catch (e2: Exception) {
                    Log.e(TAG, "Could not deliver stop", e2)
                }
            }
        }
    }
}
