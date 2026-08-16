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
3. `npm test` — should still print **43 passed**. The app code itself is
   version-agnostic; `app.jsx` already handles both the Capacitor 6 and
   Capacitor 7+ shapes of `addListener`, so nothing in `src/` needs changing.

   > **If `Build parity` fails here** with a list of stale `.js` files, it is
   > almost always a stale `node_modules`, not a real problem with the code.
   > `@babel/core` and `@babel/preset-react` are pinned to an exact version
   > because Babel changed how it escapes non-ASCII between releases, and the
   > committed `.js` are byte-identical to that version's output. An older
   > install — or a `package-lock.json` from before the pin — silently uses a
   > different compiler. Fix it with:
   >
   > ```bash
   > rm -rf node_modules package-lock.json && npm install && npm test
   > ```
   >
   > The parity check prints `info compiling with @babel/core <version>` right
   > above its result. If that version disagrees with the pin in
   > `package.json`, the install is the problem. If it agrees and the check
   > still fails, then a `.jsx` really was edited without rebuilding — run
   > `npm run build:jsx` and commit both files.

> If the Capacitor 8 upgrade turns into a fight, the fallback is to stay on 6
> and hand-edit `android/variables.gradle` to `compileSdkVersion = 36` /
> `targetSdkVersion = 36` after step 1. It usually works, but it is an
> untested combination — prefer the upgrade.

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

   This also produces the 512×512 icon the Console asks for.
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

Do these before any tester creates an account — they are much harder to fix
once real data exists.

9. **Confirm the leaderboard migration is applied (item 11).** In the Supabase
   dashboard → *SQL editor*, run:

    ```sql
    -- columns
    select column_name from information_schema.columns
    where table_name = 'level_scores'
      and column_name in ('best_time','equations','submitted_at');
    -- expect 3 rows

    -- the guard trigger
    select tgname from pg_trigger
    where tgrelid = 'public.level_scores'::regclass and not tgisinternal;
    -- expect: level_scores_guard

    -- RLS on, with four policies
    select relrowsecurity from pg_class where oid = 'public.level_scores'::regclass;
    -- expect: true
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'level_scores';
    -- expect 4: read, insert, update, delete
    ```

    If anything is missing, apply
    `supabase/migrations/20260816_leaderboard_integrity.sql` by pasting it into
    the SQL editor. It is written to be safely re-runnable.

10. **Prove the guard actually rejects nonsense.** Still in the SQL editor:

    ```sql
    insert into public.level_scores (user_id, pack_id, level_index, best_score, stars, best_time)
    values (auth.uid(), 'r-I', 0, 1, 3, 0.01);
    ```

    This must fail with `best_score 1 is below the minimum a winning run can
    produce`. If it succeeds, the trigger is not attached — go back to step 9.
    (Delete the row if it somehow lands.)

11. **Upgrade off the free tier (item 12).** *Settings → Billing* → Pro. A free
    project auto-pauses after ~7 days idle and does not refuse connections, it
    stops answering them — which to a tester looks like the game hanging. This
    is the single most likely way to lose your 14-day streak.

12. **Add the reset-password redirect URL (item 15).** *Authentication → URL
    Configuration → Redirect URLs* → add exactly:

    ```
    https://functionplane.pages.dev/auth/reset
    ```

    Then test it end to end: request a reset from the app, click the emailed
    link, set a new password, sign in with it. `accounts.js` hard-codes this
    URL, so a typo here breaks password recovery silently.

13. **Decide the email-confirmation setting (item 14)** while you are in this
    screen. The app has no "check your inbox" state, so if confirmations are
    **on**, a tester registers and then cannot sign in with no explanation.
    For closed testing, turn confirmations **off** — or accept that you'll be
    fielding that question 15 times.

### 3. Create the signing key (item 21)

14. In Android Studio: **Build → Generate Signed Bundle / APK → Android App
    Bundle → Create new keystore**.
15. Save the keystore file and its passwords somewhere permanent that is **not
    this repository** — a password manager, plus one offline backup.
16. Opt into **Play App Signing** when the Console offers it. It lets Google
    recover your app if the upload key is ever lost. Without it, a lost
    keystore means the app can never be updated again.
17. Build the signed **AAB** (not APK — the Play Store takes bundles).

### 4. Set up the Play Console listing (items 25, 26, 27, 28)

18. Create the app: name **Function Plane**, type **Game**, category
    **Puzzle**, free.
19. Fill in the store listing. The copy is drafted in
    [`store-assets/LISTING.md`](./store-assets/LISTING.md) — title, short
    description and full description, all inside Google's character limits.
    The assets are next to it:
    - `store-assets/feature-graphic-1024x500.png`
    - `store-assets/screenshots/` — eight real 1080×1920 captures; upload 4–6.
    - the 512×512 icon from step 7.
20. Add the privacy policy URL:
    `https://functionplane.pages.dev/privacy.html`
21. Complete the **content rating** questionnaire — answers in `LISTING.md`.
22. Complete the **Data safety** form — the exact per-field answers are in
    `LISTING.md`. The account-deletion URL it asks for is
    `https://functionplane.pages.dev/delete-account.html`, so **deploy
    `legal/delete-account.html` to the website before you fill this in**
    (item 19). Google checks that the URL resolves.
23. Complete the **Government apps**, **Financial features**, **Ads** (answer:
    no ads) and **Target audience** (13+) declarations.

### 5. Release to closed testing

24. **Testing → Closed testing → Create track.**
25. Create an email list of your testers, or a Google Group. Add all ~15
    addresses.
26. Upload the AAB, add a short release note (one is drafted at the bottom of
    `LISTING.md`), and roll out to the track.
27. Copy the opt-in link and send it to your testers.

### 6. Get the testers actually opted in

28. Each tester must open the opt-in link, accept, **then** install from the
    Play Store link on that page. Installing the APK directly does not count.
29. Verify the opted-in count in the Console reads **at least 12**. This is the
    number the 14 days are measured against — the day it drops below 12, the
    clock stops.
30. Tell your testers plainly: do not uninstall for 14 days, and expect
    frequent updates.

### 7. During the 14 days

31. Keep uploading. Increment `versionCode` every time, `npx cap sync android`,
    rebuild the signed AAB, upload to the same closed track. Testers update
    automatically.
32. Work through the rest of `RELEASE-CHECKLIST.md` — the content items (1–4)
    are the long pole and should get most of this window.
33. Collect feedback in one place. The Console's feedback channel is weak;
    a shared doc or a chat group is better.
34. Watch **Android vitals** in the Console for crashes and ANRs on real
    hardware. This is your only crash visibility until item 30 lands.

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
