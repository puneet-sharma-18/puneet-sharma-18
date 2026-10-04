package com.yapper.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.Settings
import android.util.Log

/** Restarts the floating button after reboot / app update if the user enabled it. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action
        if (action != Intent.ACTION_BOOT_COMPLETED && action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        UploadScheduler.enqueue(context)
        val prefs = Prefs(context)
        if (prefs.showOverlay && Settings.canDrawOverlays(context)) {
            try {
                OverlayService.start(context)
            } catch (e: Exception) {
                Log.w("BootReceiver", "Could not start overlay", e)
            }
        }
    }
}
