package com.yapper.app

import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.time.temporal.ChronoUnit
import java.util.Locale

object TimeUtil {
    /** ISO-8601 UTC, second precision, e.g. 2026-10-04T10:00:00Z */
    fun iso(millis: Long): String =
        Instant.ofEpochMilli(millis).truncatedTo(ChronoUnit.SECONDS).toString()

    fun parseIso(value: String?): Long? {
        if (value.isNullOrBlank()) return null
        return try {
            Instant.parse(value).toEpochMilli()
        } catch (e: Exception) {
            null
        }
    }

    private val displayFormatter: DateTimeFormatter =
        DateTimeFormatter.ofPattern("EEE d MMM yyyy, HH:mm", Locale.getDefault())

    fun display(millis: Long): String =
        displayFormatter.format(Instant.ofEpochMilli(millis).atZone(ZoneId.systemDefault()))

    /** mm:ss or h:mm:ss */
    fun formatElapsed(ms: Long): String {
        val totalSec = (if (ms < 0) 0 else ms) / 1000
        val h = totalSec / 3600
        val m = (totalSec % 3600) / 60
        val s = totalSec % 60
        return if (h > 0) {
            String.format(Locale.US, "%d:%02d:%02d", h, m, s)
        } else {
            String.format(Locale.US, "%02d:%02d", m, s)
        }
    }
}
