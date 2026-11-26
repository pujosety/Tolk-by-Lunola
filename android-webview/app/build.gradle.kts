plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.lunolatalk.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.lunolatalk.app"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "1.0.0"

        // Ganti URL ini dengan URL Wasmer Edge atau domain self-hosted Tolk by Lunola Anda
        buildConfigField("String", "WASMER_APP_URL", "\"https://lunola-talk.wasmer.app\"")
    }

    buildFeatures {
        buildConfig = true
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.15.0")
    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.activity:activity-ktx:1.10.0")
}
