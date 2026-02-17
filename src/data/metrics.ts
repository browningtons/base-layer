import type { Category, Metric, MetricInput } from '../types';
import { autoThresholds } from '../utils/scoring';

export const PALETTE = {
  weak: '#D65D5D',
  avg: '#6DA36D',
  fit: '#5D8AA8',
  elite: '#E6A35C',
  body: '#2563eb',
  mind: '#059669',
  family: '#7c3aed',
  social: '#db2777',
  slate: '#64748b'
} as const;

const BODY_METRICS_INPUT = [
  { id: 'miles', label: 'Miles', unit: 'mi/wk', current: 13, weak: 3, elite: 30, type: 'higher_better', desc: 'Total weekly running volume.', tip: 'Increase mileage by max 10% per week to build durability without injury.' },
  { id: 'elevation', label: 'Elevation', unit: 'ft/wk', current: 2500, weak: 500, elite: 4000, type: 'higher_better', desc: 'Vertical feet climbed per week.', tip: 'Incorporate one dedicated hill repeat session or incline treadmill walk weekly.' },
  { id: 'vo2max', label: 'VO2 Max', unit: 'ml/kg/min', current: 55, weak: 35, elite: 55, type: 'higher_better', desc: 'Maximum rate of oxygen consumption.', tip: 'HIIT (High Intensity Interval Training) is the most efficient way to boost this.' },
  { id: 'pushups', label: 'Push Ups', unit: 'max reps', current: 30, weak: 10, elite: 50, type: 'higher_better', desc: 'Max consecutive pushups.', tip: 'Do daily sets of 50% your max reps. Grease the groove.' },
  { id: 'plank', label: 'Plank', unit: 'seconds', current: 110, weak: 45, elite: 240, type: 'higher_better', desc: 'Core isometric hold time.', tip: 'Focus on active tension (squeezing glutes and abs) rather than just hanging on.' },
  { id: 'pullups', label: 'Pull Ups', unit: 'reps', current: 3, weak: 1, elite: 15, type: 'higher_better', desc: 'Max strict pullups.', tip: 'Use "negatives" (jumping up and lowering slowly) to build initial strength.' },
  { id: 'yoga', label: 'Yoga', unit: 'sessions/wk', current: 3, weak: 1, elite: 6, type: 'higher_better', desc: 'Weekly number of yoga sessions.', tip: 'Aim for 3-4 sessions each week and keep at least one session short and easy.' }
] satisfies MetricInput[];

const MIND_METRICS_INPUT = [
  { id: 'meditation_count', label: 'Meditate', unit: 'count/wk', current: 5, weak: 0, elite: 7, type: 'higher_better', desc: 'Number of meditation sessions.', tip: 'Attach meditation to an existing habit (e.g., right after coffee) to ensure consistency.' },
  { id: 'meditation_time', label: 'Length', unit: 'min/wk', current: 60, weak: 0, elite: 120, type: 'higher_better', desc: 'Total minutes of meditation.', tip: 'Start small. Even 5 minutes counts. Extend by 1 minute every week.' },
  { id: 'reading', label: 'Reading', unit: 'min/wk', current: 45, weak: 0, elite: 240, type: 'higher_better', desc: 'Time spent reading books.', tip: 'Read 10 pages every morning before looking at your phone.' },
  { id: 'writing', label: 'Writing', unit: 'min/wk', current: 30, weak: 0, elite: 120, type: 'higher_better', desc: 'Time spent journaling or writing.', tip: 'Try "Morning Pages": 3 pages of stream-of-consciousness writing first thing.' },
  { id: 'sleep', label: 'Sleep', unit: 'hrs', current: 6.0, weak: 4, elite: 8, type: 'higher_better', desc: 'Average nightly sleep.', tip: 'No screens 60 minutes before bed. Keep your room cool (65°F).' },
  { id: 'fasting', label: 'Fasting', unit: 'hrs/day', current: 10, weak: 8, elite: 18, type: 'higher_better', desc: 'Daily fasting window.', tip: 'Stop eating 3 hours before bed. It improves sleep and naturally extends your fast.' },
  { id: 'deep_work', label: 'Deep Work', unit: 'hrs/wk', current: 12, weak: 0, elite: 16, type: 'higher_better', desc: 'Hours of distraction-free focus.', tip: 'Use the Pomodoro technique or block "Do Not Disturb" hours on your calendar.' }
] satisfies MetricInput[];

const FAMILY_METRICS_INPUT = [
  { id: 'kids_time', label: 'Kid Time', unit: 'hrs/wk', current: 8, weak: 1, elite: 10, type: 'higher_better', desc: 'Focused 1:1 time with children.', tip: 'Let the child lead the play. Put your phone in another room.' },
  { id: 'rituals', label: 'Rituals', unit: 'events/wk', current: 2, weak: 0, elite: 7, type: 'higher_better', desc: 'Recurring family traditions.', tip: 'Establish a simple weekly anchor like Friday Pizza Night or Sunday Pancakes.' },
  { id: 'adventures', label: 'Adventures', unit: 'outings/mo', current: 2, weak: 0, elite: 4, type: 'higher_better', desc: 'Novel family outings.', tip: 'Explore a new local park or hiking trail once a month.' },
  { id: 'date_night', label: 'Date Night', unit: 'count/mo', current: 3, weak: 0, elite: 4, type: 'higher_better', desc: 'Dedicated partner connection.', tip: 'Take turns planning the date to share the mental load.' },
  { id: 'phone_free', label: 'Phone Free', unit: 'hrs/day', current: 1, weak: 0, elite: 4, type: 'higher_better', desc: ' hours at home without devices.', tip: 'Create a "phone jail" box for dinner time and keep it there until kids sleep.' },
  { id: 'family_mtg', label: 'Fam Meeting', unit: 'count/mo', current: 1, weak: 0, elite: 4, type: 'higher_better', desc: 'Family coordination/culture sync.', tip: 'Discuss "Rose, Thorn, Bud" (good, bad, potential) for the week.' },
  { id: 'parents', label: 'Family Contact', unit: 'calls/wk', current: 4, weak: 0, elite: 3, type: 'higher_better', desc: 'Connecting with extended family.', tip: 'Schedule a recurring calendar event for calls so it doesn\'t slip.' }
] satisfies MetricInput[];

const SOCIAL_METRICS_INPUT = [
  { id: 'creative', label: 'Creative', unit: 'hrs/wk', current: 10, weak: 0, elite: 10, type: 'higher_better', desc: 'Time on creative expression.', tip: 'Focus on the process of making, not the quality of the result.' },
  { id: 'community', label: 'Community', unit: 'events/mo', current: 0, weak: 0, elite: 4, type: 'higher_better', desc: 'Community participation events.', tip: 'Become a "regular" somewhere (coffee shop, gym, park) to build loose ties.' },
  { id: 'connection', label: 'Connection', unit: 'hrs/wk', current: 6, weak: 1, elite: 14, type: 'higher_better', desc: 'Deep social connection time.', tip: 'Schedule a recurring walk or coffee with a close friend.' },
  { id: 'hosting', label: 'Hosting', unit: 'events/mo', current: 0, weak: 0, elite: 2, type: 'higher_better', desc: 'Hosting gatherings.', tip: 'Keep it simple (potluck or game night) so it is low stress to repeat.' },
  { id: 'networking', label: 'Network', unit: 'acts/wk', current: 2, weak: 0, elite: 5, type: 'higher_better', desc: 'Professional outreach acts.', tip: 'Reach out to one person you admire just to ask a specific question.' },
  { id: 'mentorship', label: 'Mentoring', unit: 'hrs/mo', current: 4, weak: 0, elite: 5, type: 'higher_better', desc: 'Time spent mentoring others.', tip: 'Offer to help someone junior to you with a specific skill you have mastered.' },
  { id: 'service', label: 'Service', unit: 'acts/mo', current: 1, weak: 0, elite: 4, type: 'higher_better', desc: 'Acts of service/volunteering.', tip: 'Find a local cause you care about and commit just one hour a month.' }
] satisfies MetricInput[];

const buildMetrics = (input: MetricInput[]): Metric[] => input.map(autoThresholds);

export const BODY_METRICS = buildMetrics(BODY_METRICS_INPUT);
export const MIND_METRICS = buildMetrics(MIND_METRICS_INPUT);
export const FAMILY_METRICS = buildMetrics(FAMILY_METRICS_INPUT);
export const SOCIAL_METRICS = buildMetrics(SOCIAL_METRICS_INPUT);

export const DEFAULT_METRICS_BY_CATEGORY: Record<Category, Metric[]> = {
  body: BODY_METRICS,
  mind: MIND_METRICS,
  family: FAMILY_METRICS,
  social: SOCIAL_METRICS
};
