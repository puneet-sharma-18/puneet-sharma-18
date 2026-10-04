package com.yapper.app

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update

data class RecorderUiState(
    val isRecording: Boolean = false,
    val recordingId: String? = null,
    /** Wall-clock start of the recording (System.currentTimeMillis based). */
    val startedAtMillis: Long = 0L,
    /** Current RMS level, 0..1. */
    val level: Float = 0f,
    /** True when the OS is feeding us silence because another app took the mic. */
    val silenced: Boolean = false,
    /** True while the AudioRecord is being re-created after an error. */
    val recovering: Boolean = false,
)

/** Process-wide recorder state shared between the service, the UI, the overlay and the tile. */
object RecorderState {
    private val _state = MutableStateFlow(RecorderUiState())
    val state: StateFlow<RecorderUiState> = _state.asStateFlow()

    fun update(transform: (RecorderUiState) -> RecorderUiState) {
        _state.update(transform)
    }

    fun set(value: RecorderUiState) {
        _state.value = value
    }
}
