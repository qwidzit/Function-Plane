// Function Plane — Privacy / Terms / Open-source license screens
//
// The text below is intended for an English-language Google Play release. It
// is structured to satisfy the Google Play Developer Program Policies, the
// Play Console "Data safety" form, and the most common consumer-facing legal
// requirements (GDPR, CCPA, COPPA basics). Bracketed placeholders must be
// filled in before launch, and the policy MUST also be hosted at a public URL
// (Google requires this — an in-app screen alone is not sufficient).
//
// IMPORTANT: this is a starting template, not legal advice. Have a lawyer
// review before you publish, especially if you want to ship to children
// under 13 or in regulated regions (EU, UK, California, Brazil).

const LEGAL_PUBLISHER = 'Nikolay Yaremko';
const LEGAL_JURIS = 'the Netherlands';
const LEGAL_EMAIL = 'functionplane.support@gmail.com';
const LEGAL_WEBSITE = 'https://functionplane.pages.dev'; // public site (privacy/terms hosted here)
const LEGAL_EFFECTIVE = '4 May 2026';
const APP_NAME = 'Function Plane';

// ── Privacy Policy ────────────────────────────────────────────────────────

const PRIVACY_TEXT = `# Privacy Policy

**Effective date:** ${LEGAL_EFFECTIVE}

This Privacy Policy describes how ${LEGAL_PUBLISHER} ("we", "us") collects, uses,
and shares information about you when you use the ${APP_NAME} mobile application
and related services (the "Service").

## 1. Information we collect

**Account information you provide.** When you create an account we collect your
display name, email address, and password. Passwords are never stored in
plaintext — they are salted and hashed by our authentication provider.

**Gameplay data.** We store your level progress (stars earned, best score, best
time per level) so it can sync between your devices and appear on global
leaderboards.

**Device information.** Standard technical information your browser or app
sends automatically, such as approximate region, language, operating system,
and version. We do not collect your precise location, contacts, photos, or
microphone input.

**No advertising identifiers.** We do not collect Google Advertising ID or
serve advertisements.

## 2. How we use the information

* To create and authenticate your account
* To save and synchronize your gameplay progress between devices
* To display your name, avatar, and scores on global leaderboards
* To send service-related emails (e.g. password reset)
* To diagnose problems and improve the game

We do **not** sell your personal data. We do not use your data for advertising.

## 3. Service providers

We rely on the following processors to operate the Service. Each handles your
data only for the purposes described above and is bound by their own privacy
terms:

* **Supabase, Inc.** — authentication, database, and storage. Data is hosted
  on Supabase infrastructure. See https://supabase.com/privacy

Supabase is the only one. The app bundles all of its code, fonts and images,
so it contacts no content delivery network, font service, analytics provider
or advertising network — there are none in the app.

## 4. Leaderboards and public information

Your **display name** and **avatar** are visible to other users on the global
leaderboard alongside your total stars and per-level scores. Your email and
device information are never shown publicly.

## 5. Data retention

We retain your account information for as long as your account exists. You can
delete your account at any time from inside the app (Account → Delete
account). When you delete your account, your profile, progress, and
leaderboard entries are removed within 30 days. Aggregate, non-identifying
statistics may be retained.

## 6. Your rights

Depending on where you live you may have the right to: access a copy of your
personal data, correct inaccurate data, delete your data, restrict or object
to processing, and lodge a complaint with a data-protection authority (in the
EU/UK).

You can exercise most of these rights directly in the app or by emailing
${LEGAL_EMAIL}. We respond within 30 days.

## 7. Children

The Service is intended for users **13 years of age and older**. We do not
knowingly collect personal information from children under 13. If you believe
a child has provided us with personal information, contact us and we will
delete it.

## 8. International transfers

Your data may be processed in countries other than your country of residence.
Where required, we rely on standard contractual clauses or other lawful
transfer mechanisms.

## 9. Security

We use industry-standard measures to protect your data: HTTPS in transit, salt
+ hash for passwords, row-level security to isolate accounts. No system is
perfectly secure; we cannot guarantee absolute security.

## 10. Changes to this policy

We will post any updates to this Privacy Policy in the app and on our website,
and will update the effective date above. Material changes will be notified
through the app.

## 11. Contact

${LEGAL_PUBLISHER}
${LEGAL_JURIS}
${LEGAL_EMAIL}
${LEGAL_WEBSITE}
`;

// ── Terms of Service ──────────────────────────────────────────────────────

const TERMS_TEXT = `# Terms of Service

**Effective date:** ${LEGAL_EFFECTIVE}

By using ${APP_NAME} (the "Service") you agree to these Terms of Service. If
you do not agree, please do not use the Service.

## 1. Eligibility

You must be at least **13 years old** to use the Service. By using the Service
you represent that you meet this requirement and that, if you are a minor in
your jurisdiction, you have your parent or legal guardian's permission.

## 2. Your account

You are responsible for keeping your password confidential and for all
activity on your account. Notify us at ${LEGAL_EMAIL} if you believe your
account has been compromised.

You agree to provide accurate information when creating an account, and not
to impersonate another person, register multiple accounts to abuse
leaderboards, or use offensive, harassing, or trademark-infringing display
names. We reserve the right to rename or remove accounts that violate these
rules.

## 3. Acceptable use

You agree not to:

* attempt to disrupt, reverse-engineer, or circumvent security of the Service;
* use the Service to harass, abuse, or harm others;
* automate, script, or otherwise inflate scores or leaderboard rank;
* upload content that is unlawful or infringes others' rights;
* probe or scan the Service for vulnerabilities except via our security
  contact.

## 4. Content and licence

You retain ownership of any content you create (e.g. your display name).
By submitting that content to the Service you grant us a non-exclusive,
worldwide, royalty-free licence to host and display it as needed to operate
the Service.

The game, its assets, code, level designs, and trademarks are owned by
${LEGAL_PUBLISHER} and are protected by copyright and other laws. We grant you
a personal, non-transferable, non-exclusive, revocable licence to use the
Service for non-commercial purposes.

## 5. Premium and in-app purchases

If you purchase a Premium plan or other in-app product:

* The Google Play store handles billing. Their terms also apply.
* Subscriptions auto-renew until cancelled in your Google Play account.
* Refunds are governed by Google Play's refund policy.
* "Lifetime" means for the operational lifetime of the Service; we will give
  reasonable advance notice if we ever shut down.

## 6. Termination

You can stop using the Service and delete your account at any time. We may
suspend or terminate accounts that violate these Terms or that are inactive
for an extended period, with reasonable notice when feasible.

## 7. Disclaimer of warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY
KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR
PURPOSE, AND NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE
UNINTERRUPTED OR ERROR-FREE.

## 8. Limitation of liability

To the maximum extent permitted by law, ${LEGAL_PUBLISHER} will not be liable
for any indirect, incidental, special, consequential, or punitive damages,
or any loss of data or goodwill arising from your use of the Service. Our
total aggregate liability will not exceed the amount you paid us in the 12
months before the claim, or US$25, whichever is greater.

## 9. Indemnity

You agree to indemnify ${LEGAL_PUBLISHER} from any claims arising from your
breach of these Terms or your misuse of the Service.

## 10. Changes

We may update these Terms; the new version will appear in the app with a new
effective date. Material changes will be highlighted at first launch after
the change. Continuing to use the Service after that means you accept the
updated Terms.

## 11. Governing law

These Terms are governed by the laws of ${LEGAL_JURIS}, without regard to
conflict-of-laws principles. Disputes will be resolved in the competent
courts of that jurisdiction, except where mandatory consumer-protection law
in your country of residence applies.

## 12. Contact

${LEGAL_PUBLISHER}
${LEGAL_EMAIL}
${LEGAL_WEBSITE}
`;

// ── Open-Source Licenses ──────────────────────────────────────────────────

const LICENSES_TEXT = `# Open-Source Licenses

${APP_NAME} is built on the work of many open-source authors. The full
licence text for each component is below.

────────────────────────────────────────────────────────────────────────

**React** (v18.3.1) — © Meta Platforms, Inc. and affiliates — MIT Licence
**ReactDOM** (v18.3.1) — © Meta Platforms, Inc. and affiliates — MIT Licence
**Babel Standalone** (v7.29.0) — © 2014-present, the Babel authors — MIT Licence
**Supabase JS** (v2) — © 2020 Supabase, Inc. — MIT Licence

> MIT Licence
>
> Permission is hereby granted, free of charge, to any person obtaining a
> copy of this software and associated documentation files (the "Software"),
> to deal in the Software without restriction, including without limitation
> the rights to use, copy, modify, merge, publish, distribute, sublicense,
> and/or sell copies of the Software, and to permit persons to whom the
> Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in
> all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
> IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
> FITNESS FOR A PARTICULAR PURPOSE AND NON-INFRINGEMENT. IN NO EVENT SHALL
> THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
> LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
> FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
> DEALINGS IN THE SOFTWARE.

────────────────────────────────────────────────────────────────────────

**Geist** typeface — © 2023 Vercel, Inc. — SIL Open Font License 1.1
**Geist Mono** typeface — © 2023 Vercel, Inc. — SIL Open Font License 1.1
**Instrument Serif** — © 2022 Instrument — SIL Open Font License 1.1

> SIL Open Font Licence, Version 1.1
>
> Copyright (c) the Copyright Holders.
>
> This Font Software is licensed under the SIL Open Font License,
> Version 1.1. This license is copied below, and is also available with a
> FAQ at: https://openfontlicense.org
>
> The OFL allows the licensed fonts to be used, studied, modified and
> redistributed freely as long as they are not sold by themselves. The fonts,
> including any derivative works, can be bundled, embedded, redistributed
> and/or sold with any software provided that any reserved names are not
> used by derivative works. The fonts and derivatives, however, cannot be
> released under any other type of license. The requirement for fonts to
> remain under this license does not apply to any document created using
> the fonts or their derivatives.
>
> Full text: https://openfontlicense.org/open-font-license-official-text/

────────────────────────────────────────────────────────────────────────

If you believe an attribution is missing or incorrect, please email
${LEGAL_EMAIL}.
`;

// ── In-app screens ────────────────────────────────────────────────────────

const {
  useState: useLG
} = React;
function LegalScreen({
  onBack,
  density = 'comfortable',
  kind
}) {
  const padX = density === 'compact' ? 18 : 22;
  const text = kind === 'privacy' ? PRIVACY_TEXT : kind === 'terms' ? TERMS_TEXT : LICENSES_TEXT;
  const title = kind === 'privacy' ? 'Privacy policy' : kind === 'terms' ? 'Terms of service' : 'Open source licenses';
  return /*#__PURE__*/React.createElement("div", {
    className: "fp-screen",
    style: {
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      boxSizing: 'border-box'
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      padding: `calc(14px + env(safe-area-inset-top, 0px)) ${padX}px 12px`,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flex: '0 0 auto',
      borderBottom: '1px solid var(--fp-line)'
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: onBack,
    style: {
      width: 36,
      height: 36,
      borderRadius: 10,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: 'var(--fp-ink-2)'
    }
  }, /*#__PURE__*/React.createElement(Icon.Chevron, {
    dir: "left",
    size: 18
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      fontFamily: "'Instrument Serif', Georgia, serif",
      fontStyle: 'italic',
      fontSize: 22,
      letterSpacing: '-0.02em',
      color: 'var(--fp-ink)'
    }
  }, title)), /*#__PURE__*/React.createElement("div", {
    className: "fp-scroll",
    style: {
      flex: 1,
      overflowY: 'auto',
      padding: `18px ${padX}px max(28px, env(safe-area-inset-bottom, 0px))`
    }
  }, renderMarkdown(text)));
}

// Minimal Markdown-ish renderer — just enough for our three documents.
// Handles headings (# ## ###), paragraphs, > blockquotes, * bullets, **bold**.
function renderMarkdown(src) {
  const lines = src.split('\n');
  const blocks = [];
  let para = [];
  const flushPara = () => {
    if (!para.length) return;
    blocks.push({
      kind: 'p',
      text: para.join(' ')
    });
    para = [];
  };
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (!ln.trim()) {
      flushPara();
      continue;
    }
    if (ln.startsWith('### ')) {
      flushPara();
      blocks.push({
        kind: 'h3',
        text: ln.slice(4)
      });
      continue;
    }
    if (ln.startsWith('## ')) {
      flushPara();
      blocks.push({
        kind: 'h2',
        text: ln.slice(3)
      });
      continue;
    }
    if (ln.startsWith('# ')) {
      flushPara();
      blocks.push({
        kind: 'h1',
        text: ln.slice(2)
      });
      continue;
    }
    if (ln.startsWith('> ')) {
      flushPara();
      blocks.push({
        kind: 'q',
        text: ln.slice(2)
      });
      continue;
    }
    if (/^[*\-] /.test(ln)) {
      flushPara();
      blocks.push({
        kind: 'li',
        text: ln.replace(/^[*\-] /, '')
      });
      continue;
    }
    if (/^─+$/.test(ln)) {
      flushPara();
      blocks.push({
        kind: 'hr'
      });
      continue;
    }
    para.push(ln.trim());
  }
  flushPara();
  return blocks.map((b, i) => {
    if (b.kind === 'h1') return /*#__PURE__*/React.createElement("h1", {
      key: i,
      style: hStyle(28)
    }, inline(b.text));
    if (b.kind === 'h2') return /*#__PURE__*/React.createElement("h2", {
      key: i,
      style: hStyle(18)
    }, inline(b.text));
    if (b.kind === 'h3') return /*#__PURE__*/React.createElement("h3", {
      key: i,
      style: hStyle(15)
    }, inline(b.text));
    if (b.kind === 'q') return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        borderLeft: '3px solid var(--fp-line)',
        padding: '6px 12px',
        margin: '8px 0',
        fontSize: 12.5,
        color: 'var(--fp-ink-3)',
        lineHeight: 1.6
      }
    }, inline(b.text));
    if (b.kind === 'li') return /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        display: 'flex',
        gap: 8,
        marginBottom: 4,
        fontSize: 13,
        color: 'var(--fp-ink-2)',
        lineHeight: 1.55
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: 'var(--fp-ink-4)'
      }
    }, "\u2022"), /*#__PURE__*/React.createElement("span", null, inline(b.text)));
    if (b.kind === 'hr') return /*#__PURE__*/React.createElement("hr", {
      key: i,
      style: {
        border: 0,
        borderTop: '1px solid var(--fp-line)',
        margin: '14px 0'
      }
    });
    return /*#__PURE__*/React.createElement("p", {
      key: i,
      style: {
        fontSize: 13,
        color: 'var(--fp-ink-2)',
        lineHeight: 1.6,
        margin: '6px 0'
      }
    }, inline(b.text));
  });
}
function inline(text) {
  // Split on **bold** runs and render them stronger
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => p.startsWith('**') && p.endsWith('**') ? /*#__PURE__*/React.createElement("strong", {
    key: i,
    style: {
      color: 'var(--fp-ink)'
    }
  }, p.slice(2, -2)) : /*#__PURE__*/React.createElement(React.Fragment, {
    key: i
  }, p));
}
function hStyle(size) {
  return {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontStyle: 'italic',
    fontWeight: 400,
    fontSize: size,
    lineHeight: 1.15,
    letterSpacing: '-0.02em',
    color: 'var(--fp-ink)',
    margin: '18px 0 8px'
  };
}
window.LegalScreen = LegalScreen;