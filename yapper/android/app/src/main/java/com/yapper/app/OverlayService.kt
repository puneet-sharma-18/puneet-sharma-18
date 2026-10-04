package com.yapper.app

import android.animation.ValueAnimator
import android.annotation.SuppressLint
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.provider.Settings
import android.util.Log
import android.view.Gravity
import android.view.MotionEvent
import android.view.ViewConfiguration
import android.view.WindowManager
import android.widget.Toast
import androidx.core.content.ContextCompat
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch
import kotlin.math.abs

/** Foreground service (specialUse) hosting the draggable floating record button. */
class OverlayService : Service() {

    private lateinit var windowManager: WindowManager
    private var bubble: BubbleView? = null
    private var params: WindowManager.LayoutParams? = null
    private val handler = Handler(Looper.getMainLooper())
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var confirmUntil = 0L
    private var snapAnimator: ValueAnimator? = null

    private val ticker = object : Runnable {
        override fun run() {
            val b = bubble ?: return
            val st = RecorderState.state.value
            if (st.isRecording) {
                b.elapsedText = TimeUtil.formatElapsed(System.currentTimeMillis() - st.startedAtMillis)
            }
            if (b.confirmStop && System.currentTimeMillis() > confirmUntil) {
                b.confirmStop = false
            }
            b.invalidate()
            handler.postDelayed(this, 300L)
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        running = true
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent?.action == ACTION_HIDE) {
            stopSelfSafely()
            return START_NOT_STICKY
        }
        try {
            val n = Notifications.buildOverlay(this)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(Notifications.ID_OVERLAY, n, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            } else {
                startForeground(Notifications.ID_OVERLAY, n)
            }
        } catch (e: Exception) {
            Log.e(TAG, "startForeground failed", e)
            stopSelf()
            return START_NOT_STICKY
        }
        if (!Settings.canDrawOverlays(this)) {
            Log.w(TAG, "No overlay permission")
            stopSelfSafely()
            return START_NOT_STICKY
        }
        if (bubble == null) addBubble()
        return START_STICKY
    }

    @SuppressLint("ClickableViewAccessibility")
    private fun addBubble() {
        val sizePx = (68 * resources.displayMetrics.density).toInt()
        val prefs = Prefs(this)
        val dm = resources.displayMetrics
        val lp = WindowManager.LayoutParams(
            sizePx,
            sizePx,
            WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY,
            WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
            PixelFormat.TRANSLUCENT
        )
        lp.gravity = Gravity.TOP or Gravity.START
        lp.x = if (prefs.overlayX >= 0) prefs.overlayX else dm.widthPixels - sizePx
        lp.y = if (prefs.overlayY >= 0) prefs.overlayY else dm.heightPixels / 3
        clampToScreen(lp, sizePx)

        val view = BubbleView(this)
        val touchSlop = ViewConfiguration.get(this).scaledTouchSlop
        var downRawX = 0f
        var downRawY = 0f
        var startX = 0
        var startY = 0
        var dragging = false

        view.setOnTouchListener { _, ev ->
            when (ev.actionMasked) {
                MotionEvent.ACTION_DOWN -> {
                    snapAnimator?.cancel()
                    downRawX = ev.rawX
                    downRawY = ev.rawY
                    startX = lp.x
                    startY = lp.y
                    dragging = false
                    true
                }
                MotionEvent.ACTION_MOVE -> {
                    val dx = ev.rawX - downRawX
                    val dy = ev.rawY - downRawY
                    if (!dragging && (abs(dx) > touchSlop || abs(dy) > touchSlop)) dragging = true
                    if (dragging) {
                        lp.x = startX + dx.toInt()
                        lp.y = startY + dy.toInt()
                        clampToScreen(lp, sizePx)
                        safeUpdate(view, lp)
                    }
                    true
                }
                MotionEvent.ACTION_UP -> {
                    if (dragging) {
                        snapToEdge(view, lp, sizePx)
                    } else {
                        onBubbleTap()
                    }
                    true
                }
                MotionEvent.ACTION_CANCEL -> {
                    if (dragging) snapToEdge(view, lp, sizePx)
                    true
                }
                else -> false
            }
        }

        try {
            windowManager.addView(view, lp)
        } catch (e: Exception) {
            Log.e(TAG, "addView failed", e)
            stopSelfSafely()
            return
        }
        bubble = view
        params = lp

        scope.launch {
            RecorderState.state.collectLatest { st ->
                view.recording = st.isRecording
                view.level = st.level
                view.silenced = st.silenced
                if (st.isRecording) {
                    view.elapsedText = TimeUtil.formatElapsed(System.currentTimeMillis() - st.startedAtMillis)
                } else {
                    view.confirmStop = false
                }
            }
        }
        handler.post(ticker)
    }

    private fun onBubbleTap() {
        val b = bubble ?: return
        val st = RecorderState.state.value
        if (st.isRecording) {
            val now = System.currentTimeMillis()
            if (b.confirmStop && now <= confirmUntil) {
                b.confirmStop = false
                RecorderService.stop(this)
            } else {
                confirmUntil = now + 3000L
                b.confirmStop = true
                Toast.makeText(this, "Tap again to stop recording", Toast.LENGTH_SHORT).show()
            }
        } else {
            try {
                startActivity(TrampolineActivity.intent(this, RecorderService.ACTION_START))
            } catch (e: Exception) {
                Log.e(TAG, "Trampoline launch failed; trying direct start", e)
                try {
                    RecorderService.start(this)
                } catch (e2: Exception) {
                    Log.e(TAG, "Direct start failed", e2)
                    Toast.makeText(this, "Could not start recording. Open Yapper.", Toast.LENGTH_LONG).show()
                }
            }
        }
    }

    private fun screenSize(): Pair<Int, Int> {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            val b = windowManager.currentWindowMetrics.bounds
            Pair(b.width(), b.height())
        } else {
            val dm = resources.displayMetrics
            Pair(dm.widthPixels, dm.heightPixels)
        }
    }

    private fun clampToScreen(lp: WindowManager.LayoutParams, sizePx: Int) {
        val (w, h) = screenSize()
        lp.x = lp.x.coerceIn(0, maxOf(0, w - sizePx))
        lp.y = lp.y.coerceIn(0, maxOf(0, h - sizePx))
    }

    private fun snapToEdge(view: BubbleView, lp: WindowManager.LayoutParams, sizePx: Int) {
        val (w, _) = screenSize()
        val target = if (lp.x + sizePx / 2 < w / 2) 0 else maxOf(0, w - sizePx)
        val anim = ValueAnimator.ofInt(lp.x, target)
        anim.duration = 180L
        anim.addUpdateListener { a ->
            lp.x = a.animatedValue as Int
            safeUpdate(view, lp)
        }
        anim.start()
        snapAnimator = anim
        val prefs = Prefs(this)
        prefs.overlayX = target
        prefs.overlayY = lp.y
    }

    private fun safeUpdate(view: BubbleView, lp: WindowManager.LayoutParams) {
        try {
            if (view.isAttachedToWindow) windowManager.updateViewLayout(view, lp)
        } catch (e: Exception) {
            Log.w(TAG, "updateViewLayout failed", e)
        }
    }

    private fun removeBubble() {
        handler.removeCallbacks(ticker)
        snapAnimator?.cancel()
        val b = bubble ?: return
        bubble = null
        try {
            windowManager.removeView(b)
        } catch (_: Exception) {}
    }

    private fun stopSelfSafely() {
        removeBubble()
        try {
            stopForeground(STOP_FOREGROUND_REMOVE)
        } catch (_: Exception) {}
        stopSelf()
    }

    override fun onDestroy() {
        running = false
        scope.cancel()
        removeBubble()
        super.onDestroy()
    }

    companion object {
        private const val TAG = "OverlayService"
        const val ACTION_SHOW = "com.yapper.app.overlay.SHOW"
        const val ACTION_HIDE = "com.yapper.app.overlay.HIDE"

        @Volatile
        var running: Boolean = false
            private set

        fun start(context: Context) {
            val intent = Intent(context, OverlayService::class.java).setAction(ACTION_SHOW)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, OverlayService::class.java))
        }
    }
}
