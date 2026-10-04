package com.yapper.app

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.drawable.Drawable
import android.os.SystemClock
import android.view.View
import androidx.core.content.ContextCompat

/** The round floating button drawn with plain Canvas calls. */
class BubbleView(context: Context) : View(context) {

    var recording: Boolean = false
        set(value) { field = value; invalidate() }
    var level: Float = 0f
        set(value) { field = value; invalidate() }
    var silenced: Boolean = false
        set(value) { field = value; invalidate() }
    var elapsedText: String = ""
        set(value) { field = value; invalidate() }
    var confirmStop: Boolean = false
        set(value) { field = value; invalidate() }

    private val density = resources.displayMetrics.density
    private val micDrawable: Drawable? = ContextCompat.getDrawable(context, R.drawable.ic_mic)?.mutate()

    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.FILL }
    private val ringPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        color = Color.argb(200, 255, 120, 120)
    }
    private val borderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1.5f * density
        color = Color.argb(120, 255, 255, 255)
    }
    private val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.FILL
        color = Color.rgb(255, 59, 48)
    }
    private val dotBorderPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeWidth = 1.5f * density
        color = Color.WHITE
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textAlign = Paint.Align.CENTER
        isFakeBoldText = true
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        val w = width.toFloat()
        val h = height.toFloat()
        val cx = w / 2f
        val cy = h / 2f
        val maxR = minOf(w, h) / 2f
        val ringSpace = 6f * density
        val r = maxR - ringSpace

        if (recording) {
            // Level ring / pulse around the button.
            val lvl = level.coerceIn(0f, 1f)
            ringPaint.strokeWidth = 1f * density + lvl * (ringSpace - 1f * density)
            ringPaint.alpha = (90 + lvl * 165).toInt().coerceIn(0, 255)
            canvas.drawCircle(cx, cy, r + ringPaint.strokeWidth / 2f, ringPaint)

            fillPaint.color = when {
                confirmStop -> Color.rgb(120, 0, 0)
                silenced -> Color.rgb(140, 90, 0)
                else -> Color.rgb(198, 40, 40)
            }
            canvas.drawCircle(cx, cy, r, fillPaint)
            canvas.drawCircle(cx, cy, r, borderPaint)

            if (confirmStop) {
                textPaint.textSize = 12f * density
                drawCenteredText(canvas, "Tap to", cx, cy - 7f * density)
                drawCenteredText(canvas, "STOP", cx, cy + 8f * density)
            } else {
                // Small blinking "alive" dot at the top.
                val blinkOn = (SystemClock.elapsedRealtime() / 600L) % 2L == 0L
                val dotR = 4f * density
                val dotY = cy - r * 0.48f
                if (blinkOn || silenced) {
                    canvas.drawCircle(cx, dotY, dotR, dotPaint)
                    canvas.drawCircle(cx, dotY, dotR, dotBorderPaint)
                }
                val text = elapsedText
                textPaint.textSize = (if (text.length > 5) 11f else 13f) * density
                drawCenteredText(canvas, text, cx, cy + 6f * density)
            }
        } else {
            fillPaint.color = Color.argb(230, 50, 50, 56)
            canvas.drawCircle(cx, cy, r, fillPaint)
            canvas.drawCircle(cx, cy, r, borderPaint)
            val d = micDrawable
            if (d != null) {
                val half = (r * 0.55f).toInt()
                d.setBounds(cx.toInt() - half, cy.toInt() - half, cx.toInt() + half, cy.toInt() + half)
                d.setTint(Color.WHITE)
                d.draw(canvas)
            }
        }
    }

    private fun drawCenteredText(canvas: Canvas, text: String, cx: Float, baselineY: Float) {
        // baselineY is the visual centre; adjust using font metrics
        val fm = textPaint.fontMetrics
        val y = baselineY - (fm.ascent + fm.descent) / 2f - 4f * density / 2f
        canvas.drawText(text, cx, y, textPaint)
    }
}
