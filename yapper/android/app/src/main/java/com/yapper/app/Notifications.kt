package com.yapper.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat

object Notifications {
    const val CHANNEL_RECORDING = "recording"
    const val CHANNEL_ALERTS = "alerts"
    const val CHANNEL_OVERLAY = "overlay"

    const val ID_RECORDING = 1001
    const val ID_OVERLAY = 1002
    const val ID_ALERT = 1003

    private const val TAG = "Notifications"

    fun createChannels(context: Context) {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val recording = NotificationChannel(
            CHANNEL_RECORDING, "Recording", NotificationManager.IMPORTANCE_LOW
        ).apply {
            description = "Shown while Yapper is recording"
            setShowBadge(false)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        val alerts = NotificationChannel(
            CHANNEL_ALERTS, "Recording alerts", NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Shown if recording stops unexpectedly"
            enableVibration(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        val overlay = NotificationChannel(
            CHANNEL_OVERLAY, "Floating button", NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "Keeps the floating record button alive"
            setShowBadge(false)
        }
        nm.createNotificationChannels(listOf(recording, alerts, overlay))
    }

    fun openAppIntent(context: Context): PendingIntent {
        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
        }
        return PendingIntent.getActivity(
            context, 0, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    fun resumeIntent(context: Context): PendingIntent {
        val intent = Intent(context, TrampolineActivity::class.java).apply {
            action = RecorderService.ACTION_RESUME
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
        }
        return PendingIntent.getActivity(
            context, 2, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    fun stopIntent(context: Context): PendingIntent {
        val intent = Intent(context, RecorderService::class.java).apply {
            action = RecorderService.ACTION_STOP
        }
        return PendingIntent.getService(
            context, 1, intent,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
        )
    }

    fun buildRecording(context: Context, startedAtMillis: Long, text: String): Notification {
        return NotificationCompat.Builder(context, CHANNEL_RECORDING)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentTitle("Yapper is recording")
            .setContentText(text)
            .setStyle(NotificationCompat.BigTextStyle().bigText(text))
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setShowWhen(true)
            .setWhen(startedAtMillis)
            .setUsesChronometer(true)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openAppIntent(context))
            .addAction(R.drawable.ic_stop, "Stop", stopIntent(context))
            .build()
    }

    fun buildOverlay(context: Context): Notification {
        return NotificationCompat.Builder(context, CHANNEL_OVERLAY)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentTitle("Floating record button active")
            .setContentText("Tap to open Yapper")
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .setContentIntent(openAppIntent(context))
            .build()
    }

    /** High-priority "Recording stopped – tap to resume" alert. */
    fun postStoppedAlert(context: Context, reason: String) {
        val n = NotificationCompat.Builder(context, CHANNEL_ALERTS)
            .setSmallIcon(R.drawable.ic_mic)
            .setContentTitle("Recording stopped – tap to resume")
            .setContentText(reason)
            .setStyle(NotificationCompat.BigTextStyle().bigText(reason))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(NotificationCompat.CATEGORY_ERROR)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setContentIntent(resumeIntent(context))
            .build()
        notify(context, ID_ALERT, n)
    }

    fun cancelAlert(context: Context) {
        NotificationManagerCompat.from(context).cancel(ID_ALERT)
    }

    fun notify(context: Context, id: Int, notification: Notification) {
        try {
            val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.notify(id, notification)
        } catch (e: SecurityException) {
            Log.w(TAG, "Cannot post notification (permission missing?)", e)
        } catch (e: Exception) {
            Log.w(TAG, "Cannot post notification", e)
        }
    }
}
