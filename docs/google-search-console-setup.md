# Google Search Console integration

The Admin → SEO panel connects the RENDI VIRGO Search Console property with read-only access. It stores the encrypted OAuth refresh token and latest performance report in the API database. Customers do not connect Google accounts.

## Google Cloud setup

1. Create or choose a Google Cloud project and enable the **Google Search Console API**.
2. Configure the OAuth consent screen with the RENDI VIRGO app name, support email, homepage, privacy policy, and authorized domain.
3. Create an OAuth client of type **Web application**.
4. Add the exact callback URL to **Authorized redirect URIs**:

   `https://rendivirgo.com/api/admin/integrations/search-console/oauth/callback`

   For local development, add the matching local callback as a separate redirect URI:

   `http://localhost:3000/api/admin/integrations/search-console/oauth/callback`

5. Request only this OAuth scope:

   `https://www.googleapis.com/auth/webmasters.readonly`

6. The Google account used to connect must already have access to the RENDI VIRGO property in Search Console. Use a Domain property or the exact URL-prefix property shown by Google.
7. Check the OAuth scope classification in Google Cloud Console. If Google marks the scope sensitive for the published app, complete the required verification before opening the feature to general users.

## API environment

Set these values on the API service in Coolify, not the storefront container:

```env
GOOGLE_SEARCH_CONSOLE_CLIENT_ID=...
GOOGLE_SEARCH_CONSOLE_CLIENT_SECRET=...
GOOGLE_SEARCH_CONSOLE_REDIRECT_URI=https://rendivirgo.com/api/admin/integrations/search-console/oauth/callback
```

The API also needs its existing stable `SESSION_SECRET` (at least 32 characters in production) to encrypt the refresh token. The SEO recommendation button uses the existing OpenRouter configuration and AI usage budget.

After adding the environment values, restart or redeploy the API. Then open **Admin → SEO**, connect the Google account, choose the verified RENDI VIRGO property, and load its performance report. The API migration creates the connection and one-time OAuth state tables.

## Data and safety behavior

- Search performance is requested for the selected property in the latest 28-day period ending three days ago; recent data may be incomplete.
- The report compares the latest 28-day window with the preceding 28 days and shows up to 25 top query/page rows per window.
- AI recommendations use the saved report, treat search queries and URLs as untrusted data, and remain suggestions for an admin to review. They are never published automatically.
- Disconnect removes the local refresh token and asks Google to revoke it. If Google does not confirm revocation, remove RENDI VIRGO from the Google Account’s third-party connections as well.
- The Search Analytics API can omit low-volume or anonymized query rows; recommendations must be interpreted with that limitation.
