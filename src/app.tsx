import React, { useState, useMemo } from "react";
import {
  Target,
  Activity,
  Users,
  Edit2,
  Save,
  LayoutDashboard,
  ArrowUpCircle,
} from "lucide-react";

// ---------------------------------------------------------
// Types
// ---------------------------------------------------------

export type MetricType = "higher_better" | "lower_better";

export interface Metric {
  id: string;
  label: string;
  unit: string;
  current: number;
  weak: number;
  avg: number;
  goal: number;
  elite: number;
  type: MetricType;
}

export interface OverviewCategory {
  id: string;
  label: string;
  current: number; // 0–100 scaled
  elite: number;
  color: string;
}

interface TabInfo {
  score: number;
  color: string;
  label: string;
}

// ---------------------------------------------------------
// Data
// ---------------------------------------------------------

const PERFORMANCE_METRICS: Metric[] = [
  { id: "miles", label: "Weekly Miles", unit: "mi/wk", current: 22, weak: 3, avg: 10, goal: 20, elite: 30, type: "higher_better" },
  { id: "elevation", label: "Elevation Gain", unit: "ft/wk", current: 4100, weak: 500, avg: 800, goal: 2500, elite: 5000, type: "higher_better" },
  { id: "pushups", label: "Push Ups", unit: "reps", current: 22, weak: 10, avg: 15, goal: 30, elite: 50, type: "higher_better" },
  { id: "plank", label: "Plank", unit: "seconds", current: 110, weak: 45, avg: 60, goal: 120, elite: 240, type: "higher_better" },
  { id: "pullups", label: "Pull Ups", unit: "reps", current: 1, weak: 1, avg: 3, goal: 5, elite: 15, type: "higher_better" },
  { id: "bench", label: "Bench Press", unit: "lbs", current: 115, weak: 115, avg: 150, goal: 185, elite: 225, type: "higher_better" },
];

const MENTAL_METRICS: Metric[] = [
  { id: "reading", label: "Reading", unit: "min/wk", current: 30, weak: 0, avg: 30, goal: 60, elite: 240, type: "higher_better" },
  { id: "writing", label: "Writing", unit: "min/wk", current: 30, weak: 0, avg: 10, goal: 60, elite: 120, type: "higher_better" },
  { id: "meditation_time", label: "Meditation Time", unit: "min/wk (13w)", current: 40, weak: 0, avg: 20, goal: 60, elite: 120, type: "higher_better" },
  { id: "meditation_count", label: "Meditation Freq", unit: "sessions/wk (13w)", current: 4, weak: 0, avg: 2, goal: 4, elite: 7, type: "higher_better" },
  { id: "sleep", label: "Sleep Avg", unit: "hrs", current: 6.5, weak: 4, avg: 6, goal: 7.5, elite: 8.5, type: "higher_better" },
  { id: "fasting", label: "Fasting Window", unit: "hrs fasted/day", current: 12, weak: 8, avg: 12, goal: 16, elite: 18, type: "higher_better" },
];

const LIFESTYLE_METRICS: Metric[] = [
  { id: "community", label: "Community Events", unit: "events/mo", current: 1, weak: 0, avg: 1, goal: 2, elite: 4, type: "higher_better" },
  { id: "social", label: "Social Hours", unit: "hrs/wk", current: 4, weak: 1, avg: 3, goal: 7, elite: 14, type: "higher_better" },
  { id: "deep_work", label: "Deep Work", unit: "hrs/day", current: 2, weak: 0, avg: 1, goal: 3, elite: 5, type: "higher_better" },
  { id: "kids_hours", label: "1:1 Kids Hours", unit: "hrs/wk", current: 3, weak: 1, avg: 2, goal: 5, elite: 10, type: "higher_better" },
  { id: "creative", label: "Creative Projects", unit: "hrs/wk", current: 2, weak: 0, avg: 1, goal: 4, elite: 8, type: "higher_better" },
];

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const CHART_RADIUS = 100;
const CHART_CENTER = 150;

// ---------------------------------------------------------
// Component
// ---------------------------------------------------------

export default function PerformanceRadar() {
  const [activeTab, setActiveTab] = useState<
    "overview" | "performance" | "mental" | "lifestyle"
  >("overview");

  const [perfMetrics, setPerfMetrics] = useState<Metric[]>(PERFORMANCE_METRICS);
  const [mentalMetrics, setMentalMetrics] = useState<Metric[]>(MENTAL_METRICS);
  const [lifeMetrics, setLifeMetrics] = useState<Metric[]>(LIFESTYLE_METRICS);

  const [isEditing, setIsEditing] = useState(false);

  const currentMetrics: Metric[] =
    activeTab === "performance"
      ? perfMetrics
      : activeTab === "mental"
      ? mentalMetrics
      : activeTab === "lifestyle"
      ? lifeMetrics
      : [];

  // -------------------------------------------------------
  // Update Metric
  // -------------------------------------------------------

  const handleUpdateMetric = (id: string, field: keyof Metric, value: number) => {
    const numeric = Number(value);

    const update = (arr: Metric[], setter: React.Dispatch<React.SetStateAction<Metric[]>>) => {
      setter(arr.map((m) => (m.id === id ? { ...m, [field]: numeric } : m)));
    };

    if (perfMetrics.some((m) => m.id === id)) update(perfMetrics, setPerfMetrics);
    else if (mentalMetrics.some((m) => m.id === id)) update(mentalMetrics, setMentalMetrics);
    else if (lifeMetrics.some((m) => m.id === id)) update(lifeMetrics, setLifeMetrics);
  };

  // -------------------------------------------------------
  // Normalization
  // -------------------------------------------------------

  const normalize = (metric: Metric, value: number): number => {
    const max = metric.elite * 1.1;
    const min = 0;

    if (value <= min) return 0.02;
    if (value >= max) return 1;

    return (value - min) / (max - min);
  };

  // -------------------------------------------------------
  // Overview Score (0–100)
  // -------------------------------------------------------

  const calculateCategoryScore = (metrics: Metric[]): number => {
    if (metrics.length === 0) return 0;
    const total = metrics.reduce((acc, m) => acc + normalize(m, m.current), 0);
    return (total / metrics.length) * 100;
  };

  const overviewScores = useMemo(() => {
    const body = calculateCategoryScore(perfMetrics);
    const mind = calculateCategoryScore(mentalMetrics);
    const life = calculateCategoryScore(lifeMetrics);

    const level = Math.round((body + mind + life) / 3);

    const data: OverviewCategory[] = [
      { id: "body", label: "Body", current: body, elite: 100, color: "#2563eb" },
      { id: "mind", label: "Mind", current: mind, elite: 100, color: "#059669" },
      { id: "life", label: "Life", current: life, elite: 100, color: "#7c3aed" },
    ];

    return { body, mind, life, level, data };
  }, [perfMetrics, mentalMetrics, lifeMetrics]);

  // -------------------------------------------------------
  // Recommendation
  // -------------------------------------------------------

  const getRecommendation = (metrics: Metric[]) => {
    if (!metrics.length) return null;

    const sorted = [...metrics].sort(
      (a, b) => normalize(a, a.current) - normalize(b, b.current)
    );
    const weakest = sorted[0];

    let target: number;
    let label: string;

    if (weakest.current < weakest.weak) {
      target = weakest.weak;
      label = "Weak";
    } else if (weakest.current < weakest.avg) {
      target = weakest.avg;
      label = "Average";
    } else if (weakest.current < weakest.goal) {
      target = weakest.goal;
      label = "Fit";
    } else if (weakest.current < weakest.elite) {
      target = weakest.elite;
      label = "Elite";
    } else {
      return { metric: "All", text: "You're Elite across the board!" };
    }

    return {
      metric: weakest.label,
      text: `Improve ${weakest.label} to ${target} ${weakest.unit} to reach ${label}.`,
    };
  };

  // -------------------------------------------------------
  // SVG geometry
  // -------------------------------------------------------

  const getCoordinates = (
    value: number,
    index: number,
    total: number,
    radius: number
  ) => {
    const angle = (Math.PI * 2 * index) / total - Math.PI / 2;
    const x = Math.cos(angle) * radius * value;
    const y = Math.sin(angle) * radius * value;
    return { x, y };
  };

  const getColorForMetric = (metric: Metric) => {
    const { current, weak, avg, goal, elite } = metric;

    if (current <= weak) return { text: "text-red-500", stroke: "#ef4444", fill: "#ef4444" };
    if (current < avg) return { text: "text-slate-500", stroke: "#64748b", fill: "#64748b" };
    if (current < goal) return { text: "text-emerald-600", stroke: "#059669", fill: "#059669" };
    if (current < elite) return { text: "text-blue-600", stroke: "#2563eb", fill: "#2563eb" };
    return { text: "text-amber-500", stroke: "#f59e0b", fill: "#f59e0b" };
  };

  const getMetricRank = (metric: Metric): number => {
    if (metric.current <= metric.weak) return 0;
    if (metric.current < metric.avg) return 1;
    if (metric.current < metric.goal) return 2;
    if (metric.current < metric.elite) return 3;
    return 4;
  };

  const getOverallStatus = () => {
    if (activeTab === "overview") {
      return {
        stroke: "#6366f1",
        fill: "rgba(99, 102, 241, 0.2)",
        label: "Total",
      };
    }

    const counts: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };

    currentMetrics.forEach((m) => {
      const rank = getMetricRank(m);
      counts[rank]++;
    });

    let winner = 0;
    let max = -1;

    for (let r = 0; r <= 4; r++) {
      if (counts[r] > max) {
        max = counts[r];
        winner = r;
      }
    }

    switch (winner) {
      case 0: return { stroke: "#ef4444", fill: "rgba(239,68,68,0.2)", label: "Needs Work" };
      case 1: return { stroke: "#64748b", fill: "rgba(100,116,139,0.2)", label: "Base" };
      case 2: return { stroke: "#059669", fill: "rgba(5,150,105,0.2)", label: "Average" };
      case 3: return { stroke: "#2563eb", fill: "rgba(37,99,235,0.2)", label: "Fit" };
      case 4: return { stroke: "#f59e0b", fill: "rgba(245,158,11,0.2)", label: "Elite" };
      default: return { stroke: "#2563eb", fill: "rgba(37,99,235,0.2)", label: "Fit" };
    }
  };

  const overall = getOverallStatus();

  const getCurrentTabInfo = (): TabInfo | null => {
    if (activeTab === "performance")
      return { score: overviewScores.body, color: "#2563eb", label: "Body Score" };
    if (activeTab === "mental")
      return { score: overviewScores.mind, color: "#059669", label: "Mind Score" };
    if (activeTab === "lifestyle")
      return { score: overviewScores.life, color: "#7c3aed", label: "Life Score" };
    return null;
  };

  // -------------------------------------------------------
  // Render Chart
  // -------------------------------------------------------

  const renderChart = () => {
    const isOverview = activeTab === "overview";
    const dataToRender = isOverview ? overviewScores.data : currentMetrics;

    const bgLevels = [0.33, 0.66, 1].map((scale, i) => {
      const pts = dataToRender
        .map((_, idx) => {
          const c = getCoordinates(scale, idx, dataToRender.length, CHART_RADIUS);
          return `${CHART_CENTER + c.x},${CHART_CENTER + c.y}`;
        })
        .join(" ");
      return (
        <polygon
          key={i}
          points={pts}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={1}
          strokeDasharray={i === 2 ? "" : "4 2"}
        />
      );
    });

    const axes = dataToRender.map((item, i) => {
      const textPos = getCoordinates(1.15, i, dataToRender.length, CHART_RADIUS);
      const end = getCoordinates(1.05, i, dataToRender.length, CHART_RADIUS);

      return (
        <React.Fragment key={item.id}>
          <line
            x1={CHART_CENTER}
            y1={CHART_CENTER}
            x2={CHART_CENTER + end.x}
            y2={CHART_CENTER + end.y}
            stroke="#e5e7eb"
            strokeWidth={1}
          />
          <text
            x={CHART_CENTER + textPos.x}
            y={CHART_CENTER + textPos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className={`font-bold uppercase tracking-wide ${
              isOverview ? "text-[12px] fill-gray-800" : "text-[10px] fill-gray-500"
            }`}
          >
            {item.label}
          </text>
        </React.Fragment>
      );
    });

    const thresholds =
      isOverview
        ? null
        : (["elite", "goal", "avg", "weak"] as (keyof Metric)[]).map((key) => {
            const color =
              key === "elite"
                ? "#f59e0b"
                : key === "goal"
                ? "#3b82f6"
                : key === "avg"
                ? "#10b981"
                : "#ef4444";

            const pts = currentMetrics
              .map((m, i) => {
                const n = normalize(m, m[key]);
                const c = getCoordinates(n, i, currentMetrics.length, CHART_RADIUS);
                return `${CHART_CENTER + c.x},${CHART_CENTER + c.y}`;
              })
              .join(" ");

            return (
              <polygon
                key={key}
                points={pts}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeDasharray="4 2"
                opacity={0.4}
              />
            );
          });

    const polygonPoints = dataToRender
      .map((item, i) => {
        const value = isOverview ? item.current / 100 : normalize(item as Metric, (item as Metric).current);
        const c = getCoordinates(value, i, dataToRender.length, CHART_RADIUS);
        return `${CHART_CENTER + c.x},${CHART_CENTER + c.y}`;
      })
      .join(" ");

    const dots = dataToRender.map((item, i) => {
      const value = isOverview ? item.current / 100 : normalize(item as Metric, (item as Metric).current);
      const c = getCoordinates(value, i, dataToRender.length, CHART_RADIUS);

      const color = isOverview
        ? (item as OverviewCategory).color
        : getColorForMetric(item as Metric).stroke;

      return (
        <circle
          key={i}
          cx={CHART_CENTER + c.x}
          cy={CHART_CENTER + c.y}
          r={isOverview ? 6 : 4}
          fill="white"
          stroke={color}
          strokeWidth={3}
        />
      );
    });

    return (
      <svg viewBox="0 0 300 300" className="w-full max-w-[450px] overflow-visible mt-8">
        <circle cx={CHART_CENTER} cy={CHART_CENTER} r={2} fill="#9ca3af" />
        {bgLevels}
        {thresholds}
        {axes}

        <polygon
          points={polygonPoints}
          fill={overall.fill}
          stroke={overall.stroke}
          strokeWidth={2}
          opacity={0.8}
        />
        {dots}
      </svg>
    );
  };

  // -------------------------------------------------------
  // Render Component
  // -------------------------------------------------------

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Soul Score
          </h1>
          <p className="text-gray-500">
            Measure. Balance. Elevate your Body, Mind, and Life.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { setActiveTab("overview"); setIsEditing(false); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === "overview"
                ? "bg-gray-800 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <LayoutDashboard className="w-4 h-4 inline-block mr-2" />
            Holistic Overview
          </button>

          <div className="w-full sm:w-auto h-px sm:h-8 bg-gray-300 mx-2 hidden sm:block"></div>

          <button
            onClick={() => { setActiveTab("performance"); setIsEditing(false); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === "performance"
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Activity className="w-4 h-4 inline-block mr-2" />
            Body
          </button>

          <button
            onClick={() => { setActiveTab("mental"); setIsEditing(false); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === "mental"
                ? "bg-emerald-600 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Target className="w-4 h-4 inline-block mr-2" />
            Mind
          </button>

          <button
            onClick={() => { setActiveTab("lifestyle"); setIsEditing(false); }}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              activeTab === "lifestyle"
                ? "bg-violet-600 text-white shadow-lg"
                : "bg-white text-gray-600 hover:bg-gray-100"
            }`}
          >
            <Users className="w-4 h-4 inline-block mr-2" />
            Life
          </button>
        </div>

        {/* Main Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Radar Chart */}
          <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center relative min-h-[450px]">
            <h2 className="absolute top-6 left-6 text-lg font-bold text-gray-900 flex items-center">
              {activeTab === "overview" ? "Balance Triangle" : "Category Radar"}
            </h2>

            {activeTab === "overview" ? (
              <div className="absolute top-6 right-6 flex flex-col items-end">
                <span className="text-3xl font-black text-gray-800">Lvl {overviewScores.level}</span>
                <span className="text-xs text-gray-400 uppercase">Overall Level</span>
              </div>
            ) : (
              <div
                className="absolute top-6 right-6 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
                style={{ backgroundColor: overall.fill, color: overall.stroke }}
              >
                {overall.label}
              </div>
            )}

            {renderChart()}

            <div className="flex gap-4 mt-4 text-sm">
              {activeTab === "overview" ? (
                <div className="text-xs text-gray-400 italic">
                  The larger the triangle, the more balanced your life is.
                </div>
              ) : (
                <div className="flex flex-wrap justify-center gap-3 text-xs">
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-red-500 rounded-full"></span>Weak</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-slate-500 rounded-full"></span>Base</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-emerald-500 rounded-full"></span>Avg</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-600 rounded-full"></span>Fit</span>
                  <span className="flex items-center gap-1"><span className="w-2 h-2 bg-amber-500 rounded-full"></span>Elite</span>
                </div>
              )}
            </div>
          </div>

          {/* Details Panel */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">

            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">
                {activeTab === "overview" ? "Holistic Breakdown" : "Metrics Details"}
              </h2>

              {activeTab !== "overview" && (
                <button
                  onClick={() => setIsEditing((prev) => !prev)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isEditing ? "bg-indigo-50 text-indigo-600" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}
                >
                  {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                  {isEditing ? "Done" : "Edit Stats"}
                </button>
              )}
            </div>

            <div className="overflow-x-auto flex-1 p-6">
              {activeTab === "overview" ? (
                <>
                  {overviewScores.data.map((cat) => (
                    <div key={cat.id} className="flex items-center p-4 bg-gray-50 rounded-xl border border-gray-100 mb-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold" style={{ backgroundColor: cat.color }}>
                        {Math.round(cat.current)}
                      </div>
                      <div className="ml-4 flex-1">
                        <div className="flex justify-between mb-1">
                          <h3 className="font-bold">{cat.label} Score</h3>
                          <span className="text-xs text-gray-500">Target: 100</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                          <div className="h-2.5 rounded-full" style={{ width: `${Math.min(cat.current, 100)}%`, backgroundColor: cat.color }}></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <>
                  {/* Score + Recommendation */}
                  <div className="mb-6 grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gray-50 rounded-xl flex flex-col justify-center items-center">
                      <span className="text-xs text-gray-400 uppercase mb-1">
                        {getCurrentTabInfo()?.label}
                      </span>
                      <div className="text-3xl font-black" style={{ color: getCurrentTabInfo()?.color }}>
                        {Math.round(getCurrentTabInfo()?.score ?? 0)}
                      </div>
                    </div>

                    <div className="p-4 bg-blue-50 rounded-xl border border-blue-100 flex flex-col justify-center">
                      <div className="flex items-center gap-2 mb-1 text-blue-700 font-bold text-xs uppercase">
                        <ArrowUpCircle className="w-4 h-4" /> Next Step
                      </div>
                      <p className="text-sm text-blue-900 leading-tight">
                        {getRecommendation(currentMetrics)?.text}
                      </p>
                    </div>
                  </div>

                  {/* Table */}
                  <table className="w-full text-sm text-left">
                    <thead className="bg-gray-50 text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Metric</th>
                        <th className="px-4 py-3 text-right">Current</th>
                        <th className="px-4 py-3 text-right hidden sm:table-cell text-red-400">Weak</th>
                        <th className="px-4 py-3 text-right hidden sm:table-cell text-emerald-400">Avg</th>
                        <th className="px-4 py-3 text-right hidden sm:table-cell text-blue-400">Fit</th>
                        <th className="px-4 py-3 text-right hidden sm:table-cell text-amber-400">Elite</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {currentMetrics.map((metric) => {
                        const colors = getColorForMetric(metric);

                        return (
                          <tr key={metric.id} className="hover:bg-gray-50">
                            <td className="px-4 py-4 font-medium text-gray-900">
                              {metric.label}
                              <div className="text-xs text-gray-400">{metric.unit}</div>
                            </td>

                            <td className="px-4 py-4 text-right">
                              {isEditing ? (
                                <input
                                  type="number"
                                  className="w-16 px-2 py-1 text-right border rounded bg-white"
                                  value={metric.current}
                                  onChange={(e) =>
                                    handleUpdateMetric(metric.id, "current", Number(e.target.value))
                                  }
                                />
                              ) : (
                                <span className={`font-bold ${colors.text}`}>
                                  {metric.current}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-4 text-right hidden sm:table-cell text-gray-400">
                              {metric.weak}
                            </td>
                            <td className="px-4 py-4 text-right hidden sm:table-cell text-gray-400">
                              {metric.avg}
                            </td>
                            <td className="px-4 py-4 text-right hidden sm:table-cell text-gray-400">
                              {metric.goal}
                            </td>
                            <td className="px-4 py-4 text-right hidden sm:table-cell text-gray-400">
                              {metric.elite}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </>
              )}
            </div>

            {activeTab !== "overview" && (
              <div className="p-4 bg-gray-50 border-t border-gray-100 text-xs text-center text-gray-500 italic">
                Try to get “Current” above “Weak”.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
