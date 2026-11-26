package com.lunolatalk.app

import android.Manifest
import android.annotation.SuppressLint
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
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
import androidx.core.content.ContextCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Tolk by Lunola Android WebView Shell
 * Terhubung langsung ke backend & frontend yang dideploy di Wasmer Edge.
 */
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private var filePathCallback: ValueCallback<Array<Uri>>? = null

    // Ganti URL ini dengan domain Wasmer Edge hasil `wasmer deploy`
    private val wasmerAppUrl = BuildConfig.WASMER_APP_URL

    private val fileChooserLauncher =
        registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { result ->
            val callback = filePathCallback ?: return@registerForActivityResult
            val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
            callback.onReceiveValue(uris)
            filePathCallback = null
        }

    private val mediaPermissionLauncher =
        registerForActivityResult(ActivityResultContracts.RequestMultiplePermissions()) { results ->
            val denied = results.values.any { !it }
            if (denied) {
                Toast.makeText(
                    this,
                    "Izin mikrofon/kamera dibutuhkan untuk pesan suara & panggilan WebRTC",
                    Toast.LENGTH_SHORT
                ).show()
            }
        }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, true)

        webView = WebView(this)
        setContentView(webView)

        webView.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            allowFileAccess = false
            allowContentAccess = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            userAgentString = "$userAgentString LunolaTalkAndroid/2.0"
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
                val resources = request?.resources ?: return
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
                    mediaPermissionLauncher.launch(missingAndroidPerms.toTypedArray())
                    request.deny()
                } else if (allowed.isNotEmpty()) {
                    request.grant(allowed.toTypedArray())
                } else {
                    request.deny()
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
                window.statusBarColor = if (isDark) Color.parseColor("#0D0B0E") else Color.parseColor("#F6F2EB")
                val controller = WindowInsetsControllerCompat(window, window.decorView)
                controller.isAppearanceLightStatusBars = !isDark
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
