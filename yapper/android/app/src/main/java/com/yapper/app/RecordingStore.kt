package com.yapper.app

import android.content.Context
import android.util.Log
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

class ChunkMeta(
    val seq: Int,
    val startMs: Long,
    val durationMs: Long,
    var uploaded: Boolean,
)

class RecordingMeta(
    val id: String,
    var title: String?,
    val startedAtMillis: Long,
    var language: String,
    var state: String,
    var nextSeq: Int,
    val chunks: MutableList<ChunkMeta>,
    var createdRemote: Boolean,
    var finishedRemote: Boolean,
    var endedAtMillis: Long?,
    var durationMs: Long,
    var localDeleted: Boolean,
) {
    val isFinished: Boolean get() = state == STATE_FINISHED
    val uploadedCount: Int get() = chunks.count { it.uploaded }

    /** End of the recorded timeline in ms (start of last chunk + its duration). */
    val timelineEndMs: Long
        get() = chunks.maxOfOrNull { it.startMs + it.durationMs } ?: 0L

    fun toJson(): JSONObject {
        val o = JSONObject()
        o.put("id", id)
        o.put("title", title ?: JSONObject.NULL)
        o.put("started_at", TimeUtil.iso(startedAtMillis))
        o.put("started_at_ms", startedAtMillis)
        o.put("language", language)
        o.put("state", state)
        o.put("next_seq", nextSeq)
        val arr = JSONArray()
        for (c in chunks) {
            val co = JSONObject()
            co.put("seq", c.seq)
            co.put("start_ms", c.startMs)
            co.put("duration_ms", c.durationMs)
            co.put("uploaded", c.uploaded)
            arr.put(co)
        }
        o.put("chunks", arr)
        o.put("created_remote", createdRemote)
        o.put("finished_remote", finishedRemote)
        val ended = endedAtMillis
        o.put("ended_at", if (ended != null) TimeUtil.iso(ended) else JSONObject.NULL)
        o.put("ended_at_ms", ended ?: JSONObject.NULL)
        o.put("duration_ms", durationMs)
        o.put("local_deleted", localDeleted)
        return o
    }

    companion object {
        const val STATE_RECORDING = "recording"
        const val STATE_FINISHED = "finished"

        fun fromJson(o: JSONObject): RecordingMeta {
            val chunks = mutableListOf<ChunkMeta>()
            val arr = o.optJSONArray("chunks")
            if (arr != null) {
                for (i in 0 until arr.length()) {
                    val co = arr.getJSONObject(i)
                    chunks.add(
                        ChunkMeta(
                            seq = co.getInt("seq"),
                            startMs = co.optLong("start_ms", 0L),
                            durationMs = co.optLong("duration_ms", 0L),
                            uploaded = co.optBoolean("uploaded", false),
                        )
                    )
                }
            }
            chunks.sortBy { it.seq }
            val startedMs = if (o.has("started_at_ms") && !o.isNull("started_at_ms")) {
                o.getLong("started_at_ms")
            } else {
                TimeUtil.parseIso(o.optString("started_at", "")) ?: 0L
            }
            val endedMs: Long? = if (o.has("ended_at_ms") && !o.isNull("ended_at_ms")) {
                o.getLong("ended_at_ms")
            } else if (o.has("ended_at") && !o.isNull("ended_at")) {
                TimeUtil.parseIso(o.optString("ended_at", ""))
            } else {
                null
            }
            val title: String? = if (o.has("title") && !o.isNull("title")) o.getString("title") else null
            return RecordingMeta(
                id = o.getString("id"),
                title = title,
                startedAtMillis = startedMs,
                language = o.optString("language", "auto"),
                state = o.optString("state", STATE_RECORDING),
                nextSeq = o.optInt("next_seq", 0),
                chunks = chunks,
                createdRemote = o.optBoolean("created_remote", false),
                finishedRemote = o.optBoolean("finished_remote", false),
                endedAtMillis = endedMs,
                durationMs = o.optLong("duration_ms", 0L),
                localDeleted = o.optBoolean("local_deleted", false),
            )
        }
    }
}

/**
 * Persists recordings as filesDir/recordings/{uuid}/meta.json + chunk files.
 * All meta.json reads/writes go through [lock]; writes are atomic (tmp + rename).
 */
object RecordingStore {
    private const val TAG = "RecordingStore"
    private val lock = Any()

    fun rootDir(context: Context): File {
        val dir = File(context.applicationContext.filesDir, "recordings")
        if (!dir.exists()) dir.mkdirs()
        return dir
    }

    fun recordingDir(context: Context, id: String): File = File(rootDir(context), id)

    fun chunkFile(context: Context, id: String, seq: Int): File =
        File(recordingDir(context, id), "chunk_$seq.m4a")

    fun partFile(context: Context, id: String, seq: Int): File =
        File(recordingDir(context, id), "chunk_$seq.m4a.part")

    private fun metaFile(dir: File): File = File(dir, "meta.json")

    fun create(
        context: Context,
        id: String,
        title: String?,
        startedAtMillis: Long,
        language: String,
    ): RecordingMeta {
        synchronized(lock) {
            val dir = recordingDir(context, id)
            dir.mkdirs()
            val meta = RecordingMeta(
                id = id,
                title = title,
                startedAtMillis = startedAtMillis,
                language = language,
                state = RecordingMeta.STATE_RECORDING,
                nextSeq = 0,
                chunks = mutableListOf(),
                createdRemote = false,
                finishedRemote = false,
                endedAtMillis = null,
                durationMs = 0L,
                localDeleted = false,
            )
            writeLocked(dir, meta)
            return meta
        }
    }

    fun load(context: Context, id: String): RecordingMeta? {
        synchronized(lock) {
            return readLocked(recordingDir(context, id))
        }
    }

    /** Load-modify-save under the lock. Returns the updated meta, or null if missing. */
    fun update(context: Context, id: String, block: (RecordingMeta) -> Unit): RecordingMeta? {
        synchronized(lock) {
            val dir = recordingDir(context, id)
            val meta = readLocked(dir) ?: return null
            block(meta)
            writeLocked(dir, meta)
            return meta
        }
    }

    /** All recordings, newest first. */
    fun list(context: Context): List<RecordingMeta> {
        synchronized(lock) {
            val dirs = rootDir(context).listFiles() ?: return emptyList()
            val out = mutableListOf<RecordingMeta>()
            for (d in dirs) {
                if (!d.isDirectory) continue
                val m = readLocked(d) ?: continue
                out.add(m)
            }
            out.sortByDescending { it.startedAtMillis }
            return out
        }
    }

    /** Most recent recording whose state is still "recording", if any. */
    fun findActive(context: Context): RecordingMeta? =
        list(context).firstOrNull { it.state == RecordingMeta.STATE_RECORDING }

    /** Mark a recording that was interrupted (and not resumed) as finished. */
    fun finalizeStale(context: Context, id: String): RecordingMeta? =
        update(context, id) { m ->
            if (m.state != RecordingMeta.STATE_FINISHED) {
                m.state = RecordingMeta.STATE_FINISHED
                val end = m.timelineEndMs
                m.durationMs = end
                m.endedAtMillis = m.startedAtMillis + end
            }
        }

    /** Delete leftover *.part files (incomplete chunks from a crash). */
    fun deletePartFiles(context: Context, id: String) {
        val files = recordingDir(context, id).listFiles() ?: return
        for (f in files) {
            if (f.name.endsWith(".part")) {
                Log.w(TAG, "Deleting incomplete chunk ${f.name}")
                f.delete()
            }
        }
    }

    /** Delete local audio (keeps meta.json). */
    fun deleteAudio(context: Context, id: String) {
        val files = recordingDir(context, id).listFiles() ?: return
        for (f in files) {
            if (f.name.startsWith("chunk_")) f.delete()
        }
        update(context, id) { it.localDeleted = true }
    }

    private fun readLocked(dir: File): RecordingMeta? {
        val f = metaFile(dir)
        if (!f.exists()) return null
        return try {
            RecordingMeta.fromJson(JSONObject(f.readText()))
        } catch (e: Exception) {
            Log.e(TAG, "Failed to read ${f.absolutePath}", e)
            null
        }
    }

    private fun writeLocked(dir: File, meta: RecordingMeta) {
        if (!dir.exists()) dir.mkdirs()
        val tmp = File(dir, "meta.json.tmp")
        val target = metaFile(dir)
        try {
            FileOutputStream(tmp).use { fos ->
                fos.write(meta.toJson().toString(2).toByteArray(Charsets.UTF_8))
                fos.flush()
                try {
                    fos.fd.sync()
                } catch (e: Exception) {
                    // best effort
                }
            }
            if (!tmp.renameTo(target)) {
                // renameTo over an existing file works on Android (POSIX rename); fallback just in case.
                target.delete()
                if (!tmp.renameTo(target)) {
                    Log.e(TAG, "Failed to rename meta tmp file in ${dir.absolutePath}")
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Failed to write meta in ${dir.absolutePath}", e)
        }
    }
}
