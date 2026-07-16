# Building Function Plane as a mobile app

Function Plane is a no-bundler PWA. To ship it as a native app we wrap the
existing `function-plane/` static site in a [Capacitor](https://capacitorjs.com)
WebView shell. The same JavaScript, the same Supabase backend, the same admin
panel — just packaged as an Android `.aab` / `.apk` (and iOS `.ipa` if you
have a Mac).

The repo already includes `capacitor.config.json`, a `package.json`, and a
`.gitignore` that excludes the generated `android/` and `ios/` folders so
each developer can recreate them locally without bloating the repo.

---

## Which devices it'll run on

| Platform | Supported | Build host you need | Notes |
| --- | --- | --- | --- |
| **Android** | ✅ Yes | Windows / macOS / Linux | Build `.apk` / `.aab` from Android Studio. Targets Android 7+ (most modern WebViews). |
| **iOS** | ✅ Yes | **macOS only** (Xcode) | Build `.ipa` from Xcode. Targets iOS 13+. Submitting to the App Store requires a $99/yr Apple Developer account. |
| Web (PWA) | ✅ Yes | Any | The existing `function-plane/` folder is the PWA; serve it from any static host. |

The admin panel works identically in all three places — sign in as the user
named exactly **`Test Account`** and the Admin button appears in the account
screen.

---

## One-time prerequisites

- **Node.js 18+** ([nodejs.org](https://nodejs.org)) — needed for the
  Capacitor CLI.
- **Android Studio** ([developer.android.com/studio](https://developer.android.com/studio))
  — installs the JDK, Gradle, and the Android SDK in one go. Open it once
  after install so it can finish downloading components.
- (iOS only) **macOS + Xcode 15+** from the Mac App Store. After install,
  run `sudo xcode-select --install` once.

---

## Build steps — Android

Run from the repo root (`/path/to/Function-Plane`).

```bash
# 1. Install the Capacitor CLI + platform packages
npm install

# 2. Add the Android shell (creates ./android/)
npx cap add android

# 3. Sync the web app (function-plane/) into the Android project
npx cap sync android

# 4. Open in Android Studio
npx cap open android
```

Android Studio will pop up. From there:

1. Wait for Gradle sync to finish (status bar at the bottom).
2. Plug in an Android phone with **USB debugging enabled**, or pick the
   emulator from the device dropdown.
3. Press the green **Run** button (▶) — the app installs on the device.
4. To produce a shareable file:
   - **APK** (sideload-friendly): Build → Build Bundle(s)/APK(s) → Build
     APK(s). Output is at `android/app/build/outputs/apk/debug/app-debug.apk`.
   - **AAB** for Play Store: Build → Generate Signed Bundle / APK… → Android
     App Bundle. Follow the wizard, create a keystore the first time and
     keep its password safe.

After any code change in `function-plane/`, run:
```bash
npx cap sync android
```
…and rebuild from Android Studio.

---

## Build steps — iOS (macOS only)

```bash
npm install
npx cap add ios
npx cap sync ios
npx cap open ios
```

Xcode opens. Pick a Simulator (iPhone 15 etc.) or a real device, hit the
▶ Run button. To submit to TestFlight / App Store, set the Team in
*Signing & Capabilities*, archive (Product → Archive), and use the Organizer.

---

## What about the admin panel on mobile?

It's identical to the web version. After installing, sign in to your
**Test Account** profile from inside the app — the Admin Panel button
appears in the Account screen. You can edit pack and level data on your
phone, and changes hit the same Supabase tables, so they're live for every
player.

The only operation that won't work without your servers is pushing **new**
client code via Supabase — for that you need to rebuild the app. But every
**level/pack edit** uses the override tables and works at runtime.

---

## Things that already work in the WebView

- LocalStorage (account cache, progress, queued uploads)
- IndexedDB-backed Service Worker (offline cache)
- Web Audio API (the bounce / collect sounds)
- `navigator.online` detection + offline indicator
- Supabase JS client over HTTPS
- The custom math keyboard (`inputMode="none"` works fine)
- Android hardware back button (`@capacitor/app`, wired in `app.jsx`) —
  navigates within the app instead of closing it

## Things to plan for v2 (not blocking ship)

- **Haptic vibration on iOS** — `navigator.vibrate` is a no-op on iOS
  WebKit. Haptics were removed project-wide (unreliable in past testing);
  don't re-add without an explicit request. If revisited, it'd be
  `@capacitor/haptics` routed per-platform.
- **Web Push notifications** — already scaffolded in the SW. For native
  push you'd switch to `@capacitor/push-notifications` + FCM/APNs.
- **Reset-password deep link** — for the email link to open the app you'll
  need either:
  1. A custom URL scheme `app.functionplane://auth/reset` registered as
     an Android `<intent-filter>` and an iOS `LSApplicationQueriesSchemes`
     entry, **or**
  2. **App Links / Universal Links** verified via `assetlinks.json` /
     `apple-app-site-association` on a real https domain (recommended).
  Then update the `redirectTo` in the password-reset call and add the
  same URL to Supabase → Authentication → URL Configuration → Redirect URLs.
- **Stripe IAP** — Google Play and Apple require digital-good purchases
  through their billing systems, not Stripe. Replace Stripe Payment Links
  with Google Play Billing (Android) and StoreKit (iOS) when you're ready
  to monetise. Capacitor plugins exist for both.

---

## Troubleshooting

- **"App can't reach Supabase"** — make sure the Supabase project's
  Authentication → URL Configuration → Site URL is `https://localhost`
  for native (Capacitor uses that origin), or add it to the allowed list.
- **Service worker not registering** — Capacitor serves your app from
  `https://localhost`, where SWs are allowed. If you see a registration
  failure, check that the SW path in `index.html` is relative (`./sw.js`),
  not absolute.
- **White screen on launch** — `npx cap sync` again after every change
  to `function-plane/`.
