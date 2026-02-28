import React, { useEffect, useState } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import {
    BarChart3, Trash2, AlertTriangle, Crosshair, FileClock,
    LayoutGrid, List as ListIcon, FolderOpen, Calendar, MapPin
} from 'lucide-react';
import ReportHistoryCard from './ReportHistoryCard';

interface DashboardProps {
    lang: Language;
}

export interface WasteReport {
    id: string;
    timestamp: number;
    latitude: number;
    longitude: number;
    severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    imageUrl?: string;
    message?: string;
    status: 'pending' | 'verified' | 'cleaned';
    category?: string;
    waste_distribution?: Record<string, number>;
}

const STATIC_REPORTS: WasteReport[] = [];

const AppleDonutChart = ({ reports, lang }: { reports: any[], lang: Language }) => {
    const total = reports.length;
    const high = reports.filter(r => r.severity === 'HIGH' || r.severity === 'CRITICAL').length;
    const medium = reports.filter(r => r.severity === 'MEDIUM').length;
    const low = reports.filter(r => r.severity === 'LOW').length;

    const safeTotal = total === 0 ? 1 : total;

    const lowPct = (low / safeTotal) * 100;
    const medPct = (medium / safeTotal) * 100;
    const highPct = (high / safeTotal) * 100;

    const lowDash = `${Math.max(0, lowPct > 0 ? lowPct - 2 : 0)} 100`;
    const medDash = `${Math.max(0, medPct > 0 ? medPct - 2 : 0)} 100`;
    const highDash = `${Math.max(0, highPct > 0 ? highPct - 2 : 0)} 100`;

    const medOffset = -lowPct;
    const highOffset = -(lowPct + medPct);

    return (
        <div className="relative w-56 h-56 flex items-center justify-center">
            <style>{`@keyframes ringFill { from { stroke-dasharray: 0, 100; } }`}</style>
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                <path className="text-slate-800" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
                {low > 0 && <path className="text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]" style={{ animation: 'ringFill 1.5s cubic-bezier(0.4, 0, 0.2, 1) forwards' }} strokeDasharray={lowDash} strokeDashoffset="0" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
                {medium > 0 && <path className="text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" style={{ animation: 'ringFill 1.8s cubic-bezier(0.4, 0, 0.2, 1) forwards' }} strokeDasharray={medDash} strokeDashoffset={medOffset} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
                {high > 0 && <path className="text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.4)]" style={{ animation: 'ringFill 2.1s cubic-bezier(0.4, 0, 0.2, 1) forwards' }} strokeDasharray={highDash} strokeDashoffset={highOffset} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />}
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-5xl font-bold text-white tracking-tighter">{total}</span>
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-widest mt-1">
                    {lang === Language.EN ? 'Total Reports' : '總報告'}
                </span>
            </div>
        </div>
    );
};

const AppleBarChart = ({ reports, lang }: { reports: any[], lang: Language }) => {
    const counts: Record<string, number> = { Plastic: 0, Metal: 0, Glass: 0, Paper: 0, Fabric: 0, Rubber: 0, Wood: 0, Other: 0 };

    reports.forEach(r => {
        let totalCounted = 0;
        if (r.waste_distribution) {
            Object.values(r.waste_distribution).forEach(val => {
                totalCounted += Number(val) || 0;
            });
        }

        if (totalCounted > 0) {
            Object.entries(r.waste_distribution).forEach(([type, count]) => {
                const cat = type.toLowerCase();
                const num = Number(count) || 0;
                if (cat.includes('plastic')) counts.Plastic += num;
                else if (cat.includes('metal')) counts.Metal += num;
                else if (cat.includes('glass') || cat.includes('ceramic')) counts.Glass += num;
                else if (cat.includes('paper') || cat.includes('cardboard')) counts.Paper += num;
                else if (cat.includes('fabric') || cat.includes('cloth')) counts.Fabric += num;
                else if (cat.includes('rubber')) counts.Rubber += num;
                else if (cat.includes('wood')) counts.Wood += num;
                else counts.Other += num;
            });
        } else {
            const cat = String(r.category || r.type || 'Other').toLowerCase();
            if (cat.includes('plastic')) counts.Plastic++;
            else if (cat.includes('metal')) counts.Metal++;
            else if (cat.includes('glass') || cat.includes('ceramic')) counts.Glass++;
            else if (cat.includes('paper') || cat.includes('cardboard')) counts.Paper++;
            else if (cat.includes('fabric') || cat.includes('cloth')) counts.Fabric++;
            else if (cat.includes('rubber')) counts.Rubber++;
            else if (cat.includes('wood')) counts.Wood++;
            else counts.Other++;
        }
    });

    const maxCount = Math.max(...Object.values(counts), 1);

    const bars = [
        { label: lang === Language.EN ? 'Plastic' : '塑膠', count: counts.Plastic, height: `${(counts.Plastic / maxCount) * 100}%`, color: 'from-emerald-400 to-emerald-600' },
        { label: lang === Language.EN ? 'Metal' : '金屬', count: counts.Metal, height: `${(counts.Metal / maxCount) * 100}%`, color: 'from-emerald-500/80 to-emerald-700/80' },
        { label: lang === Language.EN ? 'Glass' : '玻璃', count: counts.Glass, height: `${(counts.Glass / maxCount) * 100}%`, color: 'from-emerald-500/60 to-emerald-700/60' },
        { label: lang === Language.EN ? 'Paper' : '紙張', count: counts.Paper, height: `${(counts.Paper / maxCount) * 100}%`, color: 'from-emerald-500/60 to-emerald-700/60' },
        { label: lang === Language.EN ? 'Fabric' : '布料', count: counts.Fabric, height: `${(counts.Fabric / maxCount) * 100}%`, color: 'from-blue-400 to-blue-600' },
        { label: lang === Language.EN ? 'Rubber' : '橡膠', count: counts.Rubber, height: `${(counts.Rubber / maxCount) * 100}%`, color: 'from-purple-400 to-purple-600' },
        { label: lang === Language.EN ? 'Wood' : '木材', count: counts.Wood, height: `${(counts.Wood / maxCount) * 100}%`, color: 'from-emerald-500/80 to-emerald-700/80' },
        { label: lang === Language.EN ? 'Other' : '其他', count: counts.Other, height: `${(counts.Other / maxCount) * 100}%`, color: 'from-slate-400 to-slate-600' },
    ];

    return (
        <div className="flex items-end justify-between h-56 w-full px-2 gap-2">
            <style>{`@keyframes growUp { from { height: 0; opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }`}</style>
            {bars.map((bar, idx) => (
                <div key={idx} className="flex flex-col items-center w-full gap-3 group h-full justify-end relative">
                    <div className="w-full relative flex items-end h-full">
                        <div className={`w-full rounded-t-lg bg-gradient-to-t ${bar.color} shadow-[0_0_10px_rgba(16,185,129,0.1)] group-hover:shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all duration-300 relative group`} style={{ height: bar.height, animation: `growUp 1s cubic-bezier(0.34, 1.56, 0.64, 1) forwards ${idx * 0.05}s`, opacity: 0 }}>
                            <span className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs font-bold py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50">
                                {bar.count}
                            </span>
                        </div>
                    </div>
                    <span className="text-[8px] md:text-[9px] font-bold text-slate-500 uppercase tracking-wider text-center whitespace-nowrap">{bar.label}</span>
                </div>
            ))}
        </div>
    );
};

const FolderItem = ({ report, lang }: { report: WasteReport, lang: Language }) => {
    const safeDate = report.timestamp ? new Date(report.timestamp).toLocaleDateString() : "Unknown Date";

    const activeCategories = report.waste_distribution
        ? Object.entries(report.waste_distribution)
            .filter(([_, count]) => count > 0)
            .map(([type]) => type.toUpperCase())
        : [];

    let defaultCat = String(report.category || 'OTHER').toUpperCase();
    if (lang === Language.ZH) {
        if (defaultCat === 'PLASTIC') defaultCat = '塑膠';
        else if (defaultCat === 'METAL') defaultCat = '金屬';
        else if (defaultCat === 'GLASS') defaultCat = '玻璃';
        else if (defaultCat === 'PAPER') defaultCat = '紙張';
        else if (defaultCat === 'FABRIC') defaultCat = '布料';
        else if (defaultCat === 'RUBBER') defaultCat = '橡膠';
        else if (defaultCat === 'WOOD') defaultCat = '木材';
        else defaultCat = '其他';
    }

    const displayCategories = activeCategories.length > 0
        ? activeCategories
        : [defaultCat];

    return (
        <div className="group bg-[#151e2e] border border-white/5 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 cursor-pointer">
            <div className="aspect-[4/3] w-full bg-slate-800 relative overflow-hidden">
                <img src={report.imageUrl || "https://via.placeholder.com/400"} alt="Evidence" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#151e2e] to-transparent opacity-60"></div>
                <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 pr-2">
                    <span className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-black/50 backdrop-blur-md border border-white/10 text-white`}>
                        {String(report.severity || "UNKNOWN").toUpperCase()}
                    </span>
                    {displayCategories.map((cat, idx) => (
                        <span key={idx} className={`text-[10px] font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-blue-500/50 backdrop-blur-md border border-blue-400/50 text-white`}>
                            {cat}
                        </span>
                    ))}
                </div>
            </div>
            <div className="p-4">
                <div className="flex items-center gap-2 mb-2 text-emerald-400">
                    <FolderOpen size={16} />
                    <span className="text-xs font-bold uppercase tracking-widest">
                        {lang === Language.EN ? 'Evidence File' : '證據文件'}
                    </span>
                </div>
                <h4 className="text-white font-bold text-sm mb-1 line-clamp-1">{report.id || "Unknown ID"}</h4>
                <div className="flex items-center gap-4 text-slate-500 text-xs mt-2">
                    <span className="flex items-center gap-1"><Calendar size={12} /> {safeDate}</span>
                </div>
            </div>
        </div>
    );
};

const Dashboard: React.FC<DashboardProps> = ({ lang }) => {
    const t = TRANSLATIONS[lang] || TRANSLATIONS[Language.EN] || { navDashboard: "Dashboard" };
    const [viewMode, setViewMode] = useState<'list' | 'folder'>('list');
    const [allReports, setAllReports] = useState<WasteReport[]>(STATIC_REPORTS);

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const response = await fetch('http://localhost:8000/api/history');

                if (response.ok) {
                    const backendReports = await response.json();

                    if (Array.isArray(backendReports)) {
                        const safeReports: WasteReport[] = backendReports.map((item: any) => ({
                            ...item,
                            latitude: item.latitude !== undefined ? item.latitude : (item.lat || 0),
                            longitude: item.longitude !== undefined ? item.longitude : (item.lng || 0),
                            category: item.category || item.type || 'Other',
                            waste_distribution: item.waste_distribution || {},
                            severity: item.severity || 'MEDIUM',
                            message: item.message || item.description || 'No description provided.',
                            imageUrl: item.imageUrl || 'https://via.placeholder.com/400',
                            id: item.id || `RPT-${Math.floor(Math.random() * 10000)}`,
                            status: item.status || 'pending',
                            timestamp: item.timestamp || Date.now()
                        }));

                        setAllReports([...safeReports, ...STATIC_REPORTS]);
                    } else {
                        setAllReports(STATIC_REPORTS);
                    }
                } else {
                    setAllReports(STATIC_REPORTS);
                }
            } catch (e) {
                setAllReports(STATIC_REPORTS);
            }
        };

        fetchReports();
    }, []);

    if (!t) return <div className="min-h-screen bg-[#0b1121] flex items-center justify-center text-white">Loading Dashboard...</div>;

    return (
        <div className="min-h-screen bg-[#0b1121] text-white p-6 md:p-10 pb-32 overflow-y-auto custom-scrollbar font-sans selection:bg-emerald-500/30">
            <div className="max-w-7xl mx-auto space-y-12">

                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 border-b border-white/5 pb-8">
                    <div>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">{t.navDashboard || "Dashboard"}</h1>
                        <p className="text-slate-400 text-lg font-light tracking-wide">
                            {lang === Language.EN ? 'Real-time analytics & insights.' : '實時分析與見解。'}
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm font-medium text-emerald-400 bg-emerald-500/10 px-4 py-2 rounded-full border border-emerald-500/20">
                        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></div>
                        {lang === Language.EN ? 'System Online' : '系統在線'}
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {[
                        { label: lang === Language.EN ? "Reports" : "總報告", value: String(allReports.length), icon: <BarChart3 size={20} />, color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
                        { label: lang === Language.EN ? "Cleaned Area" : "清理面積", value: "0 m²", icon: <Trash2 size={20} />, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/20" },
                        {
                            label: lang === Language.EN ? "High Risk" : "高風險",
                            value: String(allReports.filter(r => r.severity === 'HIGH' || r.severity === 'CRITICAL').length),
                            icon: <AlertTriangle size={20} />, color: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20"
                        },
                        { label: lang === Language.EN ? "Active Drones" : "活躍無人機", value: "0", icon: <Crosshair size={20} />, color: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" }
                    ].map((stat, idx) => (
                        <div key={idx} className="group bg-[#151e2e] hover:bg-[#1a2436] p-6 rounded-2xl border border-white/5 shadow-lg transition-all duration-300 hover:-translate-y-1">
                            <div className="flex items-start justify-between mb-4">
                                <div className={`p-3 rounded-xl ${stat.bg} ${stat.color} ${stat.border} border`}>{stat.icon}</div>
                            </div>
                            <div>
                                <h4 className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{stat.label}</h4>
                                <p className="text-3xl font-bold text-white tracking-tight">{stat.value}</p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="bg-[#151e2e] rounded-3xl border border-white/5 p-8 flex flex-col items-center relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none"></div>
                        <div className="w-full flex justify-between items-center mb-2 z-10">
                            <h3 className="text-white font-bold text-xl tracking-tight">
                                {lang === Language.EN ? 'Severity Overview' : '嚴重程度概覽'}
                            </h3>
                        </div>
                        <p className="w-full text-slate-400 text-sm mb-8 z-10">
                            {lang === Language.EN ? 'Distribution of waste risk levels.' : '垃圾風險等級分佈。'}
                        </p>

                        <AppleDonutChart reports={allReports} lang={lang} />

                        <div className="mt-8 w-full flex justify-center gap-8 z-10">
                            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.5)]"></span><span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{lang === Language.EN ? 'High' : '高'}</span></div>
                            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.5)]"></span><span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{lang === Language.EN ? 'Medium' : '中'}</span></div>
                            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]"></span><span className="text-xs font-bold text-slate-300 uppercase tracking-wider">{lang === Language.EN ? 'Low' : '低'}</span></div>
                        </div>
                    </div>
                    <div className="bg-[#151e2e] rounded-3xl border border-white/5 p-8 flex flex-col relative overflow-hidden shadow-2xl">
                        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-bl from-blue-500/5 to-transparent pointer-events-none"></div>
                        <div className="z-10 mb-8">
                            <h3 className="text-white font-bold text-xl tracking-tight">
                                {lang === Language.EN ? 'Material Composition' : '材料成分'}
                            </h3>
                            <p className="text-slate-400 text-sm">
                                {lang === Language.EN ? 'Breakdown of detected debris types.' : '檢測到的垃圾類型細分。'}
                            </p>
                        </div>

                        <div className="flex-1 flex items-end z-10"><AppleBarChart reports={allReports} lang={lang} /></div>

                    </div>
                </div>

                <div className="pt-8 border-t border-white/5">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-white border border-white/10 shadow-inner">
                                <FileClock size={20} />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold text-white tracking-tight">
                                    {lang === Language.EN ? 'Recent Submissions' : '最新提交'}
                                </h2>
                                <p className="text-slate-400 text-sm">
                                    {lang === Language.EN ? 'Real-time logs from drone reconnaissance.' : '來自無人機偵察的實時日誌。'}
                                </p>
                            </div>
                        </div>

                        <div className="flex bg-[#0f172a] p-1 rounded-lg border border-white/10">
                            <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-slate-700 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                                <ListIcon size={16} /> {lang === Language.EN ? 'List' : '列表'}
                            </button>
                            <button onClick={() => setViewMode('folder')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'folder' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500 hover:text-white'}`}>
                                <LayoutGrid size={16} /> {lang === Language.EN ? 'Folder' : '文件夾'}
                            </button>
                        </div>
                    </div>

                    <div className="animate-fade-in">
                        {viewMode === 'list' ? (
                            <div className="space-y-4">
                                {allReports.map((report, idx) => (
                                    <ReportHistoryCard key={`${report.id}-${idx}`} report={report} lang={lang} />
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                                {allReports.map((report, idx) => (
                                    <FolderItem key={`${report.id}-${idx}`} report={report} lang={lang} />
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Dashboard;