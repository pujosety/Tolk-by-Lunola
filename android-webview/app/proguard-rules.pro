# Keep JavaScriptInterface methods for WebView bridge
-keepclassmembers class com.lunolatalk.app.MainActivity$LunolaTalkJsBridge {
    @android.webkit.JavascriptInterface <methods>;
}
