package com.lunolatalk.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.DownloadManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.MediaStore
import android.util.Base64
import android.webkit.CookieManager
import android.webkit.JavascriptInterface
import android.webkit.PermissionRequest
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import org.json.JSONObject
import java.io.File
import java.io.FileOutputStream

/**
 * Tolk by Lunola Android WebView Shell
 * Terhubung langsung ke backend & frontend yang dideploy di Wasmer Edge.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private var pendingWebPermissionRequest: PermissionRequest? = null
    private var pendingWebResources: List<String> = emptyList()
    private var notificationCounter = 100
    private var pendingOpenChatId: String? = null
    private var lastInsetsPayload: Triple<Int, Int, Int>? = null

    private val wasmerAppUrl = BuildConfig.WASMER_APP_URL
    private val notifChannelId = "tolk_messages_channel"

    companion object {
        private const val EXTRA_CHAT_ID = "extra_chat_id"
        @Volatile
        var isForeground: Boolean = true
    }

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback ?: return@registerForActivityResult
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            callback.onReceiveValue(uris)
            filePathCallback = null
        }

    private val mediaPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            val req = pendingWebPermissionRequest
            val resources = pendingWebResources
            pendingWebPermissionRequest = null
            pendingWebResources = emptyList()

            if (req != null) {
                val grantable = mutableListOf<String>()
                if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE) &&
                    ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED
                ) {
                    grantable.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                }
                if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE) &&
                    ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED
                ) {
                    grantable.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                }
                if (grantable.isNotEmpty()) {
                    req.grant(grantable.toTypedArray())
                } else {
                    req.deny()
                }
            }

            val deniedMedia = results.entries.any {
                (it.key == Manifest.permission.RECORD_AUDIO || it.key == Manifest.permission.CAMERA) && !it.value
            }
            if (deniedMedia) {
                Toast.makeText(
                    this,
                    "Izin mikrofon/kamera dibutuhkan untuk pesan suara & panggilan WebRTC",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }

    private val notificationPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { _ -> }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        createNotificationChannel()
        requestNotificationPermissionIfNeeded()

        pendingOpenChatId = intent?.getStringExtra(EXTRA_CHAT_ID)

        webView = WebView(this)
        setContentView(webView)

        val density = resources.displayMetrics.density.coerceAtLeast(1f)
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
            val sysBars = windowInsets.getInsets(WindowInsetsCompat.Type.systemBars())
            val ime = windowInsets.getInsets(WindowInsetsCompat.Type.ime())
            // Keep WebView full-bleed edge-to-edge; forward exact CSS dp insets to JS
            view.setPadding(sysBars.left, 0, sysBars.right, 0)
            val topDp = Math.round(sysBars.top / density)
            val bottomDp = Math.round(sysBars.bottom / density)
            val imeDp = Math.round(ime.bottom / density)
            lastInsetsPayload = Triple(topDp, bottomDp, imeDp)
            dispatchInsetsToWeb(topDp, bottomDp, imeDp)
            WindowInsetsCompat.CONSUMED
        }

        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(webView, true)
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            databaseEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            setSupportZoom(false)
            builtInZoomControls = false
            displayZoomControls = false
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "$userAgentString LunolaTalkAndroid/2.2"
        }

        webView.addJavascriptInterface(LunolaTalkJsBridge(), "LunolaTalkAndroid")

        webView.setDownloadListener { url, userAgent, contentDisposition, mimeType, _ ->
            try {
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    val req = DownloadManager.Request(Uri.parse(url)).apply {
                        setMimeType(mimeType)
                        addRequestHeader("User-Agent", userAgent)
                        setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                        setDestinationInExternalPublicDir(
                            Environment.DIRECTORY_DOWNLOADS,
                            android.webkit.URLUtil.guessFileName(url, contentDisposition, mimeType)
                        )
                    }
                    val dm = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
                    dm.enqueue(req)
                    Toast.makeText(this, "Mengunduh media...", Toast.LENGTH_SHORT).show()
                }
            } catch (_: Exception) {
                Toast.makeText(this, "Gagal mengunduh file", Toast.LENGTH_SHORT).show()
            }
        }

        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                lastInsetsPayload?.let { (topDp, bottomDp, imeDp) ->
                    dispatchInsetsToWeb(topDp, bottomDp, imeDp)
                }
                pendingOpenChatId?.let { cid ->
                    pendingOpenChatId = null
                    dispatchOpenChatToWeb(cid)
                }
            }

            override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val url = request?.url ?: return false
                val allowedHost = Uri.parse(wasmerAppUrl).host
                if (url.host == allowedHost && (url.scheme == "https" || url.scheme == "http")) {
                    return false
                }
                if (url.scheme == "https" || url.scheme == "http") {
                    startActivity(Intent(Intent.ACTION_VIEW, url))
                }
                return true
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                fileChooserParams: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                val intent = fileChooserParams?.createIntent() ?: return false
                fileChooserLauncher.launch(intent)
                return true
            }

            override fun onPermissionRequest(request: PermissionRequest?) {
                val req = request ?: return
                runOnUiThread {
                    val resources = req.resources ?: emptyArray()
                    val allowed = mutableListOf<String>()
                    val missingAndroidPerms = mutableListOf<String>()

                    if (resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) {
                        val hasMic = ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.RECORD_AUDIO
                        ) == PackageManager.PERMISSION_GRANTED
                        if (hasMic) allowed.add(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                        else missingAndroidPerms.add(Manifest.permission.RECORD_AUDIO)
                    }

                    if (resources.contains(PermissionRequest.RESOURCE_VIDEO_CAPTURE)) {
                        val hasCam = ContextCompat.checkSelfPermission(
                            this@MainActivity,
                            Manifest.permission.CAMERA
                        ) == PackageManager.PERMISSION_GRANTED
                        if (hasCam) allowed.add(PermissionRequest.RESOURCE_VIDEO_CAPTURE)
                        else missingAndroidPerms.add(Manifest.permission.CAMERA)
                    }

                    if (missingAndroidPerms.isNotEmpty()) {
                        pendingWebPermissionRequest = req
                        pendingWebResources = resources.toList()
                        mediaPermissionLauncher.launch(missingAndroidPerms.toTypedArray())
                    } else if (allowed.isNotEmpty()) {
                        req.grant(allowed.toTypedArray())
                    } else {
                        req.grant(resources)
                    }
                }
            }
        }

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                webView.evaluateJavascript("window.__lunolaTalkHandleBack && window.__lunolaTalkHandleBack()") { handled ->
                    if (handled != "true") {
                        if (webView.canGoBack()) {
                            webView.goBack()
                        } else {
                            finish()
                        }
                    }
                }
            }
        })

        webView.loadUrl(wasmerAppUrl)

        val savedToken = getSharedPreferences(TolkNotificationService.PREFS_NAME, Context.MODE_PRIVATE)
            .getString(TolkNotificationService.KEY_AUTH_TOKEN, null)
        if (!savedToken.isNullOrBlank()) {
            ContextCompat.startForegroundService(
                this,
                Intent(this, TolkNotificationService::class.java)
            )
        }
    }

    override fun onResume() {
        super.onResume()
        isForeground = true
    }

    override fun onPause() {
        isForeground = false
        super.onPause()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        val cid = intent.getStringExtra(EXTRA_CHAT_ID)
        if (!cid.isNullOrBlank()) {
            dispatchOpenChatToWeb(cid)
        }
    }

    private fun dispatchInsetsToWeb(topDp: Int, bottomDp: Int, imeDp: Int) {
        if (!::webView.isInitialized) return
        webView.post {
            webView.evaluateJavascript(
                "window.__onAndroidInsets && window.__onAndroidInsets($topDp, $bottomDp, $imeDp);",
                null
            )
        }
    }

    private fun dispatchOpenChatToWeb(chatId: String) {
        if (!::webView.isInitialized || chatId.isBlank()) return
        val quoted = JSONObject.quote(chatId)
        webView.post {
            webView.evaluateJavascript(
                "window.__lunolaOpenChat && window.__lunolaOpenChat($quoted);",
                null
            )
        }
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                notifChannelId,
                "Pesan & Panggilan Tolk",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifikasi pesan baru, panggilan, dan permintaan kontak"
                enableVibration(true)
            }
            val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            manager.createNotificationChannel(channel)
        }
    }

    private fun requestNotificationPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) == PackageManager.PERMISSION_GRANTED
            if (!granted) {
                notificationPermissionLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
            }
        }
    }

    inner class LunolaTalkJsBridge {
        @JavascriptInterface
        fun isAndroidWebView(): Boolean = true

        @JavascriptInterface
        fun hapticClick() {
            runOnUiThread {
                val vibrator = getSystemService(VIBRATOR_SERVICE) as? Vibrator ?: return@runOnUiThread
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    vibrator.vibrate(VibrationEffect.createOneShot(18, VibrationEffect.DEFAULT_AMPLITUDE))
                }
            }
        }

        @JavascriptInterface
        fun setStatusBarTheme(isDark: Boolean) {
            runOnUiThread {
                window.statusBarColor = Color.TRANSPARENT
                window.navigationBarColor = Color.TRANSPARENT
                val controller = WindowInsetsControllerCompat(window, window.decorView)
                controller.isAppearanceLightStatusBars = !isDark
                controller.isAppearanceLightNavigationBars = !isDark
            }
        }

        @JavascriptInterface
        fun setCallAudioMode(inCall: Boolean) {
            runOnUiThread {
                val audioManager = getSystemService(Context.AUDIO_SERVICE) as? AudioManager ?: return@runOnUiThread
                if (inCall) {
                    audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
                    @Suppress("DEPRECATION")
                    audioManager.isSpeakerphoneOn = true
                } else {
                    @Suppress("DEPRECATION")
                    audioManager.isSpeakerphoneOn = false
                    audioManager.mode = AudioManager.MODE_NORMAL
                }
            }
        }

        @JavascriptInterface
        fun showNotification(title: String, body: String, chatId: String = "") {
            runOnUiThread {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
                    ContextCompat.checkSelfPermission(
                        this@MainActivity,
                        Manifest.permission.POST_NOTIFICATIONS
                    ) != PackageManager.PERMISSION_GRANTED
                ) {
                    return@runOnUiThread
                }

                val launchIntent = Intent(this@MainActivity, MainActivity::class.java).apply {
                    flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
                    if (chatId.isNotBlank()) {
                        putExtra(EXTRA_CHAT_ID, chatId)
                    }
                }
                val reqCode = if (chatId.isNotBlank()) chatId.hashCode() else notificationCounter
                val pendingIntent = PendingIntent.getActivity(
                    this@MainActivity,
                    reqCode,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val notification = NotificationCompat.Builder(this@MainActivity, notifChannelId)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title.take(80))
                    .setContentText(body.take(180))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                    .setDefaults(NotificationCompat.DEFAULT_ALL)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .build()

                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(notificationCounter++, notification)
            }
        }

        @JavascriptInterface
        fun setAuthToken(token: String) {
            runOnUiThread {
                val clean = token.trim()
                getSharedPreferences(TolkNotificationService.PREFS_NAME, Context.MODE_PRIVATE)
                    .edit()
                    .putString(TolkNotificationService.KEY_AUTH_TOKEN, clean)
                    .apply()
                val svcIntent = Intent(this@MainActivity, TolkNotificationService::class.java)
                if (clean.isNotEmpty()) {
                    ContextCompat.startForegroundService(this@MainActivity, svcIntent)
                } else {
                    stopService(svcIntent)
                }
            }
        }

        @JavascriptInterface
        fun saveMediaBase64(base64Data: String, filename: String, mimeType: String): Boolean {
            return try {
                val cleanBase64 = base64Data.substringAfter(",")
                val bytes = Base64.decode(cleanBase64, Base64.DEFAULT)
                val safeName = filename.ifBlank { "tolk-${System.currentTimeMillis()}.jpg" }
                val safeMime = mimeType.ifBlank { "image/jpeg" }

                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    val isVideo = safeMime.startsWith("video/")
                    val isImage = safeMime.startsWith("image/")
                    val collection = when {
                        isImage -> MediaStore.Images.Media.EXTERNAL_CONTENT_URI
                        isVideo -> MediaStore.Video.Media.EXTERNAL_CONTENT_URI
                        else -> MediaStore.Downloads.EXTERNAL_CONTENT_URI
                    }
                    val relPath = when {
                        isImage -> "${Environment.DIRECTORY_PICTURES}/Tolk by Lunola"
                        isVideo -> "${Environment.DIRECTORY_MOVIES}/Tolk by Lunola"
                        else -> "${Environment.DIRECTORY_DOWNLOADS}/Tolk by Lunola"
                    }
                    val values = ContentValues().apply {
                        put(MediaStore.MediaColumns.DISPLAY_NAME, safeName)
                        put(MediaStore.MediaColumns.MIME_TYPE, safeMime)
                        put(MediaStore.MediaColumns.RELATIVE_PATH, relPath)
                        put(MediaStore.MediaColumns.IS_PENDING, 1)
                    }
                    val resolver = applicationContext.contentResolver
                    val uri = resolver.insert(collection, values) ?: return false
                    resolver.openOutputStream(uri)?.use { out ->
                        out.write(bytes)
                    }
                    values.clear()
                    values.put(MediaStore.MediaColumns.IS_PENDING, 0)
                    resolver.update(uri, values, null, null)
                } else {
                    val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES)
                    val appDir = File(dir, "Tolk by Lunola")
                    if (!appDir.exists()) appDir.mkdirs()
                    val outFile = File(appDir, safeName)
                    FileOutputStream(outFile).use { it.write(bytes) }
                }

                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Disimpan ke Galeri", Toast.LENGTH_SHORT).show()
                }
                true
            } catch (_: Exception) {
                runOnUiThread {
                    Toast.makeText(this@MainActivity, "Gagal menyimpan ke Galeri", Toast.LENGTH_SHORT).show()
                }
                false
            }
        }

        @JavascriptInterface
        fun showToast(message: String) {
            runOnUiThread {
                Toast.makeText(this@MainActivity, message.take(120), Toast.LENGTH_SHORT).show()
            }
        }
    }
}
