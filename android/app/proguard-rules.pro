# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# sherpa-onnx binds these Kotlin/Java classes to native functions by their
# fully-qualified JNI names. Its bundled AAR currently contains no consumer
# ProGuard rules, so keep the bridge stable in minified release builds.
-keep class com.k2fsa.sherpa.onnx.** { *; }
-keepclassmembers,includedescriptorclasses class * {
    native <methods>;
}

# React Native discovers this package/module through generated registration
# code. Keep the small Wormhole bridge intact along with its ReactMethod API.
-keep class com.wormhole.tts.** { *; }
