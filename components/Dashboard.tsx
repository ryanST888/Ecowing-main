import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from 'recharts';
import { WasteDataPoint, Severity, Language } from '../types';
import { COLORS, TRANSLATIONS, WASTE_CATEGORIES } from '../constants';
import { AlertTriangle, Trash2, Activity, MapPin } from 'lucide-react';

interface DashboardProps {
  data: WasteDataPoint[];
  lang: Language;
  onSiteClick?: (locationName: string) => void; // For site details
}

// For site rankings
interface SiteData {
  location: string;
  totalItems: number;
  reports: number;
  severity: string;
  lat?: number;
  lng?: number;
  lastUpdated: string;
  allLat: number[];
  allLng: number[];
}

const Dashboard: React.FC<DashboardProps> = ({ data, lang, onSiteClick }) => {
  const t = TRANSLATIONS[lang];
  const [selectedCategory, setSelectedCategory] = React.useState<string | null>(null);

  // Process data for charts
  const severityCounts = data.reduce((acc, curr) => {
    acc[curr.severity] = (acc[curr.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pieData = Object.keys(severityCounts).map(key => ({
    name: key,
    value: severityCounts[key]
  }));

  // Type Counts (Fixed Categories)
  /*
  const typeCounts = data.reduce((acc, curr) => {
    // Map Unidentified/Unknown to Others
    let type = curr.type;
    if (!type || type === 'Unknown' || type === 'Unidentified') type = 'Others';

    // If type is not in our standard list, group into Others
    if (!WASTE_CATEGORIES.includes(type) && type !== 'Others') {
      type = 'Others';
    }

    // Correction to counting items
    const itemCount = curr.boundingBoxes?.length || 1;
    acc[type] = (acc[type] || 0) + itemCount;
    // acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  */
  // Type Counts - Use waste_distribution if available from Qwen
  const typeCounts = data.reduce((acc, curr) => {
    // 1. First try to use waste_distribution from Qwen analysis
    if (curr.waste_distribution) {
      Object.entries(curr.waste_distribution).forEach(([wasteType, count]) => {
        let type = wasteType;
        if (type === "Plastic") type = "Plastic";
        else if (type === "Metal") type = "Metal";
        else if (type === "Glass") type = "Glass";
        else if (type === "Paper") type = "Paper";
        else if (type === "Fabric") type = "Fabric";
        else if (type === "Rubber") type = "Rubber";
        else if (type === "Wood") type = "Wood";
        else type = "Other";
        acc[type] = (acc[type] || 0) + (count as number);
      });
    }
    // 2. Fallback: Count bounding boxes by type from labels
    /*
    else if (curr.boundingBoxes?.length) {
      // Group boxes by waste type
      const boxTypes: Record<string, number> = {};

      curr.boundingBoxes.forEach(box => {
        const label = box.label || '';
        let type = 'Others';

        if (label.includes('Plastic')) type = 'Plastic';
        else if (label.includes('Metal')) type = 'Metal';
        else if (label.includes('Glass')) type = 'Glass';
        else if (label.includes('Paper')) type = 'Paper';
        else if (label.includes('Fabric')) type = 'Fabric';
        else if (label.includes('Rubber')) type = 'Rubber';
        else if (label.includes('Wood')) type = 'Wood';
        else if (label.includes('Other')) type = 'Other';

        boxTypes[type] = (boxTypes[type] || 0) + 1;
      });

      Object.entries(boxTypes).forEach(([type, count]) => {
        acc[type] = (acc[type] || 0) + count;
      });
    }
    */
    // 3. Last resort: Use type field
    else {
      let type = curr.type || 'Other';
      if (!WASTE_CATEGORIES.includes(type)) type = 'Other';
      acc[type] = (acc[type] || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  // Ensure all big categories are present, even if 0
  /*
  const barData = WASTE_CATEGORIES.map(cat => ({
    name: cat,
    count: typeCounts[cat] || 0
  }));
  */
  // Then create barData from ALL types found, not just WASTE_CATEGORIES
  const allTypes = Array.from(new Set([
    ...WASTE_CATEGORIES,
    ...Object.keys(typeCounts)
  ]));

  const barData = allTypes.map(cat => ({
    name: cat,
    count: typeCounts[cat] || 0
  }));

  // Drill-down data for selected category
  const drillDownData = React.useMemo(() => {
    if (!selectedCategory) return {};

    return data
      .filter(d => {
        let type = d.type;
        if (!type || type === 'Unknown' || type === 'Unidentified') type = 'Other';
        if (!WASTE_CATEGORIES.includes(type) && type !== 'Other') type = 'Other';
        return type === selectedCategory;
      })
      .reduce((acc, curr) => {
        const sub = curr.subType || (lang === Language.EN ? 'Unspecified' : '未指定');
        acc[sub] = (acc[sub] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
  }, [data, selectedCategory, lang]);

  const drillDownChartData = Object.keys(drillDownData).map(key => ({
    name: key,
    value: drillDownData[key]
  }));

  // Site ranking by total waste items
  const siteRankings = data.reduce((acc, curr) => {
    // Find if this report belongs to an existing nearby site
    const coordinatesMatchThreshold = 0.01; // ~1km difference

    let matchedSiteKey = null;

    for (const [existingKey, siteData] of Object.entries(acc)) {
      // Check if location name is similar (case-insensitive partial match)
      const nameMatch = siteData.location.toLowerCase().includes(curr.locationName?.toLowerCase() || "") ||
        (curr.locationName?.toLowerCase() || "").includes(siteData.location.toLowerCase());

      // Check if coordinates are close
      const latDiff = Math.abs((siteData.lat || 0) - (curr.lat || 0));
      const lngDiff = Math.abs((siteData.lng || 0) - (curr.lng || 0));
      const coordMatch = latDiff < coordinatesMatchThreshold && lngDiff < coordinatesMatchThreshold;

      if (nameMatch || coordMatch) {
        matchedSiteKey = existingKey;
        break;
      }
    }

    // Create a unique site key if no match found
    const siteKey = matchedSiteKey || `${curr.locationName || "Unknown"}-${curr.lat?.toFixed(4)}-${curr.lng?.toFixed(4)}`;

    if (!acc[siteKey]) {
      acc[siteKey] = {
        location: curr.locationName || "Unknown Location",
        totalItems: 0,
        reports: 0,
        severity: curr.severity,
        lat: curr.lat,
        lng: curr.lng,
        lastUpdated: curr.timestamp,
        // Store all coordinates for averaging later if needed
        allLat: [curr.lat],
        allLng: [curr.lng]
      };
    } else {
      // Add coordinates to arrays for averaging
      if (curr.lat && curr.lng) {
        acc[siteKey].allLat.push(curr.lat);
        acc[siteKey].allLng.push(curr.lng);
        // Calculate average coordinates
        acc[siteKey].lat = acc[siteKey].allLat.reduce((a, b) => a + b, 0) / acc[siteKey].allLat.length;
        acc[siteKey].lng = acc[siteKey].allLng.reduce((a, b) => a + b, 0) / acc[siteKey].allLng.length;
      }
    }

    // Calculate waste items for this report
    let itemCount = 0;
    if (curr.waste_distribution) {
      // Sum all items from waste_distribution
      itemCount = Object.values(curr.waste_distribution).reduce((sum: number, count) => sum + (count as number), 0);
    } else if (curr.unique_item_count) {
      itemCount = curr.unique_item_count;
    } else if (curr.boundingBoxes?.length) {
      itemCount = curr.boundingBoxes.length;
    } else {
      itemCount = 1; // Fallback
    }

    acc[siteKey].totalItems += itemCount;
    acc[siteKey].reports += 1;

    // Update to highest severity
    const severityOrder: Record<string, number> = { "CRITICAL": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1 };
    const currentSeverity = curr.severity as string;
    const existingSeverity = acc[siteKey].severity as string;

    if (severityOrder[currentSeverity] > severityOrder[existingSeverity]) {
      acc[siteKey].severity = currentSeverity;
    }

    return acc;
  }, {} as Record<string, SiteData>);

  // Convert to array and sort by total items (descending)
  const rankedSites = Object.values(siteRankings)
    .sort((a, b) => b.totalItems - a.totalItems)
    .slice(0, 10); // Top 10 sites

  // Severity color mapping
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "CRITICAL": return "bg-red-500";
      case "HIGH": return "bg-orange-500";
      case "MEDIUM": return "bg-yellow-500";
      case "LOW": return "bg-green-500";
      default: return "bg-gray-500";
    }
  };

  const StatsCard = ({ title, value, icon: Icon, color }: any) => (
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg flex items-center space-x-4">
      <div className={`p-4 rounded-full bg-opacity-20 ${color} bg-white`}>
        <Icon size={24} className={color.replace('bg-', 'text-')} />
      </div>
      <div>
        <p className="text-slate-400 text-sm font-medium">{title}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title={t.statsTotalReports}
          value={data.length}
          icon={Activity}
          color="text-emerald-400"
        />
        <StatsCard
          title={t.statsCleaned}
          value="0"
          icon={Trash2}
          color="text-yellow-400"
        />
        <StatsCard
          title={t.statsHighRisk}
          value={data.filter(d => d.severity === Severity.CRITICAL || d.severity === Severity.HIGH).length}
          icon={AlertTriangle}
          color="text-rose-500"
        />
        <StatsCard
          title={lang === Language.EN ? "Active Drones" : "活躍無人機"}
          value="0"
          icon={MapPin}
          color="text-cyan-400"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Severity Distribution */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <h3 className="text-lg font-semibold mb-4 text-white">{lang === Language.EN ? "Severity Distribution" : "嚴重程度分佈"}</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              {pieData.length > 0 ? (
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => {
                      // <Cell key={`cell-${index}`} fill={[COLORS.success, COLORS.secondary, COLORS.primary, COLORS.danger][index % 4]} />
                      // Map severity names to colors
                      let fillColor;
                      switch (entry.name) {
                        case "CRITICAL":
                          fillColor = "#ef4444"; // red-500
                          break;
                        case "HIGH":
                          fillColor = "#f97316"; // orange-500
                          break;
                        case "MEDIUM":
                          fillColor = "#facc15"; // yellow-500
                          break;
                        case "LOW":
                          fillColor = "#10b981"; // emerald-500
                          break;
                        default:
                          fillColor = COLORS.primary;
                      }
                      return <Cell key={`cell-${index}`} fill={fillColor} />;
                    })}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: COLORS.card, borderColor: COLORS.dark, color: '#fff' }}
                    itemStyle={{ color: '#fff' }}
                  />
                  <Legend />
                </PieChart>
              ) : (
                <div className="h-full flex items-center justify-center text-slate-500 text-sm">
                  {lang === Language.EN ? "No data available" : "暫無數據"}
                </div>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Waste Composition */}
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-white">{lang === Language.EN ? "Waste Composition" : "垃圾成分分析"}</h3>
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-xs text-emerald-400 hover:text-emerald-300 underline"
              >
                {lang === Language.EN ? "Reset View" : "重置視圖"}
              </button>
            )}
          </div>

          <div className="h-64 flex gap-4">
            {/* Main Bar Chart */}
            <div className={`transition-all duration-300 ${selectedCategory ? 'w-1/2' : 'w-full'}`}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} onClick={(data: any) => data && data.activePayload && setSelectedCategory(data.activePayload[0].payload.name)}>
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
                  <YAxis stroke="#94a3b8" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                    contentStyle={{ backgroundColor: COLORS.card, borderColor: COLORS.dark, color: '#fff' }}
                  />
                  <Bar dataKey="count" fill={COLORS.primary} radius={[4, 4, 0, 0]} cursor="pointer" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Drill Down Side Panel */}
            {selectedCategory && (
              <div className="w-1/2 bg-slate-900/50 rounded-lg p-4 animate-fade-in border border-slate-600 overflow-y-auto">
                <h4 className="text-sm font-bold text-emerald-400 mb-3 border-b border-slate-600 pb-2">
                  {selectedCategory} {lang === Language.EN ? "Details" : "詳情"}
                </h4>
                {drillDownChartData.length > 0 ? (
                  <ul className="space-y-2">
                    {drillDownChartData.map((item, idx) => (
                      <li key={idx} className="flex justify-between text-xs text-slate-300">
                        <span>{item.name}</span>
                        <span className="font-mono text-white bg-slate-700 px-1.5 rounded">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500 italic">
                    {lang === Language.EN ? "No details available." : "無詳細資料。"}
                  </p>
                )}
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 text-center">
            {lang === Language.EN ? "Click a bar to see details." : "點擊長條圖查看詳情。"}
          </p>
        </div>
      </div>

      {/* Site Ranking Card */}
      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">
            {lang === Language.EN ? "Top Waste Sites" : "最多垃圾地點"}
          </h3>
          <span className="text-xs text-slate-400">
            {lang === Language.EN ? "Ranked by total items" : "按垃圾數量排序"}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left py-2 px-3 text-slate-400 font-medium">
                  {lang === Language.EN ? "Location" : "地點"}
                </th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">
                  {lang === Language.EN ? "Waste Items" : "垃圾數量"}
                </th>
                <th className="text-right py-2 px-3 text-slate-400 font-medium">
                  {lang === Language.EN ? "Reports" : "報告數"}
                </th>
              </tr>
            </thead>
            <tbody>
              {rankedSites.length > 0 ? (
                rankedSites.map((site, index) => (
                  <tr
                    key={index}
                    className="border-b border-slate-800 hover:bg-slate-700/30 transition-colors"
                    onClick={() => onSiteClick?.(site.location)} // For site details
                  >
                    <td className="py-3 px-3">
                      <div className="flex items-center">
                        <div className={`w-3 h-3 rounded-full mr-3 ${getSeverityColor(site.severity)}`}></div>
                        <div>
                          <div className="font-medium text-white truncate max-w-[200px]">
                            {site.location}
                          </div>
                          <div className="text-xs text-slate-500">
                            {site.severity}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="font-bold text-white">{site.totalItems}</span>
                      <div className="text-xs text-slate-500">
                        {lang === Language.EN ? "items" : "件"}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-slate-300">{site.reports}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={3} className="py-4 text-center text-slate-500">
                    {lang === Language.EN ? "No site data available" : "暫無地點數據"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {rankedSites.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-700">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center space-x-4">
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 mr-1"></div>
                  <span>Critical</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mr-1"></div>
                  <span>Medium</span>
                </div>
                <div className="flex items-center">
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-1"></div>
                  <span>Low</span>
                </div>
              </div>
              <div>
                {lang === Language.EN ? "Showing top " : "顯示前 "}{rankedSites.length}{lang === Language.EN ? " sites" : " 個地點"}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;