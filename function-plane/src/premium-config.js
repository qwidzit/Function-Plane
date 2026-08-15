// Stripe Payment Links — paste the three URLs from your Stripe Dashboard
// (Products → "Payment links"). They open in a new tab; on success, Stripe
// fires a webhook that should mark the user's profile as premium.
//
// Until these are filled in, the app falls back to a placeholder dialog
// explaining that purchases are not configured. Note that these links are for
// the web/sideload channel only — the Play Store build must use Play Billing
// (see the payments section of ABOUT.md).
window.PREMIUM_LINKS = {
  monthly:  '',  // e.g. 'https://buy.stripe.com/xxxYourMonthlyLinkxxx'
  yearly:   '',
  lifetime: '',
};
