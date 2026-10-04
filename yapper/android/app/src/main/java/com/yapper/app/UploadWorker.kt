package com.yapper.app

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

class UploadWorker(appContext: Context, params: WorkerParameters) :
    CoroutineWorker(appContext, params) {

    override suspend fun doWork(): Result = withContext(Dispatchers.IO) {
        mutex.withLock { runUploads() }
    }

    private fun runUploads(): Result {
        val ctx = applicationContext
        val prefs = Prefs(ctx)
        val base = prefs.normalizedBaseUrl()
        if (base.isEmpty()) {
            Log.i(TAG, "Server not configured; nothing to do")
            return Result.success()
        }
        val api = ApiClient(base, prefs.token)
        var anyFailed = false
        // Re-scan until a pass makes no progress, so chunks completed while we were
        // uploading are picked up by this same run.
        var pass = 0
        while (pass < 50 && !isStopped) {
            pass++
            var progressed = false
            for (meta in RecordingStore.list(ctx)) {
                if (isStopped) break
                if (meta.finishedRemote) continue
                try {
                    if (uploadRecording(ctx, api, prefs, meta.id)) progressed = true
                } catch (e: Exception) {
                    Log.w(TAG, "Upload failed for ${meta.id}: ${e.message}")
                    anyFailed = true
                }
            }
            if (anyFailed || !progressed) break
        }
        return if (anyFailed) Result.retry() else Result.success()
    }

    /** Returns true if anything was sent. Throws on failure. */
    private fun uploadRecording(ctx: Context, api: ApiClient, prefs: Prefs, id: String): Boolean {
        var progressed = false
        var meta = RecordingStore.load(ctx, id) ?: return false
        if (meta.finishedRemote) return false

        if (!meta.createdRemote) {
            api.createRecording(meta)
            RecordingStore.update(ctx, id) { it.createdRemote = true }
            progressed = true
        }

        val pending = meta.chunks.filter { !it.uploaded }.sortedBy { it.seq }
        for (chunk in pending) {
            if (isStopped) return progressed
            val file = RecordingStore.chunkFile(ctx, id, chunk.seq)
            if (!file.exists()) {
                // Cannot ever upload it; don't block the recording from finishing.
                Log.w(TAG, "Chunk file missing for $id/${chunk.seq}; skipping")
                RecordingStore.update(ctx, id) { m ->
                    m.chunks.firstOrNull { it.seq == chunk.seq }?.uploaded = true
                }
                continue
            }
            api.uploadChunk(id, chunk.seq, file, chunk.startMs, chunk.durationMs)
            RecordingStore.update(ctx, id) { m ->
                m.chunks.firstOrNull { it.seq == chunk.seq }?.uploaded = true
            }
            progressed = true
        }

        meta = RecordingStore.load(ctx, id) ?: return progressed
        if (meta.isFinished && !meta.finishedRemote && meta.chunks.all { it.uploaded }) {
            val ended = meta.endedAtMillis ?: (meta.startedAtMillis + meta.durationMs)
            api.finish(id, ended, meta.chunks.size, meta.durationMs)
            RecordingStore.update(ctx, id) { it.finishedRemote = true }
            progressed = true
            if (prefs.deleteAfterUpload) {
                RecordingStore.deleteAudio(ctx, id)
            }
        }
        return progressed
    }

    companion object {
        private const val TAG = "UploadWorker"
        private val mutex = Mutex()
    }
}
