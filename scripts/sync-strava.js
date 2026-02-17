import fs from 'fs/promises';
import path from 'path';

const STRAVA_TOKEN_URL = 'https://www.strava.com/oauth/token';
const STRAVA_ACTIVITIES_URL = 'https://www.strava.com/api/v3/athlete/activities';
const RECORD_WINDOWS = [6, 13, 26, 52];
const ARCHIVE_PATH = 'data/strava/archive/activities.json';

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

const summarizeRecordWindow = (activities, currentWeekStart, weeks) => {
  const windowStart = new Date(currentWeekStart);
  windowStart.setDate(windowStart.getDate() - (weeks - 1) * 7);

  const inWindow = activities.filter((activity) => {
    const d = toLocalDate(activity);
    return d >= windowStart;
  });

  const runTrailWalkActivities = inWindow.filter(isRunTrailWalk);
  const yogaActivities = inWindow.filter(isYoga);

  const longestDistanceMiles = runTrailWalkActivities.reduce(
    (max, activity) => Math.max(max, metersToMiles(toNumber(activity.distance))),
    0
  );
  const longestMovingMinutes = runTrailWalkActivities.reduce(
    (max, activity) => Math.max(max, secondsToMinutes(toNumber(activity.moving_time))),
    0
  );
  const highestElevationFeet = runTrailWalkActivities.reduce(
    (max, activity) => Math.max(max, metersToFeet(toNumber(activity.total_elevation_gain))),
    0
  );
  const longestYogaMinutes = yogaActivities.reduce(
    (max, activity) => Math.max(max, secondsToMinutes(toNumber(activity.moving_time))),
    0
  );

  return {
    runTrailWalk: {
      count: runTrailWalkActivities.length,
      longestDistanceMiles: round(longestDistanceMiles),
      longestMovingMinutes: round(longestMovingMinutes, 1),
      highestElevationFeet: round(highestElevationFeet)
    },
    yoga: {
      count: yogaActivities.length,
      longestMovingMinutes: round(longestYogaMinutes, 1)
    }
  };
};

const summarizeRecords = (activities, currentWeekStart, weeksBack, windows = RECORD_WINDOWS) => {
  const normalizedWindows = windows
    .map((windowWeeks) => Math.max(1, toNumber(windowWeeks, 1)))
    .filter((windowWeeks) => windowWeeks <= weeksBack);

  const windowsPayload = Object.fromEntries(
    normalizedWindows.map((windowWeeks) => [
      String(windowWeeks),
      summarizeRecordWindow(activities, currentWeekStart, windowWeeks)
    ])
  );

  return {
    recordWeeksBack: weeksBack,
    windows: windowsPayload
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

const readJsonIfExists = async (filePath, fallback) => {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
};

const toArchiveActivity = (activity) => ({
  id: toNumber(activity?.id),
  name: activity?.name ?? '',
  sportType: activity?.sport_type || activity?.type || 'Unknown',
  type: activity?.type ?? null,
  startDate: activity?.start_date ?? null,
  startDateLocal: activity?.start_date_local ?? null,
  distanceMeters: round(toNumber(activity?.distance), 2),
  movingSeconds: Math.round(toNumber(activity?.moving_time)),
  elapsedSeconds: Math.round(toNumber(activity?.elapsed_time)),
  elevationGainMeters: round(toNumber(activity?.total_elevation_gain), 2),
  averageHeartrate: round(toNumber(activity?.average_heartrate), 1),
  maxHeartrate: round(toNumber(activity?.max_heartrate), 1),
  averageSpeed: round(toNumber(activity?.average_speed), 2),
  maxSpeed: round(toNumber(activity?.max_speed), 2),
  calories: round(toNumber(activity?.calories), 1),
  kilojoules: round(toNumber(activity?.kilojoules), 1)
});

const mergeArchiveActivities = (existingActivities, incomingActivities) => {
  const byId = new Map();
  for (const activity of existingActivities) {
    if (!activity || !activity.id) continue;
    byId.set(String(activity.id), activity);
  }
  for (const activity of incomingActivities) {
    if (!activity || !activity.id) continue;
    byId.set(String(activity.id), activity);
  }

  return [...byId.values()].sort((a, b) => {
    const aTime = new Date(a.startDateLocal || a.startDate || 0).getTime();
    const bTime = new Date(b.startDateLocal || b.startDate || 0).getTime();
    return bTime - aTime;
  });
};

const main = async () => {
  const weeksBack = Math.max(1, toNumber(process.env.STRAVA_WEEKS, 4));
  const recordWeeksBack = Math.max(weeksBack, toNumber(process.env.STRAVA_RECORD_WEEKS, 52));
  const archiveWeeks = Math.max(recordWeeksBack, toNumber(process.env.STRAVA_ARCHIVE_WEEKS, recordWeeksBack));
  const fetchWeeksBack = Math.max(recordWeeksBack, archiveWeeks);
  const windowDays = weeksBack * 7;

  const clientId = readRequiredEnv('STRAVA_CLIENT_ID');
  const clientSecret = readRequiredEnv('STRAVA_CLIENT_SECRET');
  const refreshToken = readRequiredEnv('STRAVA_REFRESH_TOKEN');

  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const periodStart = new Date(currentWeekStart);
  periodStart.setDate(periodStart.getDate() - (weeksBack - 1) * 7);
  const fetchStart = new Date(currentWeekStart);
  fetchStart.setDate(fetchStart.getDate() - (fetchWeeksBack - 1) * 7);
  const fetchAfterUnix = Math.floor(fetchStart.getTime() / 1000);

  const token = await refreshAccessToken({ clientId, clientSecret, refreshToken });
  const accessToken = token.access_token;

  if (!accessToken) {
    throw new Error('Strava token response missing access_token');
  }

  const recordActivities = await fetchActivities({ accessToken, afterUnix: fetchAfterUnix });
  const activities = recordActivities.filter((activity) => toLocalDate(activity) >= periodStart);

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
  const records = summarizeRecords(recordActivities, currentWeekStart, recordWeeksBack);
  const archiveStart = new Date(currentWeekStart);
  archiveStart.setDate(archiveStart.getDate() - (archiveWeeks - 1) * 7);
  const archiveActivities = recordActivities
    .filter((activity) => toLocalDate(activity) >= archiveStart)
    .map(toArchiveActivity);
  const existingArchive = await readJsonIfExists(ARCHIVE_PATH, {
    generatedAt: null,
    archiveWeeks: 0,
    totalActivities: 0,
    activities: []
  });
  const mergedArchiveActivities = mergeArchiveActivities(
    Array.isArray(existingArchive?.activities) ? existingArchive.activities : [],
    archiveActivities
  );
  const archivePayload = {
    generatedAt: now.toISOString(),
    archiveWeeks,
    totalActivities: mergedArchiveActivities.length,
    activities: mergedArchiveActivities
  };

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
    records,
    weeks
  };

  const todayKey = now.toISOString().slice(0, 10);

  await writeJson('public/data/strava/latest.json', payload);
  await writeJson('data/strava/latest.json', payload);
  await writeJson(`data/strava/history/${todayKey}.json`, payload);
  await writeJson(ARCHIVE_PATH, archivePayload);

  console.log('Strava sync complete');
  console.log(`Fetched ${activities.length} activities in the last ${windowDays} day(s)`);
  console.log(`Computed record windows from ${recordActivities.length} activities in the last ${recordWeeksBack * 7} day(s)`);
  console.log(`Archive now has ${archivePayload.totalActivities} activities (up to last ${archiveWeeks} week(s) per sync window)`);

  if (payload.refreshTokenRotated) {
    console.log('Warning: Strava returned a new refresh token. Update STRAVA_REFRESH_TOKEN secret to keep future syncs healthy.');
  }
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
