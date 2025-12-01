import React, { useState, useMemo } from 'react';
import { Target, Activity, Users, Heart, Edit2, Save, LayoutDashboard, ArrowUpCircle, Info, PieChart, Triangle, HelpCircle, Trophy, AlertCircle, Sparkles } from 'lucide-react';

// --- ARTISTIC PALETTE (Monet Inspired) ---
const PALETTE = {
  weak:   '#D65D5D', // Terra Cotta Red
  avg:    '#6DA36D', // Fern Green
  fit:    '#5D8AA8', // Giverny Blue
  elite:  '#E6A35C', // Sunset Gold
  
  // Category Colors
  body:   '#2563eb', // Blue
  mind:   '#059669', // Emerald Green
  family: '#7c3aed', // Purple
  social: '#db2777', // Pink
  
  slate:  '#64748b'
};

// --- STATIC HELPERS ---
const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
  var angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
  return {
    x: centerX + (radius * Math.cos(angleInRadians)),
    y: centerY + (radius * Math.sin(angleInRadians))
  };
};

const describeArc = (x, y, innerRadius, outerRadius, startAngle, endAngle) => {
    var start = polarToCartesian(x, y, outerRadius, endAngle);
    var end = polarToCartesian(x, y, outerRadius, startAngle);
    var startInner = polarToCartesian(x, y, innerRadius, endAngle);
    var endInner = polarToCartesian(x, y, innerRadius, startAngle);

    var largeArcFlag = endAngle - startAngle <= 180 ? "0" : "1";

    return [
        "M", start.x, start.y, 
        "A", outerRadius, outerRadius, 0, largeArcFlag, 0, end.x, end.y,
        "L", endInner.x, endInner.y,
        "A", innerRadius, innerRadius, 0, largeArcFlag, 1, startInner.x, startInner.y,
        "Z"
    ].join(" ");
};

const autoThresholds = (baseMetric) => {
  const { weak, elite } = baseMetric;
  const range = elite - weak;
  
  const round = (num) => {
    if (Math.abs(num) >= 100) {
        return Math.round(num / 10) * 10;
    }
    return Math.round(num);
  };

  return {
    ...baseMetric,
    avg: round(weak + (range * 0.33)),
    goal: round(weak + (range * 0.66))
  };
};

// --- Data Sets (7 Metrics Each) ---

const BODY_METRICS = [
  { id: 'miles', label: 'Miles', unit: 'mi/wk', current: 22, weak: 3, elite: 30, type: 'higher_better', 
    desc: 'Total weekly running volume.', tip: 'Increase mileage by max 10% per week to build durability without injury.' },
  { id: 'elevation', label: 'Elevation', unit: 'ft/wk', current: 3600, weak: 500, elite: 4000, type: 'higher_better',
    desc: 'Vertical feet climbed per week.', tip: 'Incorporate one dedicated hill repeat session or incline treadmill walk weekly.' },
  { id: 'vo2max', label: 'VO2 Max', unit: 'ml/kg/min', current: 58, weak: 35, elite: 55, type: 'higher_better',
    desc: 'Maximum rate of oxygen consumption.', tip: 'HIIT (High Intensity Interval Training) is the most efficient way to boost this.' },
  { id: 'pushups', label: 'Push Ups', unit: 'max reps', current: 22, weak: 10, elite: 50, type: 'higher_better',
    desc: 'Max consecutive pushups.', tip: 'Do daily sets of 50% your max reps. Grease the groove.' },
  { id: 'plank', label: 'Plank', unit: 'seconds', current: 110, weak: 45, elite: 240, type: 'higher_better',
    desc: 'Core isometric hold time.', tip: 'Focus on active tension (squeezing glutes and abs) rather than just hanging on.' },
  { id: 'pullups', label: 'Pull Ups', unit: 'reps', current: 1, weak: 1, elite: 15, type: 'higher_better',
    desc: 'Max strict pullups.', tip: 'Use "negatives" (jumping up and lowering slowly) to build initial strength.' },
  { id: 'bench', label: 'Bench', unit: 'lbs', current: 115, weak: 115, elite: 225, type: 'higher_better',
    desc: '1-Rep Max Bench Press.', tip: 'Focus on progressive overload; add small fractional weights every session.' },
].map(autoThresholds); 

const MIND_METRICS = [
  { id: 'meditation_count', label: 'Meditate', unit: 'count/wk', current: 5, weak: 0, elite: 7, type: 'higher_better',
    desc: 'Number of meditation sessions.', tip: 'Attach meditation to an existing habit (e.g., right after coffee) to ensure consistency.' },
  { id: 'meditation_time', label: 'Length', unit: 'min/wk', current: 50, weak: 0, elite: 120, type: 'higher_better',
    desc: 'Total minutes of meditation.', tip: 'Start small. Even 5 minutes counts. Extend by 1 minute every week.' },
  { id: 'reading', label: 'Reading', unit: 'min/wk', current: 30, weak: 0, elite: 240, type: 'higher_better',
    desc: 'Time spent reading books.', tip: 'Read 10 pages every morning before looking at your phone.' },
  { id: 'writing', label: 'Writing', unit: 'min/wk', current: 30, weak: 0, elite: 120, type: 'higher_better',
    desc: 'Time spent journaling or writing.', tip: 'Try "Morning Pages": 3 pages of stream-of-consciousness writing first thing.' },
  { id: 'sleep', label: 'Sleep', unit: 'hrs', current: 6.5, weak: 4, elite: 8, type: 'higher_better',
    desc: 'Average nightly sleep.', tip: 'No screens 60 minutes before bed. Keep your room cool (65°F).' },
  { id: 'fasting', label: 'Fasting', unit: 'hrs/day', current: 12, weak: 8, elite: 18, type: 'higher_better',
    desc: 'Daily fasting window.', tip: 'Stop eating 3 hours before bed. It improves sleep and naturally extends your fast.' },
  { id: 'deep_work', label: 'Deep Work', unit: 'hrs/wk', current: 8, weak: 0, elite: 16, type: 'higher_better',
    desc: 'Hours of distraction-free focus.', tip: 'Use the Pomodoro technique or block "Do Not Disturb" hours on your calendar.' }, 
].map(autoThresholds);

const FAMILY_METRICS = [
  { id: 'kids_time', label: 'Kid Time', unit: 'hrs/wk', current: 8, weak: 1, elite: 10, type: 'higher_better',
    desc: 'Focused 1:1 time with children.', tip: 'Let the child lead the play. Put your phone in another room.' },
  { id: 'rituals', label: 'Rituals', unit: 'events/wk', current: 2, weak: 0, elite: 7, type: 'higher_better',
    desc: 'Recurring family traditions.', tip: 'Establish a simple weekly anchor like Friday Pizza Night or Sunday Pancakes.' },
  { id: 'adventures', label: 'Adventures', unit: 'outings/mo', current: 2, weak: 0, elite: 4, type: 'higher_better',
    desc: 'Novel family outings.', tip: 'Explore a new local park or hiking trail once a month.' },
  { id: 'date_night', label: 'Date Night', unit: 'count/mo', current: 3, weak: 0, elite: 4, type: 'higher_better',
    desc: 'Dedicated partner connection.', tip: 'Take turns planning the date to share the mental load.' }, 
  { id: 'phone_free', label: 'Phone Free', unit: 'hrs/day', current: 1, weak: 0, elite: 4, type: 'higher_better',
    desc: ' hours at home without devices.', tip: 'Create a "phone jail" box for dinner time and keep it there until kids sleep.' }, 
  { id: 'family_mtg', label: 'Fam Meeting', unit: 'count/mo', current: 1, weak: 0, elite: 4, type: 'higher_better',
    desc: 'Family coordination/culture sync.', tip: 'Discuss "Rose, Thorn, Bud" (good, bad, potential) for the week.' }, 
  { id: 'parents', label: 'Family Contact', unit: 'calls/wk', current: 2, weak: 0, elite: 3, type: 'higher_better',
    desc: 'Connecting with extended family.', tip: 'Schedule a recurring calendar event for calls so it doesn\'t slip.' }, 
].map(autoThresholds);

const SOCIAL_METRICS = [
  { id: 'creative', label: 'Creative', unit: 'hrs/wk', current: 2, weak: 0, elite: 10, type: 'higher_better',
    desc: 'Time on creative expression.', tip: 'Focus on the process of making, not the quality of the result.' },
  { id: 'community', label: 'Community', unit: 'events/mo', current: 0, weak: 0, elite: 4, type: 'higher_better',
    desc: 'Community participation events.', tip: 'Become a "regular" somewhere (coffee shop, gym, park) to build loose ties.' },
  { id: 'connection', label: 'Connection', unit: 'hrs/wk', current: 6, weak: 1, elite: 14, type: 'higher_better',
    desc: 'Deep social connection time.', tip: 'Schedule a recurring walk or coffee with a close friend.' },
  { id: 'hosting', label: 'Hosting', unit: 'events/mo', current: 0, weak: 0, elite: 2, type: 'higher_better',
    desc: 'Hosting gatherings.', tip: 'Keep it simple (potluck or game night) so it is low stress to repeat.' }, 
  { id: 'networking', label: 'Network', unit: 'acts/wk', current: 2, weak: 0, elite: 5, type: 'higher_better',
    desc: 'Professional outreach acts.', tip: 'Reach out to one person you admire just to ask a specific question.' }, 
  { id: 'mentorship', label: 'Mentoring', unit: 'hrs/mo', current: 0, weak: 0, elite: 5, type: 'higher_better',
    desc: 'Time spent mentoring others.', tip: 'Offer to help someone junior to you with a specific skill you have mastered.' }, 
  { id: 'service', label: 'Service', unit: 'acts/mo', current: 1, weak: 0, elite: 4, type: 'higher_better',
    desc: 'Acts of service/volunteering.', tip: 'Find a local cause you care about and commit just one hour a month.' }, 
].map(autoThresholds);

// --- Config Constants ---
const CHART_RADIUS = 120;
const CHART_CENTER = 150;

export default function PerformanceRadar() {
  const [activeTab, setActiveTab] = useState('overview'); 
  const [overviewMode, setOverviewMode] = useState('sunburst'); 
  const [hoveredPoint, setHoveredPoint] = useState(null); 
  
  const [bodyMetrics, setBodyMetrics] = useState(BODY_METRICS);
  const [mindMetrics, setMindMetrics] = useState(MIND_METRICS);
  const [familyMetrics, setFamilyMetrics] = useState(FAMILY_METRICS);
  const [socialMetrics, setSocialMetrics] = useState(SOCIAL_METRICS);
  
  const [isEditing, setIsEditing] = useState(false);

  const currentMetrics = activeTab === 'body' ? bodyMetrics : 
                         activeTab === 'mind' ? mindMetrics : 
                         activeTab === 'family' ? familyMetrics :
                         activeTab === 'social' ? socialMetrics : [];

  const handleUpdateMetric = (id, field, value) => {
    const val = parseFloat(value) || 0;
    const update = (prev) => prev.map(m => m.id === id ? { ...m, [field]: val } : m).map(autoThresholds);
    
    if (bodyMetrics.some(m => m.id === id)) setBodyMetrics(update);
    else if (mindMetrics.some(m => m.id === id)) setMindMetrics(update);
    else if (familyMetrics.some(m => m.id === id)) setFamilyMetrics(update);
    else if (socialMetrics.some(m => m.id === id)) setSocialMetrics(update);
  };

  // --- Chart Math ---
  const normalize = (metric, value) => {
    const { weak, elite, type } = metric;
    const val = Number.isFinite(value) ? value : 0;
    const w = Number.isFinite(weak) ? weak : 0;
    const e = Number.isFinite(elite) ? elite : 0;

    if (w === e) return 0;

    if (type === 'lower_better') {
      const min = e; 
      const max = w;  
      const clamped = Math.min(Math.max(val, min), max);
      return (max - clamped) / (max - min); 
    }
    
    const min = w;
    const max = e;
    const clamped = Math.min(Math.max(val, min), max);
    return (clamped - min) / (max - min);
  };

  const getVisualRadius = (normalizedValue) => {
    if (normalizedValue <= 0.33) return 0.05 + (normalizedValue / 0.33) * 0.55;
    if (normalizedValue <= 0.66) return 0.60 + ((normalizedValue - 0.33) / 0.33) * 0.20;
    return 0.80 + ((normalizedValue - 0.66) / 0.34) * 0.20;
  };

  const calculateCategoryScore = (metricsList) => {
    if (!metricsList || metricsList.length === 0) return 0;
    const totalProgress = metricsList.reduce((acc, m) => {
        const norm = normalize(m, m.current);
        const validNorm = Number.isFinite(norm) ? norm : 0;
        return acc + (validNorm / 0.66) * 100;
    }, 0);
    return Math.round(totalProgress / metricsList.length);
  };

  const overviewScores = useMemo(() => {
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

  const getRecommendation = (metricsList) => {
    if (!metricsList || metricsList.length === 0) return null;
    const sorted = [...metricsList].sort((a, b) => normalize(a, a.current) - normalize(b, b.current));
    const weakest = sorted[0];
    
    const isLowerBetter = weakest.type === 'lower_better';
    const isWorse = (curr, thr) => isLowerBetter ? curr > thr : curr < thr;

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

      const quoteMap = {
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

  const getCoordinates = (value, index, total, radius) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const val = Number.isFinite(value) ? value : 0;
    return { 
      x: Math.cos(angle) * radius * val, 
      y: Math.sin(angle) * radius * val 
    };
  };

  const generatePath = (dataItems, valueKey, radius, center) => {
    return dataItems.map((item, i) => {
      let nVal;
      if (activeTab === 'overview') {
        nVal = Math.min(item.current / 100, 1.0);
      } else {
        nVal = getVisualRadius(normalize(item, item[valueKey]));
      }
      const coords = getCoordinates(nVal, i, dataItems.length, radius);
      return `${center + coords.x},${center + coords.y}`;
    }).join(' ');
  };

  const getColorForMetric = (metric) => {
    const { current, avg, goal, elite, type } = metric;
    const isLowerBetter = type === 'lower_better';
    const passes = (val, threshold) => isLowerBetter ? val <= threshold : val >= threshold;

    if (passes(current, elite)) return { stroke: PALETTE.elite, fill: PALETTE.elite }; 
    if (passes(current, goal)) return { stroke: PALETTE.fit, fill: PALETTE.fit };     
    if (passes(current, avg)) return { stroke: PALETTE.avg, fill: PALETTE.avg };      
    return { stroke: PALETTE.weak, fill: PALETTE.weak };
  };

  const getMetricRank = (metric) => {
    const { current, avg, goal, elite, type } = metric;
    const isLowerBetter = type === 'lower_better';
    const passes = (val, threshold) => isLowerBetter ? val <= threshold : val >= threshold;

    if (passes(current, elite)) return 3; 
    if (passes(current, goal)) return 2;  
    if (passes(current, avg)) return 1;   
    return 0;                             
  };

  const getOverallStatus = () => {
    if (activeTab === 'overview') return { stroke: "#6366f1", fill: "rgba(99, 102, 241, 0.2)", label: "Total" }; 
    
    const counts = { 0: 0, 1: 0, 2: 0, 3: 0 };
    currentMetrics.forEach(m => {
        const rank = getMetricRank(m);
        counts[rank] = (counts[rank] || 0) + 1;
    });

    let winningRank = 3;
    let maxCount = -1;

    for (let r = 3; r >= 0; r--) {
       if (counts[r] >= maxCount) {
         maxCount = counts[r];
         winningRank = r;
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
  
  const currentTabInfo = activeTab === 'body' ? { score: overviewScores.body, color: PALETTE.body } :
                         activeTab === 'mind' ? { score: overviewScores.mind, color: PALETTE.mind } :
                         activeTab === 'family' ? { score: overviewScores.family, color: PALETTE.family } :
                         activeTab === 'social' ? { score: overviewScores.social, color: PALETTE.social } : null;

  // --- Render Components ---

  const renderSunburst = () => {
    const allGroups = [
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
      
      let textAnchor = "middle";
      if (coords.x > 10) textAnchor = "start";
      else if (coords.x < -10) textAnchor = "end";

      let dominantBaseline = "middle";
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

    const mainPoints = generatePath(dataToRender, 'current', CHART_RADIUS, CHART_CENTER);

    const dots = dataToRender.map((item, i) => {
      let nVal;
      let dotColor;
      
      if (isOverview) {
          nVal = Math.min(item.current / 100, 1.0);
          dotColor = item.color;
      } else {
          nVal = getVisualRadius(normalize(item, item.current));
          dotColor = getColorForMetric(item).stroke;
      }
      
      const coords = getCoordinates(nVal, i, dataToRender.length, CHART_RADIUS);
      
      return (
        <g key={item.id} 
           onMouseEnter={() => setHoveredPoint({ x: CHART_CENTER + coords.x, y: CHART_CENTER + coords.y, val: item.current, unit: item.unit || '', label: item.label })}
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
    return renderRadar();
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Base Layer</h1>
          <p className="text-gray-500">Integrate Your Parts. Master Your Life</p>
        </div>

        <div className="flex flex-wrap justify-center gap-2">
           <button onClick={() => { setActiveTab('overview'); setIsEditing(false); }} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'overview' ? 'bg-gray-800 text-white shadow-lg shadow-gray-400' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            <LayoutDashboard className="w-4 h-4 inline-block mr-2" /> Overview
          </button>
          <div className="w-full sm:w-auto h-px sm:h-8 bg-gray-300 mx-2 hidden sm:block"></div>
          <button onClick={() => { setActiveTab('body'); setIsEditing(false); }} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'body' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            <Activity className="w-4 h-4 inline-block mr-2" /> Body
          </button>
          <button onClick={() => { setActiveTab('mind'); setIsEditing(false); }} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'mind' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            <Target className="w-4 h-4 inline-block mr-2" /> Mind
          </button>
          <button onClick={() => { setActiveTab('family'); setIsEditing(false); }} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'family' ? 'bg-violet-600 text-white shadow-lg shadow-violet-200' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            <Heart className="w-4 h-4 inline-block mr-2" /> Family
          </button>
          <button onClick={() => { setActiveTab('social'); setIsEditing(false); }} className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${activeTab === 'social' ? 'bg-pink-600 text-white shadow-lg shadow-pink-200' : 'bg-white text-gray-600 hover:bg-gray-100'}`}>
            <Users className="w-4 h-4 inline-block mr-2" /> Social
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
          {/* RIGHT COLUMN MOVED TO LEFT: Data Table / Overview Stats */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col order-last lg:order-first">
            <div className="p-6 border-b border-gray-100 bg-white">
                <div className="flex justify-between items-start mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            {activeTab === 'overview' ? 'Holistic Breakdown' : 'Metrics Details'}
                        </h2>
                        {activeTab !== 'overview' && (
                            <div className="flex items-center gap-2 mt-1">
                                <span className="text-sm font-semibold text-gray-500">Category Score:</span>
                                <span className="text-2xl font-black" style={{ color: currentTabInfo?.color }}>
                                    {currentTabInfo?.score.toFixed(0)}
                                </span>
                            </div>
                        )}
                    </div>
                    {activeTab !== 'overview' && (
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
                     {activeTab === 'overview' ? <Sparkles className="w-4 h-4" /> : <ArrowUpCircle className="w-4 h-4" />} 
                     {activeTab === 'overview' ? 'Insight of the Day' : 'Next Best Action'}
                   </div>
                   <p className="text-base text-blue-900 font-medium">
                     {activeTab === 'overview' ? insights.quote : getRecommendation(currentMetrics)?.text}
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
                              <span className="font-bold transition-colors duration-500" style={{color: colors.fill}}>{metric.current}</span>
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
               {activeTab === 'overview' ? (overviewMode === 'sunburst' ? 'All Metrics' : 'Summary Triangle') : 'Category Radar'}
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
            ) : (
               <div className="absolute top-6 right-6 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider transition-colors duration-500 shadow-sm" style={{ backgroundColor: overall.stroke, color: '#fff' }}>
                  {overall.label}
               </div>
            )}
            
            {renderActiveChart()}
            
            <div className="flex gap-4 mt-4 text-sm items-center justify-center flex-wrap">
               {activeTab === 'overview' ? (
                 <div className="text-xs text-gray-400 italic">
                    {overviewMode === 'sunburst' ? 'Hover over segments for details.' : 'The larger the triangle, the more balanced and elite your life is.'}
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