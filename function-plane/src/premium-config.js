// The one thing the game sells: a lifetime unlock of every pack. Not a
// subscription — is_premium is a boolean with no expiry, and a permanent
// unlock is what it can honestly express.
//
// `price` is the display price for the web channel. The Play build shows the
// localized price Play returns for the product instead, so this string is only
// ever the Stripe-side truth.
//
// `stripeLink` takes a Stripe Payment Link (Dashboard → Products → Payment
// links). Until it is filled in, the web build shows a "not configured" dialog
// instead of a checkout. The Play build never reads it: external payment for
// digital goods inside a Play app is an anti-steering violation, so that
// channel must go through Play Billing (see the payments section of ABOUT.md).
window.FP_PREMIUM = {
  price:      '€4.90',
  stripeLink: '',  // e.g. 'https://buy.stripe.com/xxxYourLifetimeLinkxxx'
};
