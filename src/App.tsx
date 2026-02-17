import React, { useEffect, useMemo, useState } from 'react';
import { Edit2, Save, ArrowUpCircle, Info, PieChart, Triangle, HelpCircle, Trophy, AlertCircle, Sparkles } from 'lucide-react';
import CategoryTabs from './components/CategoryTabs';
import WeekSelector from './components/WeekSelector';
import { BODY_METRICS, FAMILY_METRICS, MIND_METRICS, PALETTE, SOCIAL_METRICS } from './data/metrics';
import { useWeeklyMetrics } from './hooks/useWeeklyMetrics';
import type { ActiveTab, Category, CategoryScoreSummary, EditableMetricField, HoveredPoint, Metric, MetricRank, OverviewDatum, OverviewMode, StravaSportSummary, StravaSyncPayload, StravaWeeklySummary, StravaWindowRecord } from './types';
import { autoThresholds, calculateCategoryScore, getVisualRadius, getWeekKey, normalize } from './utils/scoring';

// --- STATIC HELPERS ---
const polarToCartesian = (centerX: number, centerY: number, radius: number, angleInDegrees: number) => {
  const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians)
  };
};

const describeArc = (x: number, y: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) => {
    const start = polarToCartesian(x, y, outerRadius, endAngle);
    const end = polarToCartesian(x, y, outerRadius, startAngle);
    const startInner = polarToCartesian(x, y, innerRadius, endAngle);
    const endInner = polarToCartesian(x, y, innerRadius, startAngle);

    const largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
        "M", start.x, start.y, 
        "A", outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y,
        "L", endInner.x, endInner.y,
        "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y,
        "Z"
    ].join(" ");
};

// --- Config Constants ---
const CHART_RADIUS = 120;
const CHART_CENTER = 150;
const METRIC_TABS: Category[] = ['body', 'mind', 'family', 'social'];
const STRAVA_RECORD_WINDOWS = ['6', '13', '26', '52'] as const;
const isMetricTab = (tab: ActiveTab): tab is Category =>
  METRIC_TABS.includes(tab as Category);
const roundMetric = (value: number, digits = 1) => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const safeNumber = (value: number | undefined | null, fallback = 0) =>
  Number.isFinite(value) ? (value as number) : fallback;
const resolveAveragingWeeks = (payload: StravaSyncPayload) => {
  const fromAverages = safeNumber(payload.averages?.weeks, 0);
  if (fromAverages > 0) {
    return fromAverages;
  }

  const fromWindow = safeNumber(payload.windowDays, 0) / 7;
  if (fromWindow > 0) {
    return fromWindow;
  }

  return 4;
};

export default function PerformanceRadar() {
  // ---- CORE STATE ----
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [overviewMode, setOverviewMode] = useState<OverviewMode>('sunburst');
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const [weekKey, setWeekKey] = useState(getWeekKey());
  const [isEditing, setIsEditing] = useState(false);
  const [stravaSync, setStravaSync] = useState<StravaSyncPayload | null>(null);
  const [stravaError, setStravaError] = useState<string | null>(null);

  // const weeklyKey = (category) =>
  //   `base-layer:${category}:${weekKey}`;

  // ---- METRIC STATE ----
  const [bodyMetrics, setBodyMetrics] = useWeeklyMetrics('body', weekKey, BODY_METRICS);
  const [mindMetrics, setMindMetrics] = useWeeklyMetrics('mind', weekKey, MIND_METRICS);
  const [familyMetrics, setFamilyMetrics] = useWeeklyMetrics('family', weekKey, FAMILY_METRICS);
  const [socialMetrics, setSocialMetrics] = useWeeklyMetrics('social', weekKey, SOCIAL_METRICS);

  // ---- DERIVED ---- 
  const metricsByCategory: Record<Category, Metric[]> = {
    body: bodyMetrics,
    mind: mindMetrics,
    family: familyMetrics,
    social: socialMetrics
  };

  const currentMetrics = isMetricTab(activeTab) ? metricsByCategory[activeTab] : [];

  useEffect(() => {
    let isMounted = true;

    const loadStravaSummary = async () => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}data/strava/latest.json`, {
          cache: 'no-store'
        });

        if (!response.ok) {
          throw new Error(`Failed loading Strava summary (${response.status})`);
        }

        const payload = (await response.json()) as StravaSyncPayload;
        if (isMounted) {
          setStravaSync(payload);
          setStravaError(null);
        }
      } catch {
        if (isMounted) {
          setStravaSync(null);
          setStravaError('Strava sync data is not available yet.');
        }
      }
    };

    loadStravaSummary();
    return () => {
      isMounted = false;
    };
  }, []);

  const yogaMinutesPerWeek = useMemo(() => {
    if (!stravaSync) {
      return 0;
    }

    const averageWeeks = resolveAveragingWeeks(stravaSync);
    return safeNumber(
      stravaSync.averages?.yogaMinutesPerWeek,
      safeNumber(stravaSync.yoga?.movingMinutes, 0) / averageWeeks
    );
  }, [stravaSync]);

  const stravaDailyDashboard = useMemo(() => {
    const milesGoal = safeNumber(bodyMetrics.find((metric) => metric.id === 'miles')?.goal, 0);
    const elevationGoal = safeNumber(bodyMetrics.find((metric) => metric.id === 'elevation')?.goal, 0);
    const yogaGoal = safeNumber(bodyMetrics.find((metric) => metric.id === 'yoga')?.goal, 0);

    if (!stravaSync) {
      return {
        momentumScore: 0,
        status: 'Awaiting sync',
        nextAction: 'Trigger Strava sync to generate today\'s training brief.',
        week: {
          miles: { current: 0, goal: milesGoal, progress: 0 },
          elevation: { current: 0, goal: elevationGoal, progress: 0 },
          yoga: { current: 0, goal: yogaGoal, progress: 0 }
        },
        streaks: { runWeeks: 0, yogaWeeks: 0, balancedWeeks: 0 }
      };
    }

    const orderedWeeks = [...(Array.isArray(stravaSync.weeks) ? stravaSync.weeks : [])].sort(
      (a, b) => new Date(b.weekStart).getTime() - new Date(a.weekStart).getTime()
    );
    const currentWeek = orderedWeeks[0];
    const weekMiles = safeNumber(
      currentWeek?.runTrailWalk?.distanceMiles,
      safeNumber(currentWeek?.runs?.distanceMiles, 0)
    );
    const weekElevation = safeNumber(
      currentWeek?.runTrailWalk?.elevationFeet,
      safeNumber(currentWeek?.runs?.elevationFeet, 0)
    );
    const weekYoga = safeNumber(currentWeek?.yoga?.count, 0);

    const milesProgress = milesGoal > 0 ? weekMiles / milesGoal : 0;
    const elevationProgress = elevationGoal > 0 ? weekElevation / elevationGoal : 0;
    const yogaProgress = yogaGoal > 0 ? weekYoga / yogaGoal : 0;

    const calculateStreak = (predicate: (week: StravaWeeklySummary) => boolean) => {
      let streak = 0;
      for (const week of orderedWeeks) {
        if (predicate(week)) {
          streak += 1;
          continue;
        }
        break;
      }
      return streak;
    };

    const runWeeks = calculateStreak(
      (week) => safeNumber(week.runTrailWalk?.count, safeNumber(week.runs?.count, 0)) > 0
    );
    const yogaWeeks = calculateStreak((week) => safeNumber(week.yoga?.count, 0) > 0);
    const balancedWeeks = calculateStreak(
      (week) =>
        safeNumber(week.runTrailWalk?.count, safeNumber(week.runs?.count, 0)) > 0 &&
        safeNumber(week.yoga?.count, 0) > 0
    );

    const averageProgress = (clamp01(milesProgress) + clamp01(elevationProgress) + clamp01(yogaProgress)) / 3;
    const streakBonus = Math.min(20, runWeeks * 2 + yogaWeeks * 2 + balancedWeeks);
    const momentumScore = Math.round(Math.min(100, averageProgress * 80 + streakBonus));

    const milesRemaining = Math.max(0, milesGoal - weekMiles);
    const elevationRemaining = Math.max(0, elevationGoal - weekElevation);
    const yogaRemaining = Math.max(0, yogaGoal - weekYoga);

    let nextAction = 'Fit targets are covered. Keep rhythm with a short recovery session.';
    if (!currentWeek) {
      nextAction = 'No activities logged this week. Start today with one short run or one yoga session.';
    } else if (yogaRemaining >= 1) {
      nextAction = `Priority: complete 1 yoga session today. ${roundMetric(yogaRemaining, 1)} sessions remain to hit this week\'s fit target.`;
    } else if (milesRemaining > 0) {
      nextAction = `Priority: add ${roundMetric(Math.min(6, milesRemaining), 1)} miles today to stay on weekly run target.`;
    } else if (elevationRemaining > 0) {
      nextAction = `Priority: get ${Math.round(Math.min(900, elevationRemaining))} ft of climbing to stay on weekly elevation target.`;
    }

    const status =
      momentumScore >= 80 ? 'Strong momentum' : momentumScore >= 55 ? 'Building momentum' : 'Regain momentum';

    return {
      momentumScore,
      status,
      nextAction,
      week: {
        miles: { current: weekMiles, goal: milesGoal, progress: milesProgress },
        elevation: { current: weekElevation, goal: elevationGoal, progress: elevationProgress },
        yoga: { current: weekYoga, goal: yogaGoal, progress: yogaProgress }
      },
      streaks: { runWeeks, yogaWeeks, balancedWeeks }
    };
  }, [bodyMetrics, stravaSync]);

  const stravaRecordRows = useMemo(() => {
    const recordsByWindow: Record<string, StravaWindowRecord> = stravaSync?.records?.windows ?? {};
    return STRAVA_RECORD_WINDOWS.map((windowWeeks) => {
      const record = recordsByWindow[windowWeeks];
      return {
        windowWeeks,
        runCount: safeNumber(record?.runTrailWalk?.count, 0),
        yogaCount: safeNumber(record?.yoga?.count, 0),
        longestDistanceMiles: safeNumber(record?.runTrailWalk?.longestDistanceMiles, 0),
        longestMovingMinutes: safeNumber(record?.runTrailWalk?.longestMovingMinutes, 0),
        highestElevationFeet: safeNumber(record?.runTrailWalk?.highestElevationFeet, 0),
        longestYogaMinutes: safeNumber(record?.yoga?.longestMovingMinutes, 0)
      };
    });
  }, [stravaSync]);

  const hasRecordData = useMemo(
    () => stravaRecordRows.some((row) => row.runCount > 0 || row.yogaCount > 0),
    [stravaRecordRows]
  );

  useEffect(() => {
    if (!stravaSync) {
      return;
    }

    const averageWeeks = resolveAveragingWeeks(stravaSync);
    const movementSummary = stravaSync.runTrailWalk ?? stravaSync.runs;

    const milesCurrent = roundMetric(
      safeNumber(
        stravaSync.averages?.distanceMilesPerWeek,
        safeNumber(movementSummary?.distanceMiles, 0) / averageWeeks
      )
    );
    const elevationCurrent = Math.round(
      safeNumber(
        stravaSync.averages?.elevationFeetPerWeek,
        safeNumber(movementSummary?.elevationFeet, 0) / averageWeeks
      )
    );
    const yogaSessionsCurrent = roundMetric(
      safeNumber(
        stravaSync.averages?.yogaSessionsPerWeek,
        safeNumber(stravaSync.yoga?.count, 0) / averageWeeks
      )
    );

    setBodyMetrics((prev) =>
      prev.map((metric) => {
        if (metric.id === 'miles') {
          return autoThresholds({ ...metric, current: milesCurrent });
        }
        if (metric.id === 'elevation') {
          return autoThresholds({ ...metric, current: elevationCurrent });
        }
        if (metric.id === 'yoga') {
          return autoThresholds({ ...metric, current: yogaSessionsCurrent });
        }
        return metric;
      })
    );
  }, [setBodyMetrics, stravaSync, weekKey]);

  const handleUpdateMetric = (id: string, field: EditableMetricField, value: string) => {
    const val = parseFloat(value) || 0;

    const update = (setFn: React.Dispatch<React.SetStateAction<Metric[]>>) =>
      setFn(prev =>
        prev.map(m =>
          m.id === id
            ? autoThresholds({ ...m, [field]: val })
            : m
        )
      );

    const categoryCollections: Array<{ metrics: Metric[]; setMetrics: React.Dispatch<React.SetStateAction<Metric[]>> }> = [
      { metrics: bodyMetrics, setMetrics: setBodyMetrics },
      { metrics: mindMetrics, setMetrics: setMindMetrics },
      { metrics: familyMetrics, setMetrics: setFamilyMetrics },
      { metrics: socialMetrics, setMetrics: setSocialMetrics }
    ];

    const match = categoryCollections.find(({ metrics }) => metrics.some(m => m.id === id));
    if (match) {
      update(match.setMetrics);
    }
  };

  // --- Chart Math ---

  const overviewScores = useMemo<CategoryScoreSummary>(() => {
    const bodyScore = calculateCategoryScore(bodyMetrics);
    const mindScore = calculateCategoryScore(mindMetrics);
    const familyScore = calculateCategoryScore(familyMetrics);
    const socialScore = calculateCategoryScore(socialMetrics);
    const totalLevel = Math.round((bodyScore + mindScore + familyScore + socialScore) / 4);
    
    return {
      body: bodyScore,
      mind: mindScore,
      family: familyScore,
      social: socialScore,
      level: Number.isNaN(totalLevel) ? 0 : totalLevel,
      data: [
        { id: 'body', label: 'Body', current: bodyScore, elite: 150, color: PALETTE.body }, 
        { id: 'mind', label: 'Mind', current: mindScore, elite: 150, color: PALETTE.mind }, 
        { id: 'family', label: 'Family', current: familyScore, elite: 150, color: PALETTE.family }, 
        { id: 'social', label: 'Social', current: socialScore, elite: 150, color: PALETTE.social }, 
      ]
    };
  }, [bodyMetrics, mindMetrics, familyMetrics, socialMetrics]);

  const getRecommendation = (metricsList: Metric[]) => {
    if (!metricsList || metricsList.length === 0) return null;
    const sorted = [...metricsList].sort((a, b) => normalize(a, a.current) - normalize(b, b.current));
    const weakest = sorted[0];
    
    const isLowerBetter = weakest.type === 'lower_better';
    const isWorse = (curr: number, thr: number) => isLowerBetter ? curr > thr : curr < thr;

    let targetValue = weakest.elite;
    let targetLabel = "Elite";

    if (isWorse(weakest.current, weakest.weak)) { targetValue = weakest.weak; targetLabel = "Weak"; }
    else if (isWorse(weakest.current, weakest.avg)) { targetValue = weakest.avg; targetLabel = "Average"; }
    else if (isWorse(weakest.current, weakest.goal)) { targetValue = weakest.goal; targetLabel = "Fit"; }

    const verb = isLowerBetter ? "Lower" : "Improve";
    return { metric: weakest.label, text: `${verb} ${weakest.label} to ${targetValue} ${weakest.unit} to reach ${targetLabel} status.` };
  };

  const getInsights = () => {
      const scores = overviewScores.data;
      const sorted = [...scores].sort((a, b) => b.current - a.current);
      const strongest = sorted[0];
      const weakest = sorted[sorted.length - 1];

      const quoteMap: Record<Category, string> = {
          body: "Motion creates emotion. Move your body to shift your mind.",
          mind: "The mind is a muscle. Train it with stillness and focus.",
          family: "The most important work you will ever do is within the walls of your own home.",
          social: "We are the average of the five people we spend the most time with."
      };

      return {
          strongest,
          weakest,
          quote: quoteMap[weakest.id] || "Balance is not something you find, it's something you create."
      };
  };

  const insights = getInsights();

  const getCoordinates = (value: number, index: number, total: number, radius: number) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const val = Number.isFinite(value) ? value : 0;
    return { 
      x: Math.cos(angle) * radius * val, 
      y: Math.sin(angle) * radius * val 
    };
  };

  const generatePath = (dataItems: Array<Metric | OverviewDatum>, radius: number, center: number) => {
    return dataItems.map((item, i) => {
      let nVal;
      if (activeTab === 'overview') {
        nVal = Math.min(item.current / 100, 1.0);
      } else {
        nVal = getVisualRadius(normalize(item as Metric, item.current));
      }
      const coords = getCoordinates(nVal, i, dataItems.length, radius);
      return `${center + coords.x},${center + coords.y}`;
    }).join(' ');
  };

  const getColorForMetric = (metric: Metric) => {
    const { current, avg, goal, elite, type } = metric;
    const isLowerBetter = type === 'lower_better';
    const passes = (val: number, threshold: number) => isLowerBetter ? val <= threshold : val >= threshold;

    if (passes(current, elite)) return { stroke: PALETTE.elite, fill: PALETTE.elite }; 
    if (passes(current, goal)) return { stroke: PALETTE.fit, fill: PALETTE.fit };     
    if (passes(current, avg)) return { stroke: PALETTE.avg, fill: PALETTE.avg };      
    return { stroke: PALETTE.weak, fill: PALETTE.weak };
  };

  const getMetricRank = (metric: Metric): MetricRank => {
    const { current, avg, goal, elite, type } = metric;
    const isLowerBetter = type === 'lower_better';
    const passes = (val: number, threshold: number) => isLowerBetter ? val <= threshold : val >= threshold;

    if (passes(current, elite)) return 3; 
    if (passes(current, goal)) return 2;  
    if (passes(current, avg)) return 1;   
    return 0;                             
  };

  const getOverallStatus = () => {
    if (activeTab === 'overview') return { stroke: "#6366f1", fill: "rgba(99, 102, 241, 0.2)", label: "Total" }; 
    if (!isMetricTab(activeTab)) return { stroke: "#ea580c", fill: "rgba(234, 88, 12, 0.2)", label: "Strava" };
    
    const counts: Record<MetricRank, number> = { 0: 0, 1: 0, 2: 0, 3: 0 };
    currentMetrics.forEach(m => {
        const rank = getMetricRank(m);
        counts[rank] += 1;
    });

    let winningRank: MetricRank = 3;
    let maxCount = -1;

    for (const rank of [3, 2, 1, 0] as const) {
       if (counts[rank] >= maxCount) {
         maxCount = counts[rank];
         winningRank = rank;
       }
    }

    switch(winningRank) {
        case 0: return { stroke: PALETTE.weak, fill: `${PALETTE.weak}33`, label: "Weak" }; 
        case 1: return { stroke: PALETTE.avg, fill: `${PALETTE.avg}33`, label: "Average" }; 
        case 2: return { stroke: PALETTE.fit, fill: `${PALETTE.fit}33`, label: "Fit" }; 
        default: return { stroke: PALETTE.elite, fill: `${PALETTE.elite}33`, label: "Elite" }; 
    }
  };

  const overall = getOverallStatus();

  const tabInfoByCategory: Record<Category, { score: number; color: string }> = {
    body: { score: overviewScores.body, color: PALETTE.body },
    mind: { score: overviewScores.mind, color: PALETTE.mind },
    family: { score: overviewScores.family, color: PALETTE.family },
    social: { score: overviewScores.social, color: PALETTE.social }
  };

  const currentTabInfo = isMetricTab(activeTab) ? tabInfoByCategory[activeTab] : null;

  // --- Render Components ---

  const renderSunburst = () => {
    const allGroups: Array<{ name: string; color: string; metrics: Metric[] }> = [
      { name: "Family", color: PALETTE.family, metrics: familyMetrics },
      { name: "Social", color: PALETTE.social, metrics: socialMetrics },
      { name: "Mind", color: PALETTE.mind, metrics: mindMetrics },
      { name: "Body", color: PALETTE.body, metrics: bodyMetrics },
    ];

    return (
      <svg viewBox="0 0 300 300" className="w-full max-w-[450px] overflow-visible mt-8">
        {allGroups.map((group, gIndex) => {
          const categoryStartAngle = gIndex * 90; 
          const categoryMetricCount = group.metrics.length;
          const wedgeAngle = (90 - 6) / categoryMetricCount; 
          
          return group.metrics.map((metric, mIndex) => {
            const startAngle = categoryStartAngle + (mIndex * wedgeAngle) + 3; 
            const endAngle = startAngle + wedgeAngle - 1; 
            
            const nVal = normalize(metric, metric.current);
            const visualR = getVisualRadius(nVal); 
            const outerRadius = visualR * CHART_RADIUS;
            const innerRadius = 20; 

            const path = describeArc(CHART_CENTER, CHART_CENTER, innerRadius, outerRadius, startAngle, endAngle);
            const bgPath = describeArc(CHART_CENTER, CHART_CENTER, innerRadius, CHART_RADIUS, startAngle, endAngle); 

            return (
              <g key={metric.id}
                 onMouseEnter={() => setHoveredPoint({ x: CHART_CENTER, y: CHART_CENTER, val: metric.current, unit: metric.unit, label: metric.label, color: group.color })}
                 onMouseLeave={() => setHoveredPoint(null)}
              >
                <path d={bgPath} fill={group.color} opacity="0.1" />
                <path d={path} fill={group.color} opacity="0.8" className="transition-all duration-300 hover:opacity-100 cursor-pointer" />
              </g>
            );
          });
        })}
        
        {/* Reordered Labels */}
        <text x={CHART_CENTER} y={CHART_CENTER - 130} textAnchor="middle" fill={PALETTE.family} fontSize="10" fontWeight="bold">FAMILY</text>
        <text x={CHART_CENTER + 130} y={CHART_CENTER} textAnchor="middle" fill={PALETTE.social} fontSize="10" fontWeight="bold">SOCIAL</text>
        <text x={CHART_CENTER} y={CHART_CENTER + 135} textAnchor="middle" fill={PALETTE.mind} fontSize="10" fontWeight="bold">MIND</text>
        <text x={CHART_CENTER - 130} y={CHART_CENTER} textAnchor="middle" fill={PALETTE.body} fontSize="10" fontWeight="bold">BODY</text>

        {hoveredPoint && (
          <g pointerEvents="none" className="z-50">
             <circle cx={CHART_CENTER} cy={CHART_CENTER} r={40} fill="white" stroke={hoveredPoint.color} strokeWidth="2" />
             <text x={CHART_CENTER} y={CHART_CENTER - 5} textAnchor="middle" fill="#1e293b" fontSize="10" fontWeight="bold">{hoveredPoint.label}</text>
             <text x={CHART_CENTER} y={CHART_CENTER + 8} textAnchor="middle" fill={hoveredPoint.color} fontSize="14" fontWeight="black">{hoveredPoint.val}</text>
             <text x={CHART_CENTER} y={CHART_CENTER + 20} textAnchor="middle" fill="#94a3b8" fontSize="8">{hoveredPoint.unit}</text>
          </g>
        )}
      </svg>
    );
  };

  const renderRadar = () => {
    const dataToRender = activeTab === 'overview' ? overviewScores.data : currentMetrics;
    const isOverview = activeTab === 'overview';

    const bgLevels = [
      { scale: 1.0, color: PALETTE.elite, dash: "" }, 
      { scale: 0.8, color: PALETTE.fit, dash: "4 2" }, 
      { scale: 0.6, color: PALETTE.avg, dash: "4 2" }, 
      { scale: 0.05, color: PALETTE.weak, dash: "4 2" } 
    ].map((level, i) => (
      <polygon 
        key={i} 
        points={dataToRender.map((_, idx) => {
            const coords = getCoordinates(level.scale, idx, dataToRender.length, CHART_RADIUS);
            return `${CHART_CENTER + coords.x},${CHART_CENTER + coords.y}`;
        }).join(' ')} 
        fill="none" 
        stroke={level.color} 
        strokeWidth="1" 
        strokeDasharray={level.dash} 
        opacity="0.5"
      />
    ));

    const axesLines = dataToRender.map((item, i) => {
      const coords = getCoordinates(1.22, i, dataToRender.length, CHART_RADIUS); 
      const lineEnd = getCoordinates(1.05, i, dataToRender.length, CHART_RADIUS);
      
      let textAnchor: React.SVGProps<SVGTextElement>['textAnchor'] = "middle";
      if (coords.x > 10) textAnchor = "start";
      else if (coords.x < -10) textAnchor = "end";

      let dominantBaseline: React.SVGProps<SVGTextElement>['dominantBaseline'] = "middle";
      if (coords.y < -10) dominantBaseline = "auto"; 
      else if (coords.y > 10) dominantBaseline = "hanging"; 

      const words = item.label.split(' ');
      const isMultiLine = words.length > 1;

      return (
        <React.Fragment key={item.id}>
          <line x1={CHART_CENTER} y1={CHART_CENTER} x2={CHART_CENTER + lineEnd.x} y2={CHART_CENTER + lineEnd.y} stroke="#e5e7eb" strokeWidth="1" />
          <text 
            x={CHART_CENTER + coords.x} 
            y={CHART_CENTER + coords.y} 
            textAnchor={textAnchor} 
            dominantBaseline={dominantBaseline} 
            className={`font-bold uppercase tracking-wide ${isOverview ? 'text-[12px] fill-gray-800' : 'text-[10px] fill-gray-500'}`}
          >
            {isMultiLine ? [
                <tspan key="1" x={CHART_CENTER + coords.x} dy="-0.6em">{words[0]}</tspan>,
                <tspan key="2" x={CHART_CENTER + coords.x} dy="1.2em">{words.slice(1).join(' ')}</tspan>
            ] : item.label}
          </text>
        </React.Fragment>
      );
    });

    let polygonFill, polygonStroke;
    if (isOverview) {
        polygonFill = "rgba(99, 102, 241, 0.2)";
        polygonStroke = "#6366f1";
    } else {
        polygonFill = overall.fill;
        polygonStroke = overall.stroke;
    }

    const mainPoints = generatePath(dataToRender, CHART_RADIUS, CHART_CENTER);

    const dots = dataToRender.map((item, i) => {
      let nVal;
      let dotColor: string;
      let unit = '';
      
      if (isOverview) {
          const overviewItem = item as OverviewDatum;
          nVal = Math.min(overviewItem.current / 100, 1.0);
          dotColor = overviewItem.color;
      } else {
          const metricItem = item as Metric;
          nVal = getVisualRadius(normalize(metricItem, metricItem.current));
          dotColor = getColorForMetric(metricItem).stroke;
          unit = metricItem.unit;
      }
      
      const coords = getCoordinates(nVal, i, dataToRender.length, CHART_RADIUS);
      
      return (
        <g key={item.id} 
           onMouseEnter={() => setHoveredPoint({ x: CHART_CENTER + coords.x, y: CHART_CENTER + coords.y, val: item.current, unit, label: item.label })}
           onMouseLeave={() => setHoveredPoint(null)}
           className="cursor-pointer"
        >
          <circle cx={CHART_CENTER + coords.x} cy={CHART_CENTER + coords.y} r={6} fill="white" stroke={dotColor} strokeWidth="3" className="transition-all duration-300 hover:r-8 z-20" />
          <circle cx={CHART_CENTER + coords.x} cy={CHART_CENTER + coords.y} r={12} fill="transparent" />
        </g>
      );
    });

    return (
      <svg viewBox="0 0 300 300" className="w-full max-w-[450px] overflow-visible mt-8">
        <circle cx={CHART_CENTER} cy={CHART_CENTER} r="2" fill="#9ca3af" />
        {bgLevels}
        {axesLines}
        <polygon points={mainPoints} fill={polygonFill} stroke={polygonStroke} strokeWidth="2" className="transition-all duration-500 ease-in-out" opacity="0.8" />
        {dots}
        
        {hoveredPoint && (
          <g pointerEvents="none" className="z-50 transition-opacity duration-200">
            <rect x={hoveredPoint.x - 40} y={hoveredPoint.y - 45} width="80" height="35" rx="6" fill="#1e293b" opacity="0.95" />
            <path d={`M ${hoveredPoint.x - 6} ${hoveredPoint.y - 11} L ${hoveredPoint.x} ${hoveredPoint.y - 5} L ${hoveredPoint.x + 6} ${hoveredPoint.y - 11} Z`} fill="#1e293b" opacity="0.95" />
            <text x={hoveredPoint.x} y={hoveredPoint.y - 23} textAnchor="middle" fill="white" fontSize="11" fontWeight="bold">
              {hoveredPoint.val} <tspan fontSize="9" fontWeight="normal" fill="#94a3b8">{hoveredPoint.unit}</tspan>
            </text>
          </g>
        )}
      </svg>
    );
  };

  const renderActiveChart = () => {
    if (activeTab === 'overview') {
        return overviewMode === 'sunburst' ? renderSunburst() : renderRadar();
    }
    if (activeTab === 'strava') {
      return null;
    }
    return renderRadar();
  };

  const formatWhen = (isoDate: string | null | undefined) => {
    if (!isoDate) {
      return 'N/A';
    }
    const parsed = new Date(isoDate);
    if (Number.isNaN(parsed.getTime())) {
      return 'N/A';
    }
    return parsed.toLocaleString();
  };

  const renderStravaCard = (
    title: string,
    accentClasses: string,
    summary: StravaSportSummary,
    options?: { showDistance?: boolean }
  ) => (
    <div className={`rounded-xl border p-4 ${accentClasses}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wide">{title}</h3>
        <span className="text-xs font-medium">{summary.count} activities</span>
      </div>
      <div className={`grid gap-3 mt-3 text-sm ${options?.showDistance === false ? 'grid-cols-1' : 'grid-cols-2'}`}>
        {options?.showDistance !== false && (
          <div className="bg-white/70 rounded-lg p-2">
            <div className="text-xs text-gray-500">Distance</div>
            <div className="text-lg font-black">{summary.distanceMiles.toFixed(1)} mi</div>
          </div>
        )}
        <div className="bg-white/70 rounded-lg p-2">
          <div className="text-xs text-gray-500">Moving Time</div>
          <div className="text-lg font-black">{summary.movingMinutes.toFixed(0)} min</div>
        </div>
      </div>
      <div className="mt-3 text-xs text-gray-600 space-y-1">
        <div>
          {options?.showDistance === false
            ? `Moving Range: ${summary.minMovingMinutes.toFixed(0)}-${summary.maxMovingMinutes.toFixed(0)} min`
            : `Range: ${summary.minDistanceMiles.toFixed(1)}-${summary.maxDistanceMiles.toFixed(1)} mi`}
        </div>
        <div>Latest: {summary.latest ? `${summary.latest.name} (${formatWhen(summary.latest.startDateLocal)})` : 'N/A'}</div>
      </div>
    </div>
  );

  const formatWeekRange = (weekStart: string, weekEnd: string) => {
    const start = new Date(weekStart);
    const end = new Date(weekEnd);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      return 'N/A';
    }
    const endMinusOne = new Date(end);
    endMinusOne.setDate(endMinusOne.getDate() - 1);
    return `${start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} - ${endMinusOne.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Base Layer</h1>
          <p className="text-gray-500">Integrate Your Parts. Master Your Life</p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-gray-500">
          <WeekSelector weekKey={weekKey} onChange={setWeekKey} />
        </div>

        <CategoryTabs
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setIsEditing(false);
          }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* RIGHT COLUMN MOVED TO LEFT: Data Table / Overview Stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col order-last lg:order-first">
            <div className="p-6 border-b border-gray-100 bg-white">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {activeTab === 'overview' ? 'Holistic Breakdown' : activeTab === 'strava' ? 'Strava Layer' : 'Metrics Details'}
                        </h2>
                        {isMetricTab(activeTab) && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-semibold text-gray-500">Category Score:</span>
                                <span className="text-2xl font-black" style={{ color: currentTabInfo?.color }}>
                                    {currentTabInfo?.score.toFixed(0)}
                                </span>
                            </div>
                        )}
                    </div>
                    {isMetricTab(activeTab) && (
                        <button onClick={() => setIsEditing(!isEditing)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${isEditing ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                            {isEditing ? 'Done' : 'Edit Stats'}
                        </button>
                    )}
                </div>

                {/* Overview Dashboard Items */}
                {activeTab === 'overview' && (
                    <div className="space-y-4 mb-4">
                        {/* Superpower & Focus Area - Integrated into Cards */}
                        {overviewScores.data.map((cat) => {
                            const isStrongest = cat.id === insights.strongest.id;
                            const isWeakest = cat.id === insights.weakest.id;
                            let containerClass = "bg-gray-50 border-gray-100";
                            let badge = null;

                            if (isStrongest) {
                                containerClass = "bg-green-50 border-green-200";
                                badge = (
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-[10px] uppercase font-bold rounded-full">
                                        <Trophy className="w-3 h-3" /> Superpower
                                    </div>
                                );
                            } else if (isWeakest) {
                                containerClass = "bg-red-50 border-red-200";
                                badge = (
                                    <div className="flex items-center gap-1 px-2 py-0.5 bg-red-100 text-red-700 text-[10px] uppercase font-bold rounded-full">
                                        <AlertCircle className="w-3 h-3" /> Focus Area
                                    </div>
                                );
                            }

                            return (
                                <div key={cat.id} className={`flex items-center p-4 rounded-xl border ${containerClass} relative overflow-hidden`}>
                                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg" style={{ backgroundColor: cat.color }}>
                                    {cat.current.toFixed(0)}
                                  </div>
                                  <div className="ml-4 flex-1">
                                    <div className="flex justify-between items-center mb-1">
                                      <div className="flex items-center gap-2">
                                          <h3 className="font-bold text-gray-800">{cat.label} Score</h3>
                                          {badge}
                                      </div>
                                      <span className="text-xs text-gray-500">Target: Fit (100)</span>
                                    </div>
                                    <div className="w-full bg-white rounded-full h-2.5 border border-gray-200">
                                      <div className="h-2.5 rounded-full" style={{ width: `${Math.min(cat.current, 100)}%`, backgroundColor: cat.color }}></div>
                                    </div>
                                  </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* Next Best Action or Insight */}
                <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 shadow-sm">
                   <div className="flex items-center gap-2 mb-2 text-blue-700 font-bold text-xs uppercase tracking-wide">
                     {activeTab === 'overview' || activeTab === 'strava' ? <Sparkles className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />} 
                     {activeTab === 'overview' ? 'Insight of the Day' : activeTab === 'strava' ? 'Sync Status' : 'Next Best Action'}
                   </div>
                   <p className="text-base text-blue-900 font-medium">
                     {activeTab === 'overview'
                        ? insights.quote
                        : activeTab === 'strava'
                          ? (stravaSync
                              ? `Imported ${stravaSync.activitiesFetched} activities across the last ${stravaSync.windowDays} days.`
                              : (stravaError || 'Waiting for Strava sync data...'))
                          : getRecommendation(currentMetrics)?.text}
                   </p>
                </div>
            </div>

            <div className="overflow-x-auto flex-1 p-6 pt-2">
              {activeTab === 'overview' ? (
                <div className="space-y-6">
                   {/* Added Explanation Block at Bottom */}
                   <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 text-sm text-gray-600 mb-4">
                     <div className="flex items-center gap-2 font-bold text-gray-800 mb-1">
                        <HelpCircle className="w-4 h-4" /> Scoring Guide
                     </div>
                     <p>
                        <strong>Fit</strong> is the target (100 pts). 
                        <strong> Weak</strong> is 0 pts, and <strong>Average</strong> is 50 pts. 
                        Anything above Fit is bonus territory! Hitting <strong>Elite</strong> gives you 150 pts.
                     </p>
                  </div>
                </div>
              ) : activeTab === 'strava' ? (
                <div className="space-y-6">
                  {stravaSync ? (
                    <>
                      {(() => {
                        const weeks = Array.isArray(stravaSync.weeks) ? stravaSync.weeks : [];
                        return (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {renderStravaCard('Runs', 'border-blue-200 bg-blue-50', stravaSync.runs)}
                              {renderStravaCard('Yoga', 'border-emerald-200 bg-emerald-50', stravaSync.yoga, { showDistance: false })}
                            </div>
                            <div className="rounded-xl border border-gray-200 overflow-hidden">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-gray-50 text-gray-500 font-medium">
                                  <tr>
                                    <th className="px-4 py-2">Week</th>
                                    <th className="px-4 py-2 text-right">Run mi</th>
                                    <th className="px-4 py-2 text-right">Run min</th>
                                    <th className="px-4 py-2 text-right">Yoga sessions</th>
                                    <th className="px-4 py-2 text-right">Yoga min</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                  {weeks.map((week) => (
                                    <tr key={week.weekKey} className="hover:bg-gray-50">
                                      <td className="px-4 py-2 font-medium text-gray-800">{formatWeekRange(week.weekStart, week.weekEnd)}</td>
                                      <td className="px-4 py-2 text-right">{week.runs.distanceMiles.toFixed(1)}</td>
                                      <td className="px-4 py-2 text-right">{week.runs.movingMinutes.toFixed(0)}</td>
                                      <td className="px-4 py-2 text-right">{week.yoga.count}</td>
                                      <td className="px-4 py-2 text-right">{week.yoga.movingMinutes.toFixed(0)}</td>
                                    </tr>
                                  ))}
                                  {weeks.length === 0 && (
                                    <tr>
                                      <td className="px-4 py-3 text-gray-500" colSpan={5}>No weekly Strava data yet.</td>
                                    </tr>
                                  )}
                                </tbody>
                              </table>
                            </div>
                          </>
                        );
                      })()}
                      <div className="text-xs text-gray-500">
                        Last updated: {formatWhen(stravaSync.generatedAt)}
                      </div>
                    </>
                  ) : (
                    <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                      {stravaError || 'Strava sync data is not available yet.'}
                    </div>
                  )}
                </div>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-500 font-medium">
                    <tr>
                      <th className="px-4 py-2">Metric</th>
                      <th className="px-4 py-2 text-right">Current</th>
                      <th className="px-4 py-2 text-right hidden sm:table-cell" style={{color: PALETTE.weak}}>Weak</th>
                      <th className="px-4 py-2 text-right hidden sm:table-cell" style={{color: PALETTE.avg}}>Avg</th>
                      <th className="px-4 py-2 text-right hidden sm:table-cell" style={{color: PALETTE.fit}}>Fit</th>
                      <th className="px-4 py-2 text-right hidden sm:table-cell" style={{color: PALETTE.elite}}>Elite</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {currentMetrics.map((metric) => {
                      const colors = getColorForMetric(metric);
                      return (
                        <tr key={metric.id} className="hover:bg-gray-50 transition-colors group relative">
                          <td className="px-4 py-2 font-medium text-gray-900 flex items-center gap-2">
                            {metric.label}
                            {/* INFO ICON TRIGGER FOR TOOLTIP */}
                            <div className="group/tooltip relative">
                                <Info className="w-3 h-3 text-gray-400 cursor-help" />
                                <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 w-48 p-2 bg-slate-800 text-white text-xs rounded shadow-xl opacity-0 group-hover/tooltip:opacity-100 pointer-events-none z-50">
                                    <strong className="block mb-1 text-slate-200">{metric.desc}</strong>
                                    <em className="text-slate-400">{metric.tip}</em>
                                </div>
                            </div>
                            <span className="block text-xs text-gray-400 font-normal ml-auto">{metric.unit}</span>
                          </td>
                          <td className="px-4 py-2 text-right">
                            {isEditing ? (
                              <input type="number" className="w-16 px-2 py-1 text-right border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none" value={metric.current} onChange={(e) => handleUpdateMetric(metric.id, 'current', e.target.value)} />
                            ) : (
                              <div className="inline-flex flex-col items-end">
                                <span className="font-bold transition-colors duration-500" style={{color: colors.fill}}>{metric.current}</span>
                                {metric.id === 'yoga' && yogaMinutesPerWeek > 0 && (
                                  <span className="text-[10px] text-gray-500">{Math.round(yogaMinutesPerWeek)} min/wk</span>
                                )}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400 hidden sm:table-cell">
                            {isEditing ? <input type="number" className="w-16 px-2 py-1 text-right border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none text-gray-600" value={metric.weak} onChange={(e) => handleUpdateMetric(metric.id, 'weak', e.target.value)} /> : metric.weak}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-400 hidden sm:table-cell">{metric.avg}</td>
                          <td className="px-4 py-2 text-right text-gray-400 hidden sm:table-cell">{metric.goal}</td>
                          <td className="px-4 py-2 text-right text-gray-400 hidden sm:table-cell">
                            {isEditing ? <input type="number" className="w-16 px-2 py-1 text-right border rounded bg-white focus:ring-2 focus:ring-blue-500 outline-none text-gray-600" value={metric.elite} onChange={(e) => handleUpdateMetric(metric.id, 'elite', e.target.value)} /> : metric.elite}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* LEFT COLUMN MOVED TO RIGHT: Radar/Sunburst Chart Section */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center relative min-h-[450px] order-first lg:order-last">
            <h2 className="absolute top-6 left-6 text-lg font-bold text-gray-900 flex items-center">
               {activeTab === 'overview' ? (overviewMode === 'sunburst' ? 'All Metrics' : 'Summary Triangle') : activeTab === 'strava' ? 'Strava Layer' : 'Category Radar'}
            </h2>
            
            {activeTab === 'overview' ? (
               <div className="absolute top-6 right-6 flex items-center gap-2">
                  {/* View Toggles */}
                  <button 
                    onClick={() => setOverviewMode('sunburst')} 
                    className={`p-1.5 rounded-lg transition-colors ${overviewMode === 'sunburst' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`}
                    title="Detailed View"
                  >
                    <PieChart className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => setOverviewMode('triangle')} 
                    className={`p-1.5 rounded-lg transition-colors ${overviewMode === 'triangle' ? 'bg-indigo-100 text-indigo-600' : 'text-gray-400 hover:bg-gray-100'}`}
                    title="Summary View"
                  >
                    <Triangle className="w-4 h-4" />
                  </button>
                  <div className="h-4 w-px bg-gray-300 mx-1"></div>
                  <div className="flex flex-col items-end">
                    <span className="text-3xl font-black text-gray-800">Lvl {overviewScores.level}</span>
                    <span className="text-[10px] text-gray-400 uppercase tracking-wider">Total</span>
                  </div>
               </div>
            ) : activeTab === 'strava' ? (
              <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider shadow-sm bg-orange-100 text-orange-700 border border-orange-200">
                4 Weeks
              </div>
            ) : (
               <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors duration-500 shadow-sm" style={{ backgroundColor: overall.stroke, color: '#fff' }}>
                  {overall.label}
               </div>
            )}
            
            {activeTab === 'strava' ? (
              <div className="w-full mt-16 space-y-4">
                {stravaSync ? (
                  <>
                    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-xs uppercase tracking-wide text-sky-700 font-bold mb-1">Daily Brief</div>
                          <div className="text-sm font-semibold text-sky-900">{stravaDailyDashboard.status}</div>
                        </div>
                        <div className="rounded-lg border border-sky-200 bg-white px-3 py-2 text-right">
                          <div className="text-[10px] uppercase tracking-wide text-sky-600 font-bold">Momentum Score</div>
                          <div className="text-2xl leading-none font-black text-sky-900">{stravaDailyDashboard.momentumScore}</div>
                        </div>
                      </div>
                      <p className="mt-3 text-sm text-sky-900"><span className="font-semibold">Today\'s focus:</span> {stravaDailyDashboard.nextAction}</p>
                      <div className="mt-3 text-xs text-sky-700">
                        Data window: last {stravaSync.windowDays} days • {stravaSync.activitiesFetched} activities synced.
                      </div>
                    </div>

                    <div className="rounded-xl border border-gray-200 bg-white p-4">
                      <div className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-3">
                        This Week vs Fit Target
                      </div>
                      <div className="space-y-3">
                        <div>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Miles</span>
                            <span>{stravaDailyDashboard.week.miles.current.toFixed(1)} / {stravaDailyDashboard.week.miles.goal.toFixed(0)} mi</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-blue-500"
                              style={{ width: `${Math.min(100, Math.round(stravaDailyDashboard.week.miles.progress * 100))}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Elevation</span>
                            <span>{Math.round(stravaDailyDashboard.week.elevation.current)} / {stravaDailyDashboard.week.elevation.goal.toFixed(0)} ft</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-orange-500"
                              style={{ width: `${Math.min(100, Math.round(stravaDailyDashboard.week.elevation.progress * 100))}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="flex justify-between text-xs text-gray-600 mb-1">
                            <span>Yoga Sessions</span>
                            <span>{stravaDailyDashboard.week.yoga.current.toFixed(1)} / {stravaDailyDashboard.week.yoga.goal.toFixed(0)}</span>
                          </div>
                          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500"
                              style={{ width: `${Math.min(100, Math.round(stravaDailyDashboard.week.yoga.progress * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-violet-700 font-bold mb-3">Consistency Streaks</div>
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="rounded-lg bg-white/85 p-2 border border-violet-100">
                          <div className="text-xl font-black text-violet-900">{stravaDailyDashboard.streaks.runWeeks}</div>
                          <div className="text-[10px] text-violet-700 uppercase tracking-wide">Run Weeks</div>
                        </div>
                        <div className="rounded-lg bg-white/85 p-2 border border-violet-100">
                          <div className="text-xl font-black text-violet-900">{stravaDailyDashboard.streaks.yogaWeeks}</div>
                          <div className="text-[10px] text-violet-700 uppercase tracking-wide">Yoga Weeks</div>
                        </div>
                        <div className="rounded-lg bg-white/85 p-2 border border-violet-100">
                          <div className="text-xl font-black text-violet-900">{stravaDailyDashboard.streaks.balancedWeeks}</div>
                          <div className="text-[10px] text-violet-700 uppercase tracking-wide">Run + Yoga</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                      <div className="text-xs uppercase tracking-wide text-amber-700 font-bold mb-3">6/13/26/52-Week Records</div>
                      {hasRecordData ? (
                        <div className="overflow-x-auto">
                          <table className="w-full text-xs text-left">
                            <thead className="text-amber-700">
                              <tr>
                                <th className="pr-3 pb-2">Window</th>
                                <th className="pr-3 pb-2 text-right">Longest mi</th>
                                <th className="pr-3 pb-2 text-right">Longest min</th>
                                <th className="pr-3 pb-2 text-right">Max climb</th>
                                <th className="pb-2 text-right">Longest yoga</th>
                              </tr>
                            </thead>
                            <tbody className="text-amber-900 divide-y divide-amber-100">
                              {stravaRecordRows.map((row) => (
                                <tr key={row.windowWeeks}>
                                  <td className="pr-3 py-1.5 font-semibold">{row.windowWeeks}w</td>
                                  <td className="pr-3 py-1.5 text-right">{row.runCount > 0 ? row.longestDistanceMiles.toFixed(1) : '-'}</td>
                                  <td className="pr-3 py-1.5 text-right">{row.runCount > 0 ? row.longestMovingMinutes.toFixed(0) : '-'}</td>
                                  <td className="pr-3 py-1.5 text-right">{row.runCount > 0 ? Math.round(row.highestElevationFeet).toString() : '-'}</td>
                                  <td className="py-1.5 text-right">{row.yogaCount > 0 ? row.longestYogaMinutes.toFixed(0) : '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <div className="text-xs text-amber-800 bg-white/80 border border-amber-100 rounded-lg px-3 py-2">
                          Records will appear after the next Strava sync (needs up to 52 weeks of activities).
                        </div>
                      )}
                    </div>

                    <div className="rounded-xl border border-gray-200 p-4 bg-gray-50">
                      <div className="text-xs uppercase tracking-wide text-gray-500 font-bold mb-2">Latest Sessions</div>
                      <div className="text-sm text-gray-700 space-y-1">
                        <div>Run: {stravaSync.runs.latest ? `${stravaSync.runs.latest.name} (${formatWhen(stravaSync.runs.latest.startDateLocal)})` : 'N/A'}</div>
                        <div>Yoga: {stravaSync.yoga.latest ? `${stravaSync.yoga.latest.name} (${formatWhen(stravaSync.yoga.latest.startDateLocal)})` : 'N/A'}</div>
                      </div>
                    </div>
                    <div className="text-xs text-gray-500">
                      Last updated: {formatWhen(stravaSync.generatedAt)}
                    </div>
                  </>
                ) : (
                  <div className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
                    {stravaError || 'Strava sync data is not available yet.'}
                  </div>
                )}
              </div>
            ) : (
              renderActiveChart()
            )}
            
            <div className="flex gap-4 mt-4 text-sm items-center justify-center flex-wrap">
               {activeTab === 'overview' ? (
                 <div className="text-xs text-gray-400 italic">
                    {overviewMode === 'sunburst' ? 'Hover over segments for details.' : 'The larger the triangle, the more balanced and elite your life is.'}
                 </div>
               ) : activeTab === 'strava' ? (
                 <div className="text-xs text-gray-500 italic">
                    Daily sync keeps this layer refreshed with your most recent 4 weeks of Strava runs and yoga.
                 </div>
               ) : (
                <>
                  <div className="flex flex-wrap justify-center gap-3 text-xs w-full mb-2">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{backgroundColor: PALETTE.weak}}></span>Weak</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{backgroundColor: PALETTE.avg}}></span>Avg</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{backgroundColor: PALETTE.fit}}></span>Fit</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{backgroundColor: PALETTE.elite}}></span>Elite</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100 shadow-sm">
                    <Info className="w-3 h-3" />
                    <span className="text-[10px]">Avg (33%) & Fit (66%) thresholds are auto-calculated from your Weak & Elite settings.</span>
                  </div>
                </>
               )}
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
