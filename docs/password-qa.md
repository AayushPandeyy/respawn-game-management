# Password essentials

Implemented forgot-password email requests, PKCE recovery callback, authenticated
password updates, confirmation fields, password visibility, profile security link,
expired-link recovery, and safe return-to-page login navigation.

## Supabase setup

In Authentication → URL Configuration, allow:

- http://127.0.0.1:3000/auth/callback?flow=recovery
- Your production origin followed by /auth/callback?flow=recovery

Keep the existing signup callback URL allowed as well. Use the default recovery
email ConfirmationURL template so Supabase completes verification before
redirecting to the app. With PKCE, open the email in the browser that requested it.

Reference: https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail

## Automated QA

Run npm run test:auth. Fourteen tests cover signup/login/logout, origin checks,
malformed inputs, recovery email responses and throttling, session verification,
password mismatch and length validation, reused/weak passwords, expired and
missing callback codes, older short login passwords, and safe return destinations.
Tests use controlled Supabase responses; no actual emails or passwords are changed.

Production build and TypeScript validation also pass.

## Bugs corrected

- Login unnecessarily enforced the new-account eight-character minimum.
- Protected pages dropped the original destination when redirecting to login.
- Recovery needed separate callback success and failure destinations.
- New password/auth API routes were absent from session-refresh middleware.

## Remaining live QA

Browser automation was blocked by the browser URL security policy, so visual QA
and real Supabase email delivery are not verified.

1. Request a reset for a test account from Forgot your password on login.
2. Open the latest email in the same browser; confirm the new password form opens.
3. Check mismatched passwords, save a valid password, sign out, and sign in with it.
4. Confirm the old password fails and a reused email link offers a new reset.
5. Visit Achievements while signed out, log in, and confirm the return destination.
6. Check mobile form layout and keyboard/password-manager behavior.

No database migration is needed.
