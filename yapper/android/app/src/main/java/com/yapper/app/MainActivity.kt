package com.yapper.app

import android.Manifest
import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Card
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {

    private var resumeTick by mutableIntStateOf(0)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            YapperTheme {
                MainScreen(resumeTick = resumeTick)
            }
        }
    }

    override fun onResume() {
        super.onResume()
        resumeTick++
        val prefs = Prefs(this)
        if (prefs.showOverlay && Settings.canDrawOverlays(this) && !OverlayService.running) {
            try {
                OverlayService.start(this)
            } catch (_: Exception) {
            }
        }
    }
}

private val RecordRed = Color(0xFFE53935)

@Composable
fun YapperTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = Color(0xFFFF6E6E),
            onPrimary = Color(0xFF2B0000),
            secondary = Color(0xFF9FA8DA),
            background = Color(0xFF101014),
            surface = Color(0xFF17171C),
        ),
        content = content
    )
}

private val LANGUAGES = listOf(
    "auto" to "Auto",
    "hi" to "Hindi",
    "en" to "English",
    "mr" to "Marathi",
)

private class SetupStatus(
    val mic: Boolean,
    val notifications: Boolean,
    val overlay: Boolean,
    val battery: Boolean,
)

private fun computeSetup(context: Context): SetupStatus {
    val mic = ContextCompat.checkSelfPermission(context, Manifest.permission.RECORD_AUDIO) ==
        PackageManager.PERMISSION_GRANTED
    val notif = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED
    } else {
        true
    }
    val overlay = Settings.canDrawOverlays(context)
    val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
    val battery = pm.isIgnoringBatteryOptimizations(context.packageName)
    return SetupStatus(mic, notif, overlay, battery)
}

private fun safeStartActivity(context: Context, intent: Intent, fallback: Intent? = null) {
    try {
        context.startActivity(intent)
    } catch (e: ActivityNotFoundException) {
        if (fallback != null) {
            try {
                context.startActivity(fallback)
            } catch (_: Exception) {
                Toast.makeText(context, "Could not open settings", Toast.LENGTH_SHORT).show()
            }
        } else {
            Toast.makeText(context, "Could not open settings", Toast.LENGTH_SHORT).show()
        }
    } catch (e: Exception) {
        Toast.makeText(context, "Could not open: ${e.message}", Toast.LENGTH_SHORT).show()
    }
}

private fun appDetailsIntent(context: Context): Intent =
    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.fromParts("package", context.packageName, null))

private fun openDashboard(context: Context, prefs: Prefs) {
    val base = prefs.normalizedBaseUrl()
    if (base.isEmpty()) {
        Toast.makeText(context, "Set the server URL first", Toast.LENGTH_SHORT).show()
        return
    }
    try {
        context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse("$base/")))
    } catch (e: Exception) {
        Toast.makeText(context, "No browser found", Toast.LENGTH_SHORT).show()
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(resumeTick: Int) {
    val context = LocalContext.current
    val prefs = remember { Prefs(context) }
    val scope = rememberCoroutineScope()
    val recState by RecorderState.state.collectAsState()

    var permTick by remember { mutableIntStateOf(0) }
    var pendingStart by remember { mutableStateOf(false) }
    var title by remember { mutableStateOf(prefs.nextTitle) }
    var language by remember { mutableStateOf(prefs.nextLanguage) }
    var baseUrl by remember { mutableStateOf(prefs.baseUrl) }
    var token by remember { mutableStateOf(prefs.token) }
    var deleteAfterUpload by remember { mutableStateOf(prefs.deleteAfterUpload) }
    var showOverlay by remember { mutableStateOf(prefs.showOverlay) }
    var pingResult by remember { mutableStateOf<String?>(null) }
    var pinging by remember { mutableStateOf(false) }
    var recordings by remember { mutableStateOf<List<RecordingMeta>>(emptyList()) }
    var now by remember { mutableLongStateOf(System.currentTimeMillis()) }

    val setup = remember(resumeTick, permTick) { computeSetup(context) }

    fun startRecording() {
        prefs.nextTitle = title
        prefs.nextLanguage = language
        try {
            RecorderService.start(context)
            title = ""
        } catch (e: Exception) {
            Toast.makeText(context, "Could not start: ${e.message}", Toast.LENGTH_LONG).show()
        }
    }

    val micLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        permTick++
        if (granted && pendingStart) {
            startRecording()
        } else if (!granted) {
            Toast.makeText(context, "Microphone permission is required", Toast.LENGTH_LONG).show()
        }
        pendingStart = false
    }
    val notifLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { _ -> permTick++ }

    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis()
            delay(500)
        }
    }
    LaunchedEffect(Unit) {
        while (true) {
            recordings = withContext(Dispatchers.IO) { RecordingStore.list(context) }
            delay(3000)
        }
    }

    Scaffold(modifier = Modifier.fillMaxSize()) { innerPadding ->
        LazyColumn(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding),
            contentPadding = PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(16.dp)
        ) {
            item {
                Text(
                    "Yapper",
                    style = MaterialTheme.typography.headlineMedium,
                    fontWeight = FontWeight.Bold
                )
            }

            // ------------------------------------------------ Recorder card
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(12.dp)
                    ) {
                        val elapsed = if (recState.isRecording) now - recState.startedAtMillis else 0L
                        Text(
                            TimeUtil.formatElapsed(elapsed),
                            fontSize = 48.sp,
                            fontWeight = FontWeight.Bold,
                            color = if (recState.isRecording) RecordRed else MaterialTheme.colorScheme.onSurface,
                            modifier = Modifier.align(Alignment.CenterHorizontally)
                        )
                        if (recState.isRecording) {
                            LinearProgressIndicator(
                                progress = { recState.level.coerceIn(0f, 1f) },
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .height(10.dp),
                                color = RecordRed
                            )
                            val statusText = when {
                                recState.recovering -> "Microphone error – reconnecting…"
                                recState.silenced -> "Paused by another app – will continue automatically"
                                else -> "Recording. You can lock the phone."
                            }
                            Text(statusText, style = MaterialTheme.typography.bodyMedium)
                        }
                        Button(
                            onClick = {
                                if (recState.isRecording) {
                                    RecorderService.stop(context)
                                } else if (!setup.mic) {
                                    pendingStart = true
                                    micLauncher.launch(Manifest.permission.RECORD_AUDIO)
                                } else {
                                    startRecording()
                                }
                            },
                            colors = ButtonDefaults.buttonColors(
                                containerColor = if (recState.isRecording) Color(0xFF424242) else RecordRed,
                                contentColor = Color.White
                            ),
                            modifier = Modifier
                                .fillMaxWidth()
                                .height(72.dp)
                        ) {
                            Text(
                                if (recState.isRecording) "STOP" else "START RECORDING",
                                fontSize = 22.sp,
                                fontWeight = FontWeight.Bold
                            )
                        }
                        if (!recState.isRecording) {
                            OutlinedTextField(
                                value = title,
                                onValueChange = {
                                    title = it
                                    prefs.nextTitle = it
                                },
                                label = { Text("Title for next recording (optional)") },
                                singleLine = true,
                                modifier = Modifier.fillMaxWidth()
                            )
                            Text("Language", style = MaterialTheme.typography.labelLarge)
                            Row(
                                horizontalArrangement = Arrangement.spacedBy(8.dp),
                                modifier = Modifier.horizontalScroll(rememberScrollState())
                            ) {
                                for ((code, label) in LANGUAGES) {
                                    FilterChip(
                                        selected = language == code,
                                        onClick = {
                                            language = code
                                            prefs.nextLanguage = code
                                        },
                                        label = { Text(label) }
                                    )
                                }
                            }
                        }
                    }
                }
            }

            // ------------------------------------------------ Setup checklist
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Setup checklist", style = MaterialTheme.typography.titleMedium)
                        SetupRow("Microphone permission", setup.mic, "Grant") {
                            micLauncher.launch(Manifest.permission.RECORD_AUDIO)
                        }
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            SetupRow("Notification permission", setup.notifications, "Grant") {
                                notifLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                            }
                        }
                        SetupRow("Display over other apps", setup.overlay, "Open") {
                            safeStartActivity(
                                context,
                                Intent(
                                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    Uri.parse("package:${context.packageName}")
                                ),
                                Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION)
                            )
                        }
                        SetupRow("Battery optimisation exemption", setup.battery, "Allow") {
                            safeStartActivity(
                                context,
                                Intent(
                                    Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS,
                                    Uri.parse("package:${context.packageName}")
                                ),
                                Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS)
                            )
                        }
                        HorizontalDivider()
                        Text(
                            "Samsung: Settings → Battery → Background usage limits → " +
                                "Never sleeping apps → add Yapper",
                            style = MaterialTheme.typography.bodyMedium
                        )
                        OutlinedButton(onClick = { safeStartActivity(context, appDetailsIntent(context)) }) {
                            Text("Open app settings")
                        }
                        HorizontalDivider()
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Column(modifier = Modifier.weight(1f)) {
                                Text("Show floating button")
                                Text(
                                    "Record from any app; tap to start, tap twice to stop",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                            Switch(
                                checked = showOverlay,
                                onCheckedChange = { on ->
                                    if (on) {
                                        if (!Settings.canDrawOverlays(context)) {
                                            Toast.makeText(
                                                context,
                                                "Allow \"Display over other apps\" first",
                                                Toast.LENGTH_LONG
                                            ).show()
                                            safeStartActivity(
                                                context,
                                                Intent(
                                                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                                    Uri.parse("package:${context.packageName}")
                                                )
                                            )
                                        } else {
                                            showOverlay = true
                                            prefs.showOverlay = true
                                            try {
                                                OverlayService.start(context)
                                            } catch (e: Exception) {
                                                Toast.makeText(context, "Could not show button: ${e.message}", Toast.LENGTH_LONG).show()
                                            }
                                        }
                                    } else {
                                        showOverlay = false
                                        prefs.showOverlay = false
                                        OverlayService.stop(context)
                                    }
                                }
                            )
                        }
                    }
                }
            }

            // ------------------------------------------------ Server settings
            item {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(16.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text("Server", style = MaterialTheme.typography.titleMedium)
                        OutlinedTextField(
                            value = baseUrl,
                            onValueChange = {
                                baseUrl = it
                                prefs.baseUrl = it
                            },
                            label = { Text("Base URL (e.g. https://my-pc.tailnet.ts.net)") },
                            singleLine = true,
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = token,
                            onValueChange = {
                                token = it
                                prefs.token = it
                            },
                            label = { Text("Token") },
                            singleLine = true,
                            visualTransformation = PasswordVisualTransformation(),
                            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                            modifier = Modifier.fillMaxWidth()
                        )
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Button(
                                enabled = !pinging,
                                onClick = {
                                    pinging = true
                                    pingResult = null
                                    scope.launch {
                                        val result = withContext(Dispatchers.IO) {
                                            try {
                                                val base = prefs.normalizedBaseUrl()
                                                if (base.isEmpty()) {
                                                    "Enter a base URL first"
                                                } else {
                                                    ApiClient(base, prefs.token).ping()
                                                    "Connected ✓"
                                                }
                                            } catch (e: Exception) {
                                                "Failed: ${e.message ?: e.javaClass.simpleName}"
                                            }
                                        }
                                        pingResult = result
                                        pinging = false
                                        if (result.startsWith("Connected")) {
                                            UploadScheduler.retryNow(context)
                                        }
                                    }
                                }
                            ) {
                                Text(if (pinging) "Testing…" else "Test connection")
                            }
                            Spacer(Modifier.width(12.dp))
                            TextButton(onClick = { openDashboard(context, prefs) }) {
                                Text("Open dashboard")
                            }
                        }
                        val pr = pingResult
                        if (pr != null) {
                            Text(pr, style = MaterialTheme.typography.bodyMedium)
                        }
                        Row(
                            verticalAlignment = Alignment.CenterVertically,
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Delete local audio after upload", modifier = Modifier.weight(1f))
                            Switch(
                                checked = deleteAfterUpload,
                                onCheckedChange = {
                                    deleteAfterUpload = it
                                    prefs.deleteAfterUpload = it
                                }
                            )
                        }
                    }
                }
            }

            // ------------------------------------------------ Recordings
            item {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(
                        "Recordings",
                        style = MaterialTheme.typography.titleMedium,
                        modifier = Modifier.weight(1f)
                    )
                    TextButton(onClick = { UploadScheduler.retryNow(context) }) {
                        Text("Upload all now")
                    }
                }
            }
            if (recordings.isEmpty()) {
                item { Text("No recordings yet.", style = MaterialTheme.typography.bodyMedium) }
            }
            items(recordings, key = { it.id }) { m ->
                RecordingRow(
                    meta = m,
                    isActive = recState.isRecording && recState.recordingId == m.id,
                    now = now,
                    onRetry = { UploadScheduler.retryNow(context) },
                    onFinalize = {
                        scope.launch {
                            withContext(Dispatchers.IO) { RecordingStore.finalizeStale(context, m.id) }
                            UploadScheduler.retryNow(context)
                            recordings = withContext(Dispatchers.IO) { RecordingStore.list(context) }
                        }
                    },
                    onDashboard = { openDashboard(context, prefs) }
                )
            }
            item { Spacer(Modifier.height(24.dp)) }
        }
    }
}

@Composable
private fun SetupRow(label: String, ok: Boolean, buttonText: String, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier.fillMaxWidth()
    ) {
        Text(
            if (ok) "✅" else "⚠️",
            modifier = Modifier.padding(end = 8.dp)
        )
        Text(label, modifier = Modifier.weight(1f))
        if (!ok) {
            OutlinedButton(onClick = onClick) { Text(buttonText) }
        } else {
            Text("OK", color = Color(0xFF81C784))
        }
    }
}

@Composable
private fun RecordingRow(
    meta: RecordingMeta,
    isActive: Boolean,
    now: Long,
    onRetry: () -> Unit,
    onFinalize: () -> Unit,
    onDashboard: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(
            modifier = Modifier.padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            val title = meta.title
            Text(
                if (title.isNullOrBlank()) "Untitled recording" else title,
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.Bold
            )
            Text(TimeUtil.display(meta.startedAtMillis), style = MaterialTheme.typography.bodySmall)
            val durationMs = if (isActive) now - meta.startedAtMillis else maxOf(meta.durationMs, meta.timelineEndMs)
            val stateLabel = when {
                isActive -> "● Recording"
                meta.state == RecordingMeta.STATE_RECORDING -> "Interrupted (not finished)"
                meta.finishedRemote -> "Uploaded ✓"
                else -> "Finished – uploading"
            }
            Text(
                "${TimeUtil.formatElapsed(durationMs)} · ${meta.uploadedCount}/${meta.chunks.size} chunks uploaded · lang ${meta.language}",
                style = MaterialTheme.typography.bodyMedium
            )
            Text(
                stateLabel + if (meta.localDeleted) " · local audio deleted" else "",
                style = MaterialTheme.typography.bodyMedium,
                color = if (isActive) RecordRed else MaterialTheme.colorScheme.onSurface
            )
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (!meta.finishedRemote) {
                    OutlinedButton(onClick = onRetry) { Text("Retry upload") }
                }
                if (!isActive && meta.state == RecordingMeta.STATE_RECORDING) {
                    OutlinedButton(onClick = onFinalize) { Text("Finish") }
                }
                TextButton(onClick = onDashboard) { Text("Open dashboard") }
            }
        }
    }
}
