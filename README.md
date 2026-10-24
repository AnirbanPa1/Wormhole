# Wormhole Mobile

Wormhole is a local-first Android PDF reader with offline Kokoro narration, reading progress, saved words, and dictionary lookup.

## Install and updates

[![Get it on Obtainium](https://raw.githubusercontent.com/ImranR98/Obtainium/main/assets/graphics/badge_obtainium.png)](https://apps.obtainium.imranr.dev/redirect?r=obtainium://add/https://github.com/AnirbanPa1/Wormhole)

Tap the badge on an Android device to add Wormhole to Obtainium. You can
also add it manually by pasting this repository URL into Obtainium:

```text
https://github.com/AnirbanPa1/Wormhole
```

Obtainium tracks Wormhole's stable GitHub releases and installs the attached
`arm64-v8a` APK. The Android package ID is `com.wormhole`.

## Requirements

- Node.js 22.11 or newer
- npm
- JDK and Android SDK configured for React Native
- An Android `arm64-v8a` device (the current native build target)

## Development

```powershell
npm install
npm start
npm run android
```

Run the project checks with:

```powershell
npm run typecheck
npm run lint
npm test -- --runInBand
```

PDFs are selected through Android's system document picker and copied into the app's private storage. The Kokoro model can be downloaded from Settings and is also stored privately on the device.

## Release build

Copy `android/keystore.properties.example` to `android/keystore.properties`, replace the placeholder signing values, and keep both the properties file and keystore private. Then build the signed APK:

```powershell
cd android
.\gradlew.bat assembleRelease
```

The APK is written to `android/app/build/outputs/apk/release/`.

For Obtainium-compatible updates, each public release must:

- use a semantic tag such as `v0.3.0`;
- attach the signed `arm64-v8a` APK directly to the GitHub release;
- increase Android `versionCode` for every update; and
- use the same release signing key as previous versions.

The app is intentionally local-first: imported books, extracted text,
dictionary data, and generated narration remain on the device.
