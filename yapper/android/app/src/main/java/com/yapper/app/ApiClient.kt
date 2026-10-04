package com.yapper.app

import android.os.Build
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.File
import java.io.IOException
import java.util.concurrent.TimeUnit

class ApiException(message: String) : IOException(message)

/** Blocking HTTP client for the Yapper backend. Call from a background thread. */
class ApiClient(baseUrl: String, private val token: String) {

    private val base = baseUrl.trim().trimEnd('/')

    private fun authed(path: String): Request.Builder =
        Request.Builder()
            .url(base + path)
            .header("Authorization", "Bearer $token")

    private fun execute(request: Request) {
        client.newCall(request).execute().use { resp ->
            if (!resp.isSuccessful) {
                val body = try { resp.body?.string()?.take(300) } catch (_: Exception) { null }
                throw ApiException("HTTP ${resp.code} for ${request.method} ${request.url.encodedPath}: ${body ?: ""}")
            }
        }
    }

    fun ping() {
        execute(authed("/api/ping").get().build())
    }

    fun createRecording(meta: RecordingMeta) {
        val o = JSONObject()
        o.put("id", meta.id)
        val title = meta.title
        o.put("title", if (title.isNullOrBlank()) JSONObject.NULL else title)
        o.put("started_at", TimeUtil.iso(meta.startedAtMillis))
        o.put("language", meta.language)
        o.put("source", "android")
        o.put("device", Build.MODEL ?: "android")
        val body = o.toString().toRequestBody(JSON)
        execute(authed("/api/recordings").post(body).build())
    }

    fun uploadChunk(id: String, seq: Int, file: File, startMs: Long, durationMs: Long) {
        val body = MultipartBody.Builder()
            .setType(MultipartBody.FORM)
            .addFormDataPart("file", "chunk_$seq.m4a", file.asRequestBody(AUDIO_MP4))
            .addFormDataPart("start_ms", startMs.toString())
            .addFormDataPart("duration_ms", durationMs.toString())
            .build()
        execute(authed("/api/recordings/$id/chunks/$seq").put(body).build())
    }

    fun finish(id: String, endedAtMillis: Long, chunkCount: Int, durationMs: Long) {
        val o = JSONObject()
        o.put("ended_at", TimeUtil.iso(endedAtMillis))
        o.put("chunk_count", chunkCount)
        o.put("duration_ms", durationMs)
        val body = o.toString().toRequestBody(JSON)
        execute(authed("/api/recordings/$id/finish").post(body).build())
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
        private val AUDIO_MP4 = "audio/mp4".toMediaType()

        val client: OkHttpClient by lazy {
            OkHttpClient.Builder()
                .connectTimeout(30, TimeUnit.SECONDS)
                .readTimeout(120, TimeUnit.SECONDS)
                .writeTimeout(120, TimeUnit.SECONDS)
                .retryOnConnectionFailure(true)
                .build()
        }
    }
}
