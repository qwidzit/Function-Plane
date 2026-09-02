# Copy-paste command sheet

Every command you need between "the code changed" and "the bundle is uploaded",
written for **Windows** (Command Prompt or PowerShell), which is what this
project's Android build was set up on. Run them from the project folder — the
one containing `package.json` — unless a step says otherwise.

Nothing here is destructive except where it says so.

---

## A. Rebuild the bundle after pulling changes

Four commands. The third one is the actual build and takes a few minutes the
first time.

```bat
git pull origin main
npm test
npx cap sync android
cd android && gradlew bundleRelease
```

What each one is for:

- `git pull` — brings down the latest committed code.
- `npm test` — about a second, zero dependencies. If it fails, stop: something
  is wrong that a build will not tell you about.
- `npx cap sync android` — copies `function-plane/` into the Android project.
  **Skipping this is the classic mistake**: Gradle would happily build a
  bundle from the previous copy of the web app, and you would upload a build
  that does not contain your change.
- `gradlew bundleRelease` — compiles and signs the release bundle.

The file you upload appears at:

```
android\app\build\outputs\bundle\release\app-release.aab
```

Not `android\app\release\` (that is where Android Studio's wizard puts things),
and not anything under `build\intermediates\` (unsigned scratch files).

To get back to the project root afterwards:

```bat
cd ..
```

## B. Check the bundle really is signed

Do this before every upload. An unsigned bundle is rejected at upload with a
message that does not explain itself.

**Run this from the project root.** Section A leaves you inside `android`, so
`cd ..` first — otherwise the relative path resolves to `android\android\...`
and keytool reports `NoSuchFileException`, which looks like a build failure and
is not one.

```bat
"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -printcert -jarfile android\app\build\outputs\bundle\release\app-release.aab
```

From inside `android`, drop the leading `android\` from the path. Either way,
`dir` the folder first if you are unsure the bundle exists at all — an empty or
missing `app\build\outputs\bundle\release` means `gradlew bundleRelease`
never finished with `BUILD SUCCESSFUL`.

It prints a certificate with a SHA256 fingerprint. That fingerprint must match
the one in your keystore, which you can print with:

```bat
"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "%USERPROFILE%\function-plane-upload.jks" -alias function-plane
```

It asks for the keystore password. The two SHA256 values must be identical. If
`-printcert` says the file is unsigned, `android\keystore.properties` is
missing or its paths and passwords are wrong — see section F.

## C. Put the build on your own phone first

A `.aab` cannot be installed directly on a phone; it is a format for Google, not
for devices. Build an APK for testing instead:

```bat
cd android && gradlew assembleRelease && cd ..
```

That produces:

```
android\app\build\outputs\apk\release\app-release.apk
```

Two ways to get it onto the phone:

**The simple way.** Copy the `.apk` to the phone (USB, Drive, email it to
yourself), tap it in the phone's file manager, and allow "install unknown apps"
when prompted.

**Over USB with adb.** On the phone: Settings → About phone → tap *Build
number* seven times to unlock Developer options, then Developer options →
enable *USB debugging*. Plug it in, accept the prompt on the phone, then:

```bat
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" devices
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" install -r android\app\build\outputs\apk\release\app-release.apk
```

`devices` should list one device before you try to install. If it says
`unauthorized`, look at the phone screen and accept the debugging prompt.

If the install fails with `INSTALL_FAILED_UPDATE_INCOMPATIBLE`, an older copy
signed with a different key is on the phone. Remove it first — **this deletes
that copy's local progress**:

```bat
"%LOCALAPPDATA%\Android\Sdk\platform-tools\adb.exe" uninstall app.functionplane
```

## D. Back up the signing keystore

**This is the one irreversible thing in the whole project.** The keystore is
what proves a future update comes from you. Lose it and you can never update
`app.functionplane` again — not by you, not by Google, not by anyone. There is
no appeal, and the only remedy is publishing a different app under a different
package name and losing every install and review.

The file lives outside the repository, by default at:

```
%USERPROFILE%\function-plane-upload.jks
```

To see exactly where Gradle thinks it is, open `android\keystore.properties`
and read the `storeFile` line. That file also holds the passwords in plain
text; it is gitignored and must stay that way.

Print the full path so you can find it in Explorer:

```bat
echo %USERPROFILE%\function-plane-upload.jks
```

Then, right now, do all three:

1. Copy the `.jks` file to a USB stick or an external drive kept somewhere
   other than this machine.
2. Copy it to a cloud drive you actually keep paying for.
3. Save the keystore password, the key alias (`function-plane`) and the file
   itself into a password manager — most of them accept file attachments.

Verify a backup is real before trusting it. Point `-list` at the copied file;
if it prints the certificate, the copy is good:

```bat
"C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe" -list -v -keystore "E:\backup\function-plane-upload.jks" -alias function-plane
```

Also accept **Play App Signing** when the Console offers it on your first
upload. It lets Google re-issue the app signing key if the upload key is ever
lost, which turns a catastrophe into an inconvenience. It does not remove the
need for these backups.

## D2. If `android/` was ever regenerated

`cap add android` rewrites `app\build.gradle` and wipes the signing block out
of it, which produces an *unsigned* bundle that only fails at upload. A missing
`local.properties` is often the first sign that the folder is not the one you
originally set up. Check both:

```bat
dir keystore.properties
findstr /i "signingConfigs keystore" app\build.gradle
```

`keystore.properties` must exist, and the `findstr` must print something. If
either comes back empty, restore the signing config before building anything
you intend to upload, and confirm with the `-printcert` check in section B.

## E. Every build after the first

Play rejects any bundle whose `versionCode` it has seen before, **including
uploads you later discarded**. So each build gets a new number.

Before rebuilding, edit `android\app\build.gradle` and raise `versionCode` by
one (`1` → `2` → `3`...). It is an integer and it only ever goes up.

If the human-facing version changes too (1.0 → 1.1), edit all four places
together, or the app will display a version it is not:

| File | What to change |
|---|---|
| `android\app\build.gradle` | `versionCode` and `versionName` |
| `function-plane\src\main-screen.jsx` line 140 | the `v 1.0 · build 1` text |
| `function-plane\src\main-screen.js` | the same text in the compiled file |
| `function-plane\src\settings-screen.jsx` line 92 | the `v 1.0 · build 1` text |
| `function-plane\src\settings-screen.js` | the same text in the compiled file |

`npm test` checks the two on-screen strings agree with each other, but nothing
checks them against `build.gradle` — that part is on you.

Then rebuild exactly as in section A.

## F. When something goes wrong

| Message | What it means | Fix |
|---|---|---|
| `'gradlew' is not recognized` | You are not in the `android` folder | `cd android` first; the file is `android\gradlew.bat` |
| `keytool error: NoSuchFileException` on the `.aab` | Wrong folder — the paths in section A run from `android`, the one in section B from the project root | `cd ..` before the keytool command, or drop the leading `android\` from the path |
| `'npx' is not recognized` | Node.js is not installed or not on PATH | Install Node.js LTS, then reopen the terminal |
| `JAVA_HOME is not set` / `Unsupported class file major version` | Gradle cannot find a JDK, or found the wrong one | `set JAVA_HOME=C:\Program Files\Android\Android Studio\jbr` in that terminal, then rerun |
| `SDK location not found` / `Define a valid SDK location` | `android\local.properties` is missing — it is machine-specific and gitignored, so it never arrives with the repo | From `android`, run `echo sdk.dir=C\:\\Users\\<you>\\AppData\\Local\\Android\\Sdk> local.properties` (double every backslash; the path is in Android Studio → More Actions → SDK Manager) |
| Build succeeds but the app looks unchanged | `npx cap sync android` was skipped | Run section A in full |
| `-printcert` says the bundle is unsigned | `android\keystore.properties` is missing or wrong | Check its four lines: `storeFile`, `storePassword`, `keyAlias`, `keyPassword` |
| `keytool` says "keystore password was incorrect" | PKCS12 keystores use one password for both store and key | Try the store password for both prompts |
| Console: "Version code 1 has already been used" | That integer was uploaded before, even in a discarded release | Raise `versionCode` and rebuild (section E) |
| Console: "Your app targets an old version of Android" | `android/` was regenerated from an older Capacitor | Do not regenerate it; `variables.gradle` must read `targetSdkVersion = 36` |
| Testers cannot find the app | They installed without opting in, or are in a country the track excludes | They must open the opt-in link, accept, then install from the Play link on that page |

## G. What is not in this file

Working on the game itself — editing `.jsx`, rebuilding the compiled `.js`,
bumping the service-worker cache — is in [`CLAUDE.md`](./CLAUDE.md). The
Console click paths are in
[`PLAYTEST-SETUP.md`](./PLAYTEST-SETUP.md), and the answers to every Console
form are in
[`store-assets/CONSOLE-SETUP.md`](./store-assets/CONSOLE-SETUP.md).
