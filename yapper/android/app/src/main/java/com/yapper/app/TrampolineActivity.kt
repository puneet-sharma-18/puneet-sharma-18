package com.yapper.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import androidx.core.content.ContextCompat

/**
 * Invisible activity used to start the microphone foreground service from the overlay bubble,
 * the Quick Settings tile and the "tap to resume" notification. While this activity is on screen
 * the app counts as foreground, which Android 14+ requires for starting a microphone FGS.
 */
class TrampolineActivity : Activity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val action = intent?.action ?: RecorderService.ACTION_START
        val hasMic = ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) ==
            PackageManager.PERMISSION_GRANTED
        if (!hasMic) {
            // Need the user to grant the permission in the main UI.
            startActivity(
                Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            )
        } else {
            try {
                when (action) {
                    RecorderService.ACTION_STOP -> RecorderService.stop(this)
                    RecorderService.ACTION_RESUME -> RecorderService.start(this, RecorderService.ACTION_RESUME)
                    else -> RecorderService.start(this, RecorderService.ACTION_START)
                }
            } catch (e: Exception) {
                Log.e("Trampoline", "Failed to start recorder", e)
                Notifications.postStoppedAlert(this, "Could not start recording: ${e.message}")
            }
        }
        finish()
    }

    companion object {
        fun intent(context: android.content.Context, action: String): Intent =
            Intent(context, TrampolineActivity::class.java)
                .setAction(action)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_ANIMATION)
    }
}
