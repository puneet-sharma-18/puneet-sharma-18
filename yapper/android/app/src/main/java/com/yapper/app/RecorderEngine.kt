package com.yapper.app

import android.annotation.SuppressLint
import android.content.Context
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRecordingConfiguration
import android.media.MediaRecorder
import android.os.Handler
import android.os.Looper
import android.util.Log
import java.util.concurrent.LinkedBlockingQueue
import java.util.concurrent.TimeUnit
import kotlin.math.sqrt

/**
 * Captures audio with AudioRecord on a reader thread and encodes it into 60-second
 * AAC chunks on a separate encoder thread. The two threads are decoupled by an
 * unbounded queue, so chunk rotation never stalls the AudioRecord (no dropped samples).
 */
class RecorderEngine(
    context: Context,
    private val recordingId: String,
    private val startedAtMillis: Long,
    firstSeq: Int,
    firstChunkStartMs: Long,
    private val listener: Listener,
) {
    interface Listener {
        /** Called on the encoder thread after each completed chunk. */
        fun onChunkCompleted(seq: Int)
        /** Called on the main thread. */
        fun onSilencedChanged(silenced: Boolean)
        /** Called on the main thread when the mic could not be recovered. Engine is stopping. */
        fun onFatalError(message: String)
        /** Called on the encoder thread once everything is flushed. [timelineEndMs] = end of last chunk. */
        fun onStopped(timelineEndMs: Long)
    }

    private sealed class Item {
        class Pcm(val data: ShortArray) : Item()
        /** Audio input was interrupted; close the current chunk and resync start offset to wall clock. */
        object Gap : Item()
        object Stop : Item()
    }

    private val appContext = context.applicationContext
    private val audioManager = appContext.getSystemService(Context.AUDIO_SERVICE) as AudioManager
    private val mainHandler = Handler(Looper.getMainLooper())
    private val queue = LinkedBlockingQueue<Item>()

    @Volatile private var running = false
    @Volatile private var audioRecord: AudioRecord? = null
    @Volatile private var silenced = false

    private var readerThread: Thread? = null
    private var encoderThread: Thread? = null

    // Encoder-thread state
    private var nextSeq = firstSeq
    private var nextStartMs = firstChunkStartMs
    private var current: ChunkEncoder? = null
    private var currentSeq = -1
    private var currentStartMs = 0L

    private val recordingCallback = object : AudioManager.AudioRecordingCallback() {
        override fun onRecordingConfigChanged(configs: MutableList<AudioRecordingConfiguration>?) {
            checkSilenced(configs)
        }
    }

    val isRunning: Boolean get() = running

    fun start() {
        if (running) return
        running = true
        try {
            audioManager.registerAudioRecordingCallback(recordingCallback, mainHandler)
        } catch (e: Exception) {
            Log.w(TAG, "registerAudioRecordingCallback failed", e)
        }
        encoderThread = Thread({ encoderLoop() }, "yapper-encoder").also {
            it.priority = Thread.NORM_PRIORITY + 1
            it.start()
        }
        readerThread = Thread({ readerLoop() }, "yapper-audio").also {
            it.priority = Thread.MAX_PRIORITY
            it.start()
        }
    }

    /** Request a graceful stop. The last partial chunk is finalized; onStopped is called when done. */
    fun stop() {
        running = false
        try {
            audioManager.unregisterAudioRecordingCallback(recordingCallback)
        } catch (_: Exception) {}
    }

    // ---------------------------------------------------------------- reader

    @SuppressLint("MissingPermission")
    private fun createAudioRecord(): AudioRecord? {
        return try {
            val minBuf = AudioRecord.getMinBufferSize(
                ChunkEncoder.SAMPLE_RATE, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT
            )
            // At least 2 seconds of internal buffering.
            val bufSize = maxOf(if (minBuf > 0) minBuf * 4 else 0, ChunkEncoder.SAMPLE_RATE * 2 * 2)
            val rec = AudioRecord(
                MediaRecorder.AudioSource.MIC,
                ChunkEncoder.SAMPLE_RATE,
                AudioFormat.CHANNEL_IN_MONO,
                AudioFormat.ENCODING_PCM_16BIT,
                bufSize
            )
            if (rec.state != AudioRecord.STATE_INITIALIZED) {
                Log.e(TAG, "AudioRecord not initialized")
                rec.release()
                return null
            }
            rec.startRecording()
            if (rec.recordingState != AudioRecord.RECORDSTATE_RECORDING) {
                Log.e(TAG, "AudioRecord failed to start")
                try { rec.stop() } catch (_: Exception) {}
                rec.release()
                return null
            }
            rec
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create AudioRecord", e)
            null
        }
    }

    private fun releaseAudioRecord() {
        val rec = audioRecord ?: return
        audioRecord = null
        try { rec.stop() } catch (_: Exception) {}
        try { rec.release() } catch (_: Exception) {}
    }

    /** Try to (re)open the mic with backoff. Returns false if we gave up or were stopped. */
    private fun openWithRetries(isRecovery: Boolean): Boolean {
        var attempt = 0
        while (running) {
            val rec = createAudioRecord()
            if (rec != null) {
                audioRecord = rec
                RecorderState.update { it.copy(recovering = false) }
                mainHandler.post { checkSilenced(null) }
                return true
            }
            attempt++
            if (attempt >= MAX_REOPEN_ATTEMPTS) return false
            if (isRecovery || attempt > 0) {
                RecorderState.update { it.copy(recovering = true) }
            }
            val delayMs = minOf(500L shl minOf(attempt, 6), 20_000L)
            sleepWhileRunning(delayMs)
        }
        return false
    }

    private fun sleepWhileRunning(ms: Long) {
        val end = System.currentTimeMillis() + ms
        while (running && System.currentTimeMillis() < end) {
            try {
                Thread.sleep(100)
            } catch (_: InterruptedException) {
                return
            }
        }
    }

    private fun readerLoop() {
        var fatal = false
        try {
            if (!openWithRetries(false)) {
                fatal = running
            } else {
                val buf = ShortArray(READ_SAMPLES)
                var zeroReads = 0
                var levelCounter = 0
                while (running) {
                    val rec = audioRecord ?: break
                    val n = try {
                        rec.read(buf, 0, buf.size)
                    } catch (e: Exception) {
                        Log.e(TAG, "AudioRecord.read threw", e)
                        AudioRecord.ERROR
                    }
                    if (n > 0) {
                        zeroReads = 0
                        queue.put(Item.Pcm(buf.copyOf(n)))
                        levelCounter++
                        if (levelCounter % 2 == 0 || n >= READ_SAMPLES) {
                            val lvl = rms(buf, n)
                            RecorderState.update { it.copy(level = lvl) }
                        }
                    } else {
                        if (n == 0) {
                            zeroReads++
                            if (zeroReads < 50) {
                                try { Thread.sleep(20) } catch (_: InterruptedException) {}
                                continue
                            }
                        }
                        Log.e(TAG, "AudioRecord.read error $n; recreating")
                        zeroReads = 0
                        releaseAudioRecord()
                        if (!running) break
                        queue.put(Item.Gap)
                        if (!openWithRetries(true)) {
                            fatal = running
                            break
                        }
                    }
                }
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Reader thread crashed", t)
            fatal = running
        } finally {
            releaseAudioRecord()
            RecorderState.update { it.copy(level = 0f) }
            if (fatal) {
                running = false
                try {
                    audioManager.unregisterAudioRecordingCallback(recordingCallback)
                } catch (_: Exception) {}
                mainHandler.post { listener.onFatalError("Microphone unavailable") }
            }
            queue.put(Item.Stop)
        }
    }

    private fun rms(buf: ShortArray, n: Int): Float {
        if (n <= 0) return 0f
        var sum = 0.0
        for (i in 0 until n) {
            val v = buf[i].toDouble()
            sum += v * v
        }
        val r = sqrt(sum / n) / 32768.0
        // Speech RMS is usually low; scale up for a readable meter.
        return (r * 4.0).coerceIn(0.0, 1.0).toFloat()
    }

    private fun checkSilenced(configs: List<AudioRecordingConfiguration>?) {
        val rec = audioRecord ?: return
        val list = configs ?: try {
            audioManager.activeRecordingConfigurations
        } catch (_: Exception) {
            null
        } ?: return
        val sessionId = try { rec.audioSessionId } catch (_: Exception) { return }
        val mine = list.firstOrNull { it.clientAudioSessionId == sessionId } ?: return
        val now = mine.isClientSilenced
        if (now != silenced) {
            silenced = now
            listener.onSilencedChanged(now)
        }
    }

    // ---------------------------------------------------------------- encoder

    private fun encoderLoop() {
        try {
            while (true) {
                val item = queue.poll(500, TimeUnit.MILLISECONDS) ?: continue
                when (item) {
                    is Item.Pcm -> handlePcm(item.data)
                    is Item.Gap -> {
                        closeChunk()
                        val wall = System.currentTimeMillis() - startedAtMillis
                        if (wall > nextStartMs) nextStartMs = wall
                    }
                    is Item.Stop -> {
                        closeChunk()
                        break
                    }
                }
            }
        } catch (t: Throwable) {
            Log.e(TAG, "Encoder thread crashed", t)
            try { closeChunk() } catch (_: Throwable) {}
        }
        listener.onStopped(nextStartMs)
    }

    private fun handlePcm(data: ShortArray) {
        var off = 0
        while (off < data.size) {
            val enc = current ?: openChunk() ?: return // could not create encoder: drop this buffer
            val room = (CHUNK_SAMPLES - enc.samples).toInt()
            val n = minOf(room, data.size - off)
            try {
                enc.write(data, off, n)
            } catch (e: Exception) {
                Log.e(TAG, "Encoder write failed; finalizing chunk $currentSeq", e)
                closeChunk()
                return
            }
            off += n
            if (enc.samples >= CHUNK_SAMPLES) closeChunk()
        }
    }

    private fun openChunk(): ChunkEncoder? {
        val seq = nextSeq
        val part = RecordingStore.partFile(appContext, recordingId, seq)
        part.parentFile?.mkdirs()
        return try {
            val enc = ChunkEncoder(part)
            nextSeq = seq + 1
            RecordingStore.update(appContext, recordingId) { m ->
                if (m.nextSeq < seq + 1) m.nextSeq = seq + 1
            }
            current = enc
            currentSeq = seq
            currentStartMs = nextStartMs
            enc
        } catch (e: Exception) {
            Log.e(TAG, "Failed to create encoder for chunk $seq", e)
            part.delete()
            null
        }
    }

    private fun closeChunk() {
        val enc = current ?: return
        current = null
        val seq = currentSeq
        val samples = enc.samples
        val ok = enc.finish()
        val part = RecordingStore.partFile(appContext, recordingId, seq)
        if (!ok || samples <= 0 || !part.exists() || part.length() == 0L) {
            Log.w(TAG, "Chunk $seq empty or failed (ok=$ok samples=$samples); discarding")
            part.delete()
            nextStartMs = currentStartMs + samples * 1000L / ChunkEncoder.SAMPLE_RATE
            return
        }
        val durationMs = samples * 1000L / ChunkEncoder.SAMPLE_RATE
        val finalFile = RecordingStore.chunkFile(appContext, recordingId, seq)
        if (!part.renameTo(finalFile)) {
            Log.e(TAG, "Failed to rename ${part.name}")
            nextStartMs = currentStartMs + durationMs
            return
        }
        val startMs = currentStartMs
        RecordingStore.update(appContext, recordingId) { m ->
            m.chunks.removeAll { it.seq == seq }
            m.chunks.add(ChunkMeta(seq = seq, startMs = startMs, durationMs = durationMs, uploaded = false))
            m.chunks.sortBy { it.seq }
            if (m.nextSeq < seq + 1) m.nextSeq = seq + 1
            m.durationMs = startMs + durationMs
        }
        nextStartMs = startMs + durationMs
        try {
            listener.onChunkCompleted(seq)
        } catch (e: Exception) {
            Log.e(TAG, "onChunkCompleted failed", e)
        }
    }

    companion object {
        private const val TAG = "RecorderEngine"
        const val CHUNK_SECONDS = 60
        const val CHUNK_SAMPLES: Long = 16000L * 60L // SAMPLE_RATE * CHUNK_SECONDS
        private const val READ_SAMPLES = 1600 // 100 ms
        private const val MAX_REOPEN_ATTEMPTS = 12
    }
}
