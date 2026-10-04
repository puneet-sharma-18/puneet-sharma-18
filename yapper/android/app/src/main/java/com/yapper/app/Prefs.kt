package com.yapper.app

import android.content.Context
import android.content.SharedPreferences

/** Simple SharedPreferences wrapper for user settings. */
class Prefs(context: Context) {
    private val sp: SharedPreferences =
        context.applicationContext.getSharedPreferences("yapper_prefs", Context.MODE_PRIVATE)

    var baseUrl: String
        get() = sp.getString(KEY_BASE_URL, "") ?: ""
        set(value) = sp.edit().putString(KEY_BASE_URL, value.trim()).apply()

    var token: String
        get() = sp.getString(KEY_TOKEN, "") ?: ""
        set(value) = sp.edit().putString(KEY_TOKEN, value.trim()).apply()

    var deleteAfterUpload: Boolean
        get() = sp.getBoolean(KEY_DELETE_AFTER_UPLOAD, false)
        set(value) = sp.edit().putBoolean(KEY_DELETE_AFTER_UPLOAD, value).apply()

    var showOverlay: Boolean
        get() = sp.getBoolean(KEY_SHOW_OVERLAY, false)
        set(value) = sp.edit().putBoolean(KEY_SHOW_OVERLAY, value).apply()

    var nextTitle: String
        get() = sp.getString(KEY_NEXT_TITLE, "") ?: ""
        set(value) = sp.edit().putString(KEY_NEXT_TITLE, value).apply()

    var nextLanguage: String
        get() = sp.getString(KEY_NEXT_LANGUAGE, "auto") ?: "auto"
        set(value) = sp.edit().putString(KEY_NEXT_LANGUAGE, value).apply()

    var overlayX: Int
        get() = sp.getInt(KEY_OVERLAY_X, -1)
        set(value) = sp.edit().putInt(KEY_OVERLAY_X, value).apply()

    var overlayY: Int
        get() = sp.getInt(KEY_OVERLAY_Y, -1)
        set(value) = sp.edit().putInt(KEY_OVERLAY_Y, value).apply()

    /** Base URL without trailing slash, or "" if not configured. */
    fun normalizedBaseUrl(): String = baseUrl.trim().trimEnd('/')

    companion object {
        private const val KEY_BASE_URL = "base_url"
        private const val KEY_TOKEN = "token"
        private const val KEY_DELETE_AFTER_UPLOAD = "delete_after_upload"
        private const val KEY_SHOW_OVERLAY = "show_overlay"
        private const val KEY_NEXT_TITLE = "next_title"
        private const val KEY_NEXT_LANGUAGE = "next_language"
        private const val KEY_OVERLAY_X = "overlay_x"
        private const val KEY_OVERLAY_Y = "overlay_y"
    }
}
