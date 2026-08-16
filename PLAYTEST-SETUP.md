# Starting closed testing

Every step here is yours — none of it can be done from the repo. Follow it in
order.

Read this first: **closed testing is not a finished-game gate.** Google
requires 12 testers opted in for 14 continuous days before a new personal
developer account can publish publicly. The clock runs on the testers, not on
you, and **uploading new builds during it does not reset anything**. So the
whole point is to start this while the game is still unfinished — the 14 days
then run in parallel with authoring levels instead of after it.

The one thing that *does* reset the clock is your opted-in tester count
dropping below 12. Recruit ~15 for margin.

---

## What must be finished first

Only these, from [`RELEASE-CHECKLIST.md`](./RELEASE-CHECKLIST.md):

| # | Item | Why it blocks |
|---|---|---|
| 24 | Confirm the target API level | **Do this one first — see the warning below.** An upload below Google's floor is rejected outright, and the fix is far cheaper before `android/` exists. |
| 11 | Confirm the leaderboard migration is applied | Testers create real accounts and real scores; the guard should be live before that data exists. |
| 12 | Upgrade off the Supabase free tier | The project pausing mid-test looks like a broken game to 12 people at once. |
| 15 | Add the reset-password redirect URL | A tester who forgets their password is stuck otherwise. |
| 20 | Generate the Android project | Nothing to upload without it. |
| 21 | Create and back up the signing keystore | The first upload locks the app to this key permanently. |
| 22 | Generate app icons and splash | A default Capacitor icon on 15 phones is avoidable. |
| 23 | Set the version scheme | Every upload after the first is rejected without an increasing `versionCode`. |
| 27 | Complete the Data safety form | Required before any track, including closed, can be released. |
| 28 | Complete the content rating questionnaire | Same. |
| 19 | Add a web account-deletion page | Required for any app with accounts. **The page is written** (`legal/delete-account.html`) — it just needs deploying with the rest of the website. |

**Deliberately not blockers:** items 1–4 (content), 5–10 (payments), 17–18
(website copy), 25–26 (listing text and screenshots — both drafted for you in
`store-assets/`), 29–32 (polish). All of that can land during the 14 days.

If you're shipping v1 without premium, decide item 10 now — it removes items
5–9 entirely.

---

> [!WARNING]
> **The target API level is a hard blocker and it has a deadline.**
>
> `package.json` pins **Capacitor 6**, which generates an Android project
> targeting **API 34**. Google's floor for a new app is already **API 35**, and
> from **31 August 2026** every new app and every update must target **API 36**
> (Android 16). An AAB below the floor is rejected at upload — you never get to
> the review stage.
>
> Fix it in step 0 below, *before* running `cap add android`. There is no
> `android/` folder yet, so upgrading now costs one `npm install`; doing it
> after means migrating a generated native project by hand.

---

## How to read this guide

Step numbers never change, so you can stop and come back. Each step says
**where** you are (a terminal, Android Studio, a website) before it says what to
do.

Two conventions:

- `Menu → Submenu → Button` is a click path.
- Anything in a grey box is meant to be copied exactly.

**Opening a terminal in the project folder** (needed for every terminal step):
open the `Function-Plane` folder in File Explorer, click the address bar, type
`cmd`, press Enter. A black window opens already pointed at the right folder.
If a command says "not recognized", you are almost certainly in the wrong
folder — run `dir` and check you can see `package.json`.

---

## Step by step

### 0. Raise the target API level (item 24)

1. Pull the latest `main` and run `npm install` on your own machine (it fails
   in sandboxes, not on a real one).
2. Upgrade Capacitor to 8, which targets API 36:

   ```bash
   npm install @capacitor/core@^8 @capacitor/cli@^8 @capacitor/android@^8 @capacitor/app@^8
   npm install -D @capacitor/assets@latest
   ```

   Capacitor 8 needs **JDK 21** and a recent Android Studio. If `npx cap` then
   complains about the Java version, install JDK 21 and point Android Studio at
   it (*Settings → Build Tools → Gradle → Gradle JDK*).
3. **Run the test suite.** In a terminal in the project folder:

   ```bash
   npm test
   ```

   It takes about a second. The last two lines should read:

   ```
   ────────────────────────────────────────────────────────────
   43 passed
   ```

   That is the whole check — no browser, no build, nothing to click. If it says
   `43 passed`, move on to step 4.

   > **If `Build parity` fails** with a list of stale `.js` files, it is almost
   > always a stale `node_modules`, not a real problem with the code.
   > `@babel/core` and `@babel/preset-react` are pinned to an exact version
   > because Babel changed how it escapes non-ASCII between releases, and the
   > committed `.js` are byte-identical to that version's output. An older
   > install — or a `package-lock.json` from before the pin — silently uses a
   > different compiler. Fix it with:
   >
   > ```bash
   > # macOS / Linux / Git Bash
   > rm -rf node_modules package-lock.json && npm install && npm test
   > ```
   >
   > ```powershell
   > # Windows PowerShell
   > Remove-Item -Recurse -Force node_modules, package-lock.json -ErrorAction SilentlyContinue
   > npm install
   > npm test
   > ```
   >
   > ```bat
   > :: Windows cmd.exe
   > rmdir /s /q node_modules
   > del /q package-lock.json
   > npm install && npm test
   > ```
   >
   > "Cannot find the path" from the delete just means it was not there —
   > ignore it.
   >
   > The parity check prints `info compiling with @babel/core <version>` right
   > above its result. If that version disagrees with the pin in
   > `package.json`, the install is the problem. If it agrees and the check
   > still fails, then a `.jsx` really was edited without rebuilding — run
   > `npm run build:jsx` and commit both files.
   >
   > **On Windows, check line endings too.** Babel writes LF; Git's default
   > `core.autocrlf=true` rewrites the committed `.js` to CRLF on checkout,
   > which fails the byte comparison. `.gitattributes` now pins LF, but a
   > working tree checked out before that still has CRLF in it. To re-fetch
   > every file through the new rules (this discards uncommitted changes):
   >
   > ```bash
   > git rm --cached -r . -q
   > git reset --hard
   > ```

### 1. Prepare the build (items 20, 22, 23)

4. `npx cap add android` — creates the `android/` folder.
5. `npx cap sync android`.
6. **Verify the SDK levels actually landed.** Open `android/variables.gradle`
   and confirm:

   ```gradle
   minSdkVersion = 24
   compileSdkVersion = 36
   targetSdkVersion = 36
   ```

   If it still says 34, step 0 didn't take. Stop and fix it now — everything
   downstream is wasted otherwise.
7. Generate the icons and splash from the source art already in `assets/`:

   ```bash
   npx @capacitor/assets generate --android
   ```

   This writes the launcher icons and splash screens into `android/`. It does
   not reliably produce the separate 512×512 PNG the Console asks for, so make
   that one yourself in step 19.
8. Set the version scheme in `android/app/build.gradle`:

   ```gradle
   versionCode 1
   versionName "1.0"
   ```

   **`versionCode` must increase on every single upload, forever** — it is an
   integer, and Play rejects a re-used one. `versionName` is the human string
   and can repeat. The simplest durable rule: bump `versionCode` by one every
   time you upload anything, even a build you end up discarding.

   The app also prints `v 1.0 · build 1` on the main screen and in Settings
   (`main-screen.jsx`, `settings-screen.jsx`, kept in sync by `npm test`).
   Update both when `versionName` changes so a tester's bug report names the
   build you think it does.

### 2. Get the backend ready (items 11, 12, 15)

**Where you are:** the Supabase dashboard in a browser, signed in with the
account that owns the project. Your project is `miuxqxllxjvxddolpzno` (it is
in `src/supabase-config.js`, and it is public — not a secret). Every link
below goes straight to the right page.

Do all of this **before any tester creates an account**. It is much harder to
fix once real data exists.

9. **Confirm the leaderboard migration is applied (item 11).**

   Open the SQL editor:
   <https://supabase.com/dashboard/project/miuxqxllxjvxddolpzno/sql/new>

   You get a big empty text box with a **Run** button (bottom right, or press
   Ctrl+Enter). Paste the block below, press Run, and read the table that
   appears underneath.

   ```sql
   select column_name from information_schema.columns
   where table_name = 'level_scores'
     and column_name in ('best_time','equations','submitted_at');
   ```

   **Expected: 3 rows** — `best_time`, `equations`, `submitted_at`. Clear the
   box and run each of the next three the same way.

   ```sql
   select tgname from pg_trigger
   where tgrelid = 'public.level_scores'::regclass and not tgisinternal;
   ```

   **Expected: 1 row reading `level_scores_guard`.**

   ```sql
   select relrowsecurity from pg_class where oid = 'public.level_scores'::regclass;
   ```

   **Expected: 1 row reading `true`.** (If it says `false`, row-level security
   is off and anyone could rewrite anyone's scores.)

   ```sql
   select policyname from pg_policies
   where schemaname = 'public' and tablename = 'level_scores';
   ```

   **Expected: 4 rows**, one each for read, insert, update and delete.

   **If any of those came back short**, the migration has not been applied.
   Fix it: open `supabase/migrations/20260816_leaderboard_integrity.sql` from
   this repo in any text editor, select all, copy, paste the whole thing into
   the SQL editor, and Run. It is written to be safe to run more than once, so
   you cannot break anything by running it twice. Then repeat the four checks
   above.

10. **Prove the guard actually rejects nonsense.**

    This one is backwards from every other step: **a red error message means it
    worked.** You are deliberately trying to insert an impossible score to
    confirm the database refuses it.

    Still in the SQL editor, run:

    ```sql
    insert into public.level_scores (user_id, pack_id, level_index, best_score, stars, best_time)
    values (auth.uid(), 'r-I', 0, 1, 3, 0.01);
    ```

    **Expected: a red error box** saying
    `best_score 1 is below the minimum a winning run can produce`.
    That is success — the guard is live. Move on.

    **If instead it says "Success. No rows returned"**, the trigger is not
    attached. Go back to step 9 and apply the migration, then delete the junk
    row it just let through:

    ```sql
    delete from public.level_scores where best_score = 1 and level_index = 0;
    ```

11. **Upgrade off the free tier (item 12).**

    Go to
    <https://supabase.com/dashboard/project/miuxqxllxjvxddolpzno/settings/billing>
    and move the project onto a paid plan (Pro is around $25/month; check the
    current price on the page).

    Why this is a blocker and not a nicety: a free project **pauses itself
    after about 7 days of inactivity**. A paused project does not refuse
    connections, it simply stops answering them — so the game does not show an
    error, it hangs. If that happens mid-test, 12 people see a broken app on
    the same day, and restoring it is a manual click you might not make for
    hours. This is the single most likely way to lose your 14-day streak.

12. **Add the reset-password redirect URL (item 15).**

    Go to
    <https://supabase.com/dashboard/project/miuxqxllxjvxddolpzno/auth/url-configuration>

    Find the **Redirect URLs** section, click **Add URL**, and paste exactly:

    ```
    https://functionplane.pages.dev/auth/reset
    ```

    Click Save. No trailing slash, no typos — `accounts.js` hard-codes this
    exact string, and a mismatch makes password recovery fail silently.

    **Then test it end to end**, because "it looks right" is not evidence:
    open the app, sign out, tap *Forgot password*, enter an address you can
    actually read email at, click the link in the email, set a new password,
    and sign in with it. If the link lands on an error page, the URL above does
    not match what is in the Redirect URLs list.

13. **Decide the email-confirmation setting (item 14).**

    Go to
    <https://supabase.com/dashboard/project/miuxqxllxjvxddolpzno/auth/providers>,
    expand **Email**, and look for **Confirm email**.

    The app has no "check your inbox" screen. So if this is **on**, a tester
    registers, sees nothing happen, tries to sign in, and is told their
    credentials are wrong — with no hint that an unopened email is the reason.

    **For closed testing, turn it off.** Click Save. (Turning it back on before
    public launch is a reasonable choice, but then the app needs that missing
    screen first.)

### 3. Create the signing key (item 21)

**Where you are:** Android Studio, on your own machine.

**Opening the project the right way.** From a terminal in the project folder:

```bash
npx cap open android
```

That launches Android Studio pointed at the `android/` folder. If you would
rather do it by hand: Android Studio → **File → Open** → select the `android`
folder *inside* `Function-Plane` (not `Function-Plane` itself — opening the
wrong folder is the most common way to get a project that will not build).

The first time, a progress bar at the bottom reads *Gradle sync* and can take
several minutes on a cold cache. **Wait for it to finish** before touching any
menu; most "the menu item is greyed out" problems are just an unfinished sync.

14. **Build → Generate Signed App Bundle / APK** (older versions say *Generate
    Signed Bundle / APK*). Choose **Android App Bundle**, then **Next**, then
    **Create new…** under the key store field.
15. Fill in the keystore dialog: pick a path, set a password, set a key alias
    and key password, fill in at least first/last name and country. Then save
    **the keystore file and both passwords** somewhere permanent that is **not
    this repository** — a password manager, plus one offline backup (a USB
    stick or a printed copy in a drawer both count).
16. Opt into **Play App Signing** when the Console offers it on your first
    upload. It lets Google re-issue your app signing key if the upload key is
    ever lost. Without it, a lost keystore means the app **can never be updated
    again** — not by you, not by Google, not by anyone. There is no appeal
    process for this.
17. Finish the wizard, choose the **release** build variant, and click
    **Create**. When it completes, Android Studio shows a notification with a
    **locate** link; the file is at:

    ```
    android/app/release/app-release.aab
    ```

    That `.aab` is what you upload. If you only see `.apk` files, you picked
    APK instead of Android App Bundle — run the wizard again.

### 4. Set up the Play Console listing (items 25, 26, 27, 28)

**Where you are:** <https://play.google.com/console>, signed in with your
developer account (the one you paid the $25 registration fee on).

**The single most useful thing to know:** after you create the app, the
**Dashboard** page shows a task list called *Set up your app*. It lists every
declaration Google requires, with a tick as you finish each. Working down that
list is more reliable than following any written guide, including this one,
because it reflects what your account actually needs today. Use the steps below
as explanation for the tasks on that list rather than as a replacement for it.

Menu labels move between Console redesigns. If you cannot find something, the
search box at the top of the Console finds pages by name.

18. **Create the app.** *All apps → Create app*. Fill in:

    | Field | Value |
    |---|---|
    | App name | `Function Plane` |
    | Default language | English (or your preference) |
    | App or game | **Game** |
    | Free or paid | **Free** — this cannot be changed to paid later |

    Tick the two declarations at the bottom and click **Create app**.

19. **Fill in the store listing.** Left menu → **Grow** (or *Grow users*) →
    **Store presence → Main store listing**.

    All the text is written for you in
    [`store-assets/LISTING.md`](./store-assets/LISTING.md) — copy the app name,
    short description and full description straight out of it. Then upload:

    | Asset | Where it is | Notes |
    |---|---|---|
    | App icon, 512×512 PNG | resize `assets/icon.png` to exactly 512×512 in any image editor | required; must be PNG, no transparency |
    | Feature graphic, 1024×500 PNG | `store-assets/feature-graphic-1024x500.png` | required |
    | Phone screenshots | `store-assets/screenshots/` | minimum 2, upload 4–6 |

    Suggested screenshot picks: `01-main`, `05-run`, `04-level`, `03-levels`,
    `06-howtoplay`, `08-sandbox`. **Save** at the bottom.

20. **Add the privacy policy URL.** Left menu → **Policy** (some accounts show
    *Policy and programs*) → **App content** → *Privacy policy* → **Start**.

    ```
    https://functionplane.pages.dev/privacy.html
    ```

    Google fetches this URL, so it must already be live. Save.

21. **Content rating.** Same **App content** page → *Content rating* →
    **Start**. Enter your email, choose category **Game**, then answer the
    questionnaire. Every substantive answer is **No** — the exact walkthrough,
    including the two questions that need care, is in `LISTING.md`. Submit at
    the end; the rating is issued immediately.

22. **Data safety.** Same **App content** page → *Data safety* → **Start**.

    This is the longest form and the easiest to get wrong. `LISTING.md` has the
    complete per-field answers — work through it with that file open beside
    you. The shape of it:

    - You **do** collect data → *Yes*.
    - Data **is** encrypted in transit → *Yes*.
    - Users **can** request deletion → *Yes*, and the URL it asks for is
      `https://functionplane.pages.dev/delete-account.html`.
    - Three data types are collected, none shared: **email address**, **user
      IDs** (the display name), and **in-app actions** (level progress).
    - Everything else — location, photos, contacts, advertising ID, crash logs
      — is **not collected**.

    > **Deploy `legal/delete-account.html` to the website before you submit
    > this form.** Google checks that the deletion URL resolves, and a 404 here
    > is a rejection.

23. **The remaining declarations.** Still on **App content**, work down whatever
    the page still shows as incomplete: *Ads* (answer **No ads**), *Target
    audience and content* (**13 and over** — do not tick any younger band, the
    privacy policy sets 13 as the floor), *News apps* (No), *Government apps*
    (No), *Financial features* (None), *Health apps* (No), *Data deletion*
    (already covered above).

    Keep going until the *Set up your app* task list on the Dashboard is fully
    ticked. Google will not let you release to **any** track, closed included,
    while something on it is outstanding.

### 5. Release to closed testing

24. **Open the closed testing track.** Left menu → **Test and release** →
    **Testing → Closed testing**.

    There is usually already a track there called **Alpha**. Use it — click
    **Manage track**. There is no benefit to creating a second one for your
    first release. (If the list is empty, click **Create track** and name it
    anything.)

25. **Add your testers.** Inside the track, open the **Testers** tab →
    **Create email list**. Give it a name, paste in all ~15 tester email
    addresses (one per line, or comma-separated), and save. Tick the list so it
    is attached to this track.

    The addresses must be the **Google accounts** your testers use on their
    phones. A work address that is not a Google account will silently never
    receive access.

26. **Upload the build.** Back on the track, click **Create new release**.

    - If prompted about **Play App Signing**, accept it (see step 16).
    - Drag `android/app/release/app-release.aab` into the upload box, or click
      **Upload** and browse to it.
    - **Release name** is filled in automatically from the version — leave it.
    - **Release notes** go in the box below. A draft is at the bottom of
      `LISTING.md`; one honest sentence beats changelog boilerplate.
    - Check the **countries/regions** for the track include everywhere your
      testers actually live, or they will not see the app.

    Then **Next** → review the warnings page → **Save and publish** (labelled
    *Start rollout to Closed testing* on some accounts). Confirm.

    Google reviews closed-testing releases too, usually within about 24 hours.
    The track shows *In review* until then; this is normal and nothing is
    wrong.

27. **Send out the opt-in link.** Once the release is live, go to the
    **Testers** tab and copy the link under **How testers join your test** (it
    looks like `https://play.google.com/apps/testing/app.functionplane`).
    Send that to all ~15 testers.

### 6. Get the testers actually opted in

28. Each tester must open the opt-in link, accept, **then** install from the
    Play Store link on that page. Installing the APK directly does not count.
29. Verify the opted-in count in the Console reads **at least 12**. This is the
    number the 14 days are measured against — the day it drops below 12, the
    clock stops.
30. Tell your testers plainly: do not uninstall for 14 days, and expect
    frequent updates.

### 7. During the 14 days

31. Keep uploading. The loop each time:

    ```bash
    # 1. bump versionCode in android/app/build.gradle first
    npx cap sync android
    ```

    then Android Studio → *Build → Generate Signed App Bundle / APK* → choose
    the **existing** keystore this time → upload the new `.aab` to the same
    closed track. Testers update automatically.

32. Work through the rest of `RELEASE-CHECKLIST.md` — the content items (1–4)
    are the long pole and should get most of this window.
33. Collect feedback in one place. The Console's feedback channel is weak;
    a shared doc or a chat group is better.
34. Watch **Android vitals** (left menu → *Quality*) for crashes and ANRs on
    real hardware. This is your only crash visibility until item 30 lands.

### 8. Going public

35. After 14 continuous days at 12+ testers, apply for **production access** in
    the Console. It's a short questionnaire about how the testing went.
36. Finish everything remaining in `RELEASE-CHECKLIST.md`, especially items 1–4
    (content), 16 (reset test data) and 26 (re-capture screenshots once the
    real levels exist).
37. Promote the build from closed testing to **production**.
38. Expect the first production review to take days rather than hours;
    subsequent updates are much faster.
39. Use a **staged rollout** — start around 20%, watch vitals, then widen.

---

## Three things that will bite you later

- **The target API deadline.** 31 August 2026 for API 36. If your first upload
  lands before then at API 35 you are fine for that build, but every update
  after the deadline needs 36 — so just go to 36 now (step 0).
- **Payments.** A Stripe checkout inside the Play build is an anti-steering
  violation and a genuine rejection risk. The app now refuses to open one when
  it detects a native build (`FP_PAY_CHANNEL` in `src/store-config.js`), so
  closed testing is safe. Before production, either finish items 5–9 or leave
  premium hidden (item 10).
- **The keystore.** Nothing in this list is irreversible except losing it.
  Back it up before step 17, not after.
