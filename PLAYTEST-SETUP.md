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
| 11 | Confirm the leaderboard migration is applied | Testers create real accounts and real scores; the guard should be live before that data exists. |
| 12 | Upgrade off the Supabase free tier | The project pausing mid-test looks like a broken game to 12 people at once. |
| 15 | Add the reset-password redirect URL | A tester who forgets their password is stuck otherwise. |
| 20 | Generate the Android project | Nothing to upload without it. |
| 21 | Create and back up the signing keystore | The first upload locks the app to this key permanently. |
| 22 | Generate app icons and splash | A default Capacitor icon on 15 phones is avoidable. |
| 23 | Set the version scheme | Every upload after the first is rejected without an increasing `versionCode`. |
| 24 | Confirm the target API level | An upload below Google's floor is rejected outright. |
| 27 | Complete the Data safety form | Required before any track, including closed, can be released. |
| 28 | Complete the content rating questionnaire | Same. |
| 19 | Add a web account-deletion page | Required for any app with accounts; easier to do now than during production review. |

**Deliberately not blockers:** items 1–4 (content), 5–10 (payments), 17–18
(website copy), 25–26 (listing text and screenshots — closed testing needs
only minimal listing details), 29–32 (polish). All of that can land during the
14 days.

If you're shipping v1 without premium, decide item 10 now — it removes items
5–9 entirely.

---

## Step by step

### 1. Prepare the build

1. Pull the latest `main` and run `npm install` on your own machine (it fails
   in sandboxes, not on a real one).
2. `npx cap add android` — creates the `android/` folder.
3. `npx cap sync android`.
4. Generate the icons and splash from `assets/icon.png` and
   `assets/splash.png`.
5. Open `android/app/build.gradle` and confirm `targetSdkVersion` meets
   Google's current requirement. Set `versionCode 1` and `versionName "1.0"`.

### 2. Create the signing key

6. In Android Studio: **Build → Generate Signed Bundle / APK → Android App
   Bundle → Create new keystore**.
7. Save the keystore file and its passwords somewhere permanent that is **not
   this repository** — a password manager, plus one offline backup.
8. Opt into **Play App Signing** when the Console offers it. It lets Google
   recover your app if the upload key is ever lost. Without it, a lost
   keystore means the app can never be updated again.
9. Build the signed **AAB** (not APK — the Play Store takes bundles).

### 3. Set up the Play Console listing

10. Create the app: name **Function Plane**, type **Game**, category
    **Puzzle** or **Educational**, free.
11. Fill in the minimum store listing: short description, full description,
    app icon (512×512), and a feature graphic (1024×500). Closed testing does
    not need polished screenshots — you can improve all of this later.
12. Add the privacy policy URL: `https://functionplane.pages.dev/privacy.html`
13. Complete the **content rating** questionnaire.
14. Complete the **Data safety** form. The accurate answers: you collect email
    address and gameplay progress, data is encrypted in transit, users can
    request deletion, and there is **no** data sharing with third parties, no
    advertising ID, no analytics, no ads.
15. Complete the **Government apps**, **Financial features**, **Ads** (answer:
    no ads) and **Target audience** declarations.

### 4. Release to closed testing

16. **Testing → Closed testing → Create track.**
17. Create an email list of your testers, or a Google Group. Add all ~15
    addresses.
18. Upload the AAB, add a short release note, and roll out to the track.
19. Copy the opt-in link and send it to your testers.

### 5. Get the testers actually opted in

20. Each tester must open the opt-in link, accept, **then** install from the
    Play Store link on that page. Installing the APK directly does not count.
21. Verify the opted-in count in the Console reads **at least 12**. This is the
    number the 14 days are measured against — the day it drops below 12, the
    clock stops.
22. Tell your testers plainly: do not uninstall for 14 days, and expect
    frequent updates.

### 6. During the 14 days

23. Keep uploading. Increment `versionCode` every time, `npx cap sync android`,
    rebuild the signed AAB, upload to the same closed track. Testers update
    automatically.
24. Work through the rest of `RELEASE-CHECKLIST.md` — the content items (1–4)
    are the long pole and should get most of this window.
25. Collect feedback in one place. The Console's feedback channel is weak;
    a shared doc or a chat group is better.
26. Watch **Android vitals** in the Console for crashes and ANRs on real
    hardware.

### 7. Going public

27. After 14 continuous days at 12+ testers, apply for **production access** in
    the Console. It's a short questionnaire about how the testing went.
28. Finish everything remaining in `RELEASE-CHECKLIST.md`, especially items 1–4
    (content), 16 (reset test data) and 26 (real screenshots).
29. Promote the build from closed testing to **production**.
30. Expect the first production review to take days rather than hours;
    subsequent updates are much faster.
31. Use a **staged rollout** — start around 20%, watch vitals, then widen.

---

## Two things that will bite you later

- **Payments.** A Stripe checkout inside the Play build is an anti-steering
  violation and a genuine rejection risk. Either finish items 5–9 before
  production, or hide premium in the Play build (item 10). This does not
  affect closed testing.
- **The keystore.** Nothing in this list is irreversible except losing it.
  Back it up before step 9, not after.
