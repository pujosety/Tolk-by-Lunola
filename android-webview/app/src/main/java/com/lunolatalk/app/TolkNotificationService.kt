package com.lunolatalk.app

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.util.concurrent.Executors
import java.util.concurrent.ScheduledExecutorService
import java.util.concurrent.TimeUnit

/**
 * Lightweight background foreground-service that polls /api/bootstrap while the
 * WebView Activity is in background so incoming messages still trigger Android
 * heads-up notifications without requiring Firebase Cloud Messaging.
 */
class TolkNotificationService : Service() {

    private var scheduler: ScheduledExecutorService? = null
    private val seenMessageIds = HashSet<String>()
    private var initialized = false
    private var notifIdCounter = 2000

    companion object {
        const val PREFS_NAME = "tolk_prefs"
        const val KEY_AUTH_TOKEN = "auth_token"
        private const val BG_CHANNEL_ID = "tolk_bg_service"
        private const val MSG_CHANNEL_ID = "tolk_messages_channel"
        private const val BG_NOTIFICATION_ID = 1001
        private const val EXTRA_CHAT_ID = "extra_chat_id"
    }

    override fun onCreate() {
        super.onCreate()
        ensureChannels()
        val silentNotif = NotificationCompat.Builder(this, BG_CHANNEL_ID)
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("Tolk by Lunola")
            .setContentText("Siap menerima notifikasi pesan baru")
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setSilent(true)
            .setOngoing(true)
            .build()

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(
                BG_NOTIFICATION_ID,
                silentNotif,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
            )
        } else {
            startForeground(BG_NOTIFICATION_ID, silentNotif)
        }
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (scheduler == null) {
            scheduler = Executors.newSingleThreadScheduledExecutor().apply {
                scheduleWithFixedDelay({ pollMessages() }, 2, 10, TimeUnit.SECONDS)
            }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        scheduler?.shutdownNow()
        scheduler = null
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    private fun ensureChannels() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val bgChannel = NotificationChannel(
            BG_CHANNEL_ID,
            "Layanan Latar Belakang Tolk",
            NotificationManager.IMPORTANCE_MIN
        ).apply {
            description = "Menjaga koneksi notifikasi saat aplikasi di-minimize"
            setShowBadge(false)
        }
        manager.createNotificationChannel(bgChannel)

        val msgChannel = NotificationChannel(
            MSG_CHANNEL_ID,
            "Pesan & Panggilan Tolk",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "Notifikasi pesan baru, panggilan, dan permintaan kontak"
            enableVibration(true)
        }
        manager.createNotificationChannel(msgChannel)
    }

    private fun pollMessages() {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val token = prefs.getString(KEY_AUTH_TOKEN, null)?.trim()
        if (token.isNullOrEmpty()) return

        try {
            val url = URL("${BuildConfig.WASMER_APP_URL}/api/bootstrap")
            val conn = (url.openConnection() as HttpURLConnection).apply {
                requestMethod = "GET"
                connectTimeout = 8000
                readTimeout = 8000
                setRequestProperty("Authorization", "Bearer $token")
                setRequestProperty("Accept", "application/json")
            }

            if (conn.responseCode != 200) {
                conn.disconnect()
                return
            }

            val body = conn.inputStream.bufferedReader().use { it.readText() }
            conn.disconnect()

            val json = JSONObject(body)
            val currentUserId = json.optJSONObject("currentUser")?.optString("id") ?: ""
            val usersArr = json.optJSONArray("users")
            val userNames = HashMap<String, String>()
            if (usersArr != null) {
                for (i in 0 until usersArr.length()) {
                    val u = usersArr.optJSONObject(i) ?: continue
                    val uid = u.optString("id")
                    val dname = u.optString("displayName")
                    if (uid.isNotEmpty() && dname.isNotEmpty()) {
                        userNames[uid] = dname
                    }
                }
            }

            val chatsArr = json.optJSONArray("chats") ?: return
            for (i in 0 until chatsArr.length()) {
                val chat = chatsArr.optJSONObject(i) ?: continue
                val chatId = chat.optString("id")
                val chatTitle = chat.optString("title", "Tolk by Lunola")
                val chatType = chat.optString("type", "dm")
                val unread = chat.optInt("unreadCount", 0)
                val muted = chat.optBoolean("isMutedByUser", false)
                val lastMsg = chat.optJSONObject("lastMessage") ?: continue
                val msgId = lastMsg.optString("id")
                val senderId = lastMsg.optString("senderId")

                if (msgId.isEmpty()) continue

                if (!initialized) {
                    seenMessageIds.add(msgId)
                    continue
                }

                if (seenMessageIds.contains(msgId)) continue
                seenMessageIds.add(msgId)

                // Skip own messages, muted chats, or already-read messages
                if (senderId == currentUserId || muted || unread <= 0) continue

                // Skip while MainActivity is actively visible in foreground (WebView handles it)
                if (MainActivity.isForeground) continue

                val senderName = userNames[senderId] ?: "Tolk by Lunola"
                val title = if (chatType == "group") "$senderName · $chatTitle" else senderName
                val text = lastMsg.optString("text").ifBlank {
                    lastMsg.optJSONObject("attachment")?.optString("name")?.ifBlank { null }
                        ?: "Mengirim lampiran media"
                }

                postNotification(title, text, chatId)
            }
            initialized = true
        } catch (_: Exception) {
            // Transient network error; retry on next tick
        }
    }

    private fun postNotification(title: String, body: String, chatId: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(
                this,
                Manifest.permission.POST_NOTIFICATIONS
            ) != PackageManager.PERMISSION_GRANTED
        ) {
            return
        }

        val launchIntent = Intent(this, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_SINGLE_TOP or Intent.FLAG_ACTIVITY_CLEAR_TOP
            if (chatId.isNotBlank()) {
                putExtra(EXTRA_CHAT_ID, chatId)
            }
        }
        val reqCode = if (chatId.isNotBlank()) chatId.hashCode() else notifIdCounter
        val pendingIntent = PendingIntent.getActivity(
            this,
            reqCode,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, MSG_CHANNEL_ID)
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
        manager.notify(notifIdCounter++, notification)
    }
}
