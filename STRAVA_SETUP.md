# Strava Daily Sync Setup

This repo includes a daily Strava sync job that updates:

- `public/data/strava/latest.json` (used by the app)
- `data/strava/latest.json`
- `data/strava/history/YYYY-MM-DD.json`
- `data/strava/archive/activities.json` (long-term analysis archive)

## 1. Create a Strava API App

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Create an app
3. Set **Authorization Callback Domain** to your domain (for local setup, `localhost` is fine)
4. Save these values:
   - Client ID
   - Client Secret

## 2. Generate a Refresh Token

Open this URL in your browser (replace `CLIENT_ID`):

```text
https://www.strava.com/oauth/authorize?client_id=CLIENT_ID&response_type=code&redirect_uri=http://localhost/exchange_token&approval_prompt=force&scope=read,activity:read_all
```

After approval, copy the `code` from the redirect URL.

Exchange it for tokens:

```bash
curl -X POST https://www.strava.com/oauth/token \
  -d client_id=YOUR_CLIENT_ID \
  -d client_secret=YOUR_CLIENT_SECRET \
  -d code=THE_CODE_FROM_REDIRECT \
  -d grant_type=authorization_code
```

Copy `refresh_token` from the response.

## 3. Add GitHub Repository Secrets

In your GitHub repo: **Settings -> Secrets and variables -> Actions -> New repository secret**

Create:

- `STRAVA_CLIENT_ID`
- `STRAVA_CLIENT_SECRET`
- `STRAVA_REFRESH_TOKEN`

## 4. Daily Defaults and One-Time Backfill

Daily schedule uses:

- `STRAVA_WEEKS=4` (dashboard)
- `STRAVA_RECORD_WEEKS=52` (records panel)
- `STRAVA_ARCHIVE_WEEKS=52` (archive refresh window)

To bootstrap archive with 3 years of data once:

1. Go to **Actions -> Daily Strava Sync -> Run workflow**
2. Set:
   - `strava_weeks`: `4`
   - `record_weeks`: `52`
   - `archive_weeks`: `156`
3. Run it once, then keep daily defaults at `52` archive weeks.

The archive file keeps merged historical records by activity ID, so your 3-year backfill stays available for analysis.

## 5. Optional Local Run

```bash
STRAVA_CLIENT_ID=... \
STRAVA_CLIENT_SECRET=... \
STRAVA_REFRESH_TOKEN=... \
STRAVA_WEEKS=4 \
STRAVA_RECORD_WEEKS=52 \
STRAVA_ARCHIVE_WEEKS=156 \
npm run sync:strava
```

## Notes

- If Strava rotates your refresh token, the sync log will warn you.
- In that case, update `STRAVA_REFRESH_TOKEN` secret in GitHub.
