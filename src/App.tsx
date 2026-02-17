import React, { useMemo, useState } from 'react';
import { Edit2, Save, ArrowUpCircle, Info, PieChart, Triangle, HelpCircle, Trophy, AlertCircle, Sparkles } from 'lucide-react';
import CategoryTabs from './components/CategoryTabs';
import WeekSelector from './components/WeekSelector';
import { BODY_METRICS, FAMILY_METRICS, MIND_METRICS, PALETTE, SOCIAL_METRICS } from './data/metrics';
import { useWeeklyMetrics } from './hooks/useWeeklyMetrics';
import type { ActiveTab, Category, CategoryScoreSummary, EditableMetricField, HoveredPoint, Metric, MetricRank, OverviewDatum, OverviewMode } from './types';
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

export default function PerformanceRadar() {
  // ---- CORE STATE ----
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [overviewMode, setOverviewMode] = useState<OverviewMode>('sunburst');
  const [hoveredPoint, setHoveredPoint] = useState<HoveredPoint | null>(null);
  const [weekKey, setWeekKey] = useState(getWeekKey());
  const [isEditing, setIsEditing] = useState(false);

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

  const currentMetrics = activeTab === 'overview' ? [] : metricsByCategory[activeTab];

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

  const currentTabInfo = activeTab === 'overview' ? null : tabInfoByCategory[activeTab];

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
    return renderRadar();
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
