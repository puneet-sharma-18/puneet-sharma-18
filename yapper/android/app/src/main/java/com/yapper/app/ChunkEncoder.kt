package com.yapper.app

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.util.Log
import java.io.File
import java.nio.ByteOrder

/**
 * Encodes 16 kHz mono PCM16 into one AAC-LC .m4a file (MediaCodec + MediaMuxer).
 * Not thread safe: use from a single thread.
 */
class ChunkEncoder(private val outFile: File) {

    private val codec: MediaCodec
    private val muxer: MediaMuxer
    private val bufferInfo = MediaCodec.BufferInfo()
    private var trackIndex = -1
    private var muxerStarted = false
    private var released = false
    private var samplesWritten = 0L

    /** Number of PCM samples (per channel) fed into this chunk so far. */
    val samples: Long get() = samplesWritten

    init {
        val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, SAMPLE_RATE, 1)
        format.setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
        format.setInteger(MediaFormat.KEY_BIT_RATE, BIT_RATE)
        format.setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 16 * 1024)
        val c = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
        try {
            c.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
            c.start()
        } catch (e: Exception) {
            try { c.release() } catch (_: Exception) {}
            throw e
        }
        codec = c
        muxer = try {
            MediaMuxer(outFile.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        } catch (e: Exception) {
            try { c.stop() } catch (_: Exception) {}
            try { c.release() } catch (_: Exception) {}
            throw e
        }
    }

    private fun ptsUs(sampleCount: Long): Long = sampleCount * 1_000_000L / SAMPLE_RATE

    /** Feed [length] samples from [pcm] starting at [offset]. */
    fun write(pcm: ShortArray, offset: Int, length: Int) {
        var pos = offset
        val end = offset + length
        var spins = 0
        while (pos < end) {
            val inIndex = codec.dequeueInputBuffer(10_000)
            if (inIndex >= 0) {
                val buf = codec.getInputBuffer(inIndex)
                if (buf == null) {
                    codec.queueInputBuffer(inIndex, 0, 0, ptsUs(samplesWritten), 0)
                    continue
                }
                buf.clear()
                val capacitySamples = buf.remaining() / 2
                val n = minOf(capacitySamples, end - pos)
                val sb = buf.order(ByteOrder.nativeOrder()).asShortBuffer()
                sb.put(pcm, pos, n)
                codec.queueInputBuffer(inIndex, 0, n * 2, ptsUs(samplesWritten), 0)
                samplesWritten += n
                pos += n
                spins = 0
            } else {
                spins++
                if (spins > 500) {
                    throw IllegalStateException("Encoder input stalled")
                }
            }
            drain(false)
        }
    }

    /**
     * Signal end-of-stream, drain, and finalize the file.
     * Returns true if the file contains at least one encoded sample and was finalized.
     */
    fun finish(): Boolean {
        if (released) return false
        var ok = false
        try {
            var queued = false
            var tries = 0
            while (!queued && tries < 100) {
                val inIndex = codec.dequeueInputBuffer(10_000)
                if (inIndex >= 0) {
                    codec.queueInputBuffer(
                        inIndex, 0, 0, ptsUs(samplesWritten), MediaCodec.BUFFER_FLAG_END_OF_STREAM
                    )
                    queued = true
                } else {
                    drain(false)
                }
                tries++
            }
            drain(true)
            ok = true
        } catch (e: Exception) {
            Log.e(TAG, "Error finishing encoder", e)
        }
        try { codec.stop() } catch (_: Exception) {}
        try { codec.release() } catch (_: Exception) {}
        var muxOk = false
        if (muxerStarted) {
            try {
                muxer.stop()
                muxOk = true
            } catch (e: Exception) {
                Log.e(TAG, "Error stopping muxer", e)
            }
        }
        try { muxer.release() } catch (_: Exception) {}
        released = true
        return ok && muxOk && samplesWritten > 0
    }

    /** Release without finalizing (used after fatal errors). */
    fun abort() {
        if (released) return
        try { codec.stop() } catch (_: Exception) {}
        try { codec.release() } catch (_: Exception) {}
        if (muxerStarted) {
            try { muxer.stop() } catch (_: Exception) {}
        }
        try { muxer.release() } catch (_: Exception) {}
        released = true
    }

    private fun drain(endOfStream: Boolean) {
        var tryAgainCount = 0
        while (true) {
            val outIndex = codec.dequeueOutputBuffer(bufferInfo, if (endOfStream) 10_000L else 0L)
            if (outIndex == MediaCodec.INFO_TRY_AGAIN_LATER) {
                if (!endOfStream) return
                tryAgainCount++
                if (tryAgainCount > 300) {
                    Log.w(TAG, "Timed out waiting for EOS from encoder")
                    return
                }
            } else if (outIndex == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED) {
                if (!muxerStarted) {
                    trackIndex = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                    muxerStarted = true
                }
            } else if (outIndex >= 0) {
                val out = codec.getOutputBuffer(outIndex)
                val isConfig = (bufferInfo.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) != 0
                if (out != null && !isConfig && bufferInfo.size > 0 && muxerStarted) {
                    out.position(bufferInfo.offset)
                    out.limit(bufferInfo.offset + bufferInfo.size)
                    muxer.writeSampleData(trackIndex, out, bufferInfo)
                }
                codec.releaseOutputBuffer(outIndex, false)
                if ((bufferInfo.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0) {
                    return
                }
            }
            // other negative values (e.g. deprecated INFO_OUTPUT_BUFFERS_CHANGED): just loop
        }
    }

    companion object {
        private const val TAG = "ChunkEncoder"
        const val SAMPLE_RATE = 16000
        const val BIT_RATE = 32000
    }
}
