import fs from 'fs/promises';
import path from 'path';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';

const toNumber = (value, fallback = 0) => {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
};

const round = (value, digits = 2) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

const metersToMiles = (meters) => meters / 1609.344;
const metersToFeet = (meters) => meters * 3.28084;
const secondsToMinutes = (seconds) => seconds / 60;
const startOfWeek = (dateLike) => {
  const d = new Date(dateLike);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay()); // Sunday
  return d;
};
const getWeekKey = (dateLike) => startOfWeek(dateLike).toISOString().slice(0, 10);

const readRequiredEnv = (name) => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
};

const isRun = (activity) => activity?.sport_type === 'Run' || activity?.type === 'Run';
const isTrailRun = (activity) =>
  activity?.sport_type === 'TrailRun' || activity?.type === 'TrailRun';
const isWalk = (activity) => activity?.sport_type === 'Walk' || activity?.type === 'Walk';
const isRunTrailWalk = (activity) => isRun(activity) || isTrailRun(activity) || isWalk(activity);
const isYoga = (activity) => activity?.sport_type === 'Yoga' || activity?.type === 'Yoga';

const toLocalDate = (activity) => {
  const dateString = activity?.start_date_local || activity?.start_date;
  if (!dateString) {
    return new Date(0);
  }
  const parsed = new Date(dateString);
  return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
};

const summarizeSport = (activities, predicate) => {
  const filtered = activities
    .filter(predicate)
    .sort((a, b) => toLocalDate(b).getTime() - toLocalDate(a).getTime());

  const totalDistanceMiles = filtered.reduce(
    (acc, activity) => acc + metersToMiles(toNumber(activity.distance)),
    0
  );
  const totalMovingMinutes = filtered.reduce(
    (acc, activity) => acc + secondsToMinutes(toNumber(activity.moving_time)),
    0
  );
  const totalElevationFeet = filtered.reduce(
    (acc, activity) => acc + metersToFeet(toNumber(activity.total_elevation_gain)),
    0
  );

  const distanceMiles = filtered.map((activity) => metersToMiles(toNumber(activity.distance)));
  const movingMinutes = filtered.map((activity) => secondsToMinutes(toNumber(activity.moving_time)));

  const latest = filtered[0]
    ? {
        id: filtered[0].id,
        name: filtered[0].name,
        sportType: filtered[0].sport_type || filtered[0].type || 'Unknown',
        startDateLocal: filtered[0].start_date_local || filtered[0].start_date,
        distanceMiles: round(metersToMiles(toNumber(filtered[0].distance))),
        movingMinutes: round(secondsToMinutes(toNumber(filtered[0].moving_time))),
        elevationFeet: round(metersToFeet(toNumber(filtered[0].total_elevation_gain)))
      }
    : null;

  return {
    count: filtered.length,
    distanceMiles: round(totalDistanceMiles),
    movingMinutes: round(totalMovingMinutes, 1),
    elevationFeet: round(totalElevationFeet),
    minDistanceMiles: filtered.length ? round(Math.min(...distanceMiles)) : 0,
    maxDistanceMiles: filtered.length ? round(Math.max(...distanceMiles)) : 0,
    minMovingMinutes: filtered.length ? round(Math.min(...movingMinutes), 1) : 0,
    maxMovingMinutes: filtered.length ? round(Math.max(...movingMinutes), 1) : 0,
    latest
  };
};

const summarizeWeek = (activities, weekStartDate, weekEndDate) => {
  const weekActivities = activities.filter((activity) => {
    const d = toLocalDate(activity);
    return d >= weekStartDate && d < weekEndDate;
  });

  return {
    weekKey: getWeekKey(weekStartDate),
    weekStart: weekStartDate.toISOString(),
    weekEnd: weekEndDate.toISOString(),
    runs: summarizeSport(weekActivities, isRun),
    runTrailWalk: summarizeSport(weekActivities, isRunTrailWalk),
    yoga: summarizeSport(weekActivities, isYoga)
  };
};

const refreshAccessToken = async ({ clientId, clientSecret, refreshToken }) => {
  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'refresh_token',
    refresh_token: refreshToken
  });

  const response = await fetch(STRAVA_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to refresh Strava token (${response.status}): ${text}`);
  }

  return response.json();
};

const fetchActivities = async ({ accessToken, afterUnix }) => {
  const all = [];
  let page = 1;

  while (true) {
    const url = new URL(STRAVA_ACTIVITIES_URL);
    url.searchParams.set('after', String(afterUnix));
    url.searchParams.set('per_page', '200');
    url.searchParams.set('page', String(page));

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to fetch activities (${response.status}): ${text}`);
    }

    const batch = await response.json();
    if (!Array.isArray(batch) || batch.length === 0) {
      break;
    }

    all.push(...batch);
    if (batch.length < 200) {
      break;
    }

    page += 1;
  }

  return all;
};

const writeJson = async (filePath, payload) => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
};

const main = async () => {
  const weeksBack = Math.max(1, toNumber(process.env.STRAVA_WEEKS, 4));
  const windowDays = weeksBack * 7;

  const clientId = readRequiredEnv('STRAVA_CLIENT_ID');
  const clientSecret = readRequiredEnv('STRAVA_CLIENT_SECRET');
  const refreshToken = readRequiredEnv('STRAVA_REFRESH_TOKEN');

  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const periodStart = new Date(currentWeekStart);
  periodStart.setDate(periodStart.getDate() - (weeksBack - 1) * 7);
  const afterUnix = Math.floor(periodStart.getTime() / 1000);

  const token = await refreshAccessToken({ clientId, clientSecret, refreshToken });
  const accessToken = token.access_token;

  if (!accessToken) {
    throw new Error('Strava token response missing access_token');
  }

  const activities = await fetchActivities({ accessToken, afterUnix });

  const runs = summarizeSport(activities, isRun);
  const runTrailWalk = summarizeSport(activities, isRunTrailWalk);
  const yoga = summarizeSport(activities, isYoga);
  const weeks = Array.from({ length: weeksBack }, (_, i) => {
    const weekStart = new Date(currentWeekStart);
    weekStart.setDate(weekStart.getDate() - i * 7);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    return summarizeWeek(activities, weekStart, weekEnd);
  });

  const payload = {
    generatedAt: now.toISOString(),
    periodStart: periodStart.toISOString(),
    windowDays,
    activitiesFetched: activities.length,
    tokenExpiresAt: token.expires_at ? new Date(token.expires_at * 1000).toISOString() : null,
    refreshTokenRotated: token.refresh_token && token.refresh_token !== refreshToken,
    runs,
    runTrailWalk,
    yoga,
    averages: {
      weeks: weeksBack,
      distanceMilesPerWeek: round(runTrailWalk.distanceMiles / weeksBack),
      elevationFeetPerWeek: round(runTrailWalk.elevationFeet / weeksBack),
      yogaMinutesPerWeek: round(yoga.movingMinutes / weeksBack, 1),
      yogaSessionsPerWeek: round(yoga.count / weeksBack, 2)
    },
    weeks
  };

  const todayKey = now.toISOString().slice(0, 10);

  await writeJson('public/data/strava/latest.json', payload);
  await writeJson('data/strava/latest.json', payload);
  await writeJson(`data/strava/history/${todayKey}.json`, payload);

  console.log('Strava sync complete');
  console.log(`Fetched ${activities.length} activities in the last ${windowDays} day(s)`);

  if (payload.refreshTokenRotated) {
    console.log('Warning: Strava returned a new refresh token. Update STRAVA_REFRESH_TOKEN secret to keep future syncs healthy.');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
