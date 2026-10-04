package com.yapper.app

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.os.Build
import android.service.quicksettings.Tile
import android.service.quicksettings.TileService
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class RecordTileService : TileService() {

    private var scope: CoroutineScope? = null
    private var job: Job? = null

    override fun onStartListening() {
        super.onStartListening()
        val s = CoroutineScope(SupervisorJob() + Dispatchers.Main)
        scope = s
        job = s.launch {
            RecorderState.state.collectLatest { st -> updateTile(st.isRecording) }
        }
    }

    override fun onStopListening() {
        job?.cancel()
        scope?.cancel()
        scope = null
        job = null
        super.onStopListening()
    }

    private fun updateTile(recording: Boolean) {
        val tile = qsTile ?: return
        tile.state = if (recording) Tile.STATE_ACTIVE else Tile.STATE_INACTIVE
        tile.label = if (recording) "Recording" else "Yapper"
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            tile.subtitle = if (recording) "Tap to stop" else "Tap to record"
        }
        tile.updateTile()
    }

    @SuppressLint("StartActivityAndCollapseDeprecated")
    override fun onClick() {
        super.onClick()
        if (RecorderState.state.value.isRecording) {
            RecorderService.stop(this)
            return
        }
        val intent = TrampolineActivity.intent(this, RecorderService.ACTION_START)
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                val pi = PendingIntent.getActivity(
                    this, 10, intent,
                    PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT
                )
                startActivityAndCollapse(pi)
            } else {
                @Suppress("DEPRECATION")
                startActivityAndCollapse(intent)
            }
        } catch (e: Exception) {
            Log.e("RecordTile", "Failed to launch trampoline", e)
        }
    }
}
