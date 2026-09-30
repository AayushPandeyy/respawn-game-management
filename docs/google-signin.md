# Enable Google sign-in

The app includes Continue with Google on login and signup. Supabase handles
Google OAuth, and the server callback exchanges the PKCE code for session cookies.
Existing and new Google users use the same button.

1. In Google Cloud, configure an OAuth consent screen and create a Web application
   OAuth client. If the app is in Testing mode, add your test Google accounts.
2. Copy the callback URL shown in Supabase → Authentication → Sign In / Providers
   → Google (normally https://YOUR_PROJECT.supabase.co/auth/v1/callback) into the
   Google client's Authorized redirect URIs.
3. Enable the Google provider in Supabase and enter the Google client ID and
   client secret there. No Google secret belongs in this app's public environment.
4. In Supabase Authentication → URL Configuration, allow the app callback and
   its query parameters for each environment:
   - http://127.0.0.1:3000/auth/callback**
   - https://YOUR_DOMAIN/auth/callback**
   Keep the production hostname explicit. The suffix allows flow and next parameters.
5. Click Continue with Google. Complete consent, then check that you return to the
   intended app page. Also check cancellation, sign-out, and signing in again.

Use the existing Supabase environment keys. No SQL migration is required.
Automated tests cover OAuth initiation, safe destinations, provider failure,
callback success and cancellation. Live Google consent requires provider setup
and is not verified by these tests.

Official guide: https://supabase.com/docs/guides/auth/social-login/auth-google
