package com.lunolatalk.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.VibrationEffect
import android.os.Vibrator
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

    private val wasmerAppUrl = BuildConfig.WASMER_APP_URL
    private val notifChannelId = "tolk_messages_channel"

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

        webView = WebView(this)
        setContentView(webView)

        // Adaptive system bar + IME insets so buttons & bottom nav never get covered
        ViewCompat.setOnApplyWindowInsetsListener(webView) { view, windowInsets ->
            val insets = windowInsets.getInsets(
                WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.ime()
            )
            view.setPadding(insets.left, insets.top, insets.right, insets.bottom)
            WindowInsetsCompat.CONSUMED
        }

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "$userAgentString LunolaTalkAndroid/2.1"
        }

        webView.addJavascriptInterface(LunolaTalkJsBridge(), "LunolaTalkAndroid")

        webView.webViewClient = object : WebViewClient() {
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
                val resources = req.resources ?: return
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
                    req.deny()
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
                val bg = if (isDark) Color.parseColor("#151914") else Color.parseColor("#F2F2F2")
                window.statusBarColor = bg
                window.navigationBarColor = bg
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
        fun showNotification(title: String, body: String) {
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
                }
                val pendingIntent = PendingIntent.getActivity(
                    this@MainActivity,
                    0,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )

                val notification = NotificationCompat.Builder(this@MainActivity, notifChannelId)
                    .setSmallIcon(R.mipmap.ic_launcher)
                    .setContentTitle(title.take(80))
                    .setContentText(body.take(180))
                    .setPriority(NotificationCompat.PRIORITY_HIGH)
                    .setAutoCancel(true)
                    .setContentIntent(pendingIntent)
                    .build()

                val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                manager.notify(notificationCounter++, notification)
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
