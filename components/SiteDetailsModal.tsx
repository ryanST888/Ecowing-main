import React from 'react';
import { WasteDataPoint, Language } from '../types';
import { MapPin, X, BarChart3, AlertTriangle } from 'lucide-react';

interface SiteDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    siteData: {
        locationName: string;
        totalItems: number;
        reports: number;
        severity: string;
        lat?: number;
        lng?: number;
        wasteDistribution?: Record<string, number>;
    };
    reports: WasteDataPoint[];
    lang: Language;
}

const SiteDetailsModal: React.FC<SiteDetailsModalProps> = ({
    isOpen,
    onClose,
    siteData,
    reports,
    lang
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[1000] flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
                <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-500/20 rounded-lg">
                            <MapPin className="text-emerald-400" size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{siteData.locationName}</h2>
                            <p className="text-slate-400 text-sm">
                                {reports.length} {lang === 'EN' ? 'reports' : '個報告'}
                            </p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-2">
                        <X size={24} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[calc(80vh-120px)]">
                    {/* Simple Waste Summary */}
                    <div className="mb-6">
                        <h3 className="text-lg font-semibold mb-3 text-white flex items-center gap-2">
                            <BarChart3 size={20} />
                            {lang === 'EN' ? 'Waste Summary' : '垃圾總結'}
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-slate-900/50 p-3 rounded-lg">
                                <div className="text-xs text-slate-400">Total Items</div>
                                <div className="text-xl font-bold text-white">{siteData.totalItems}</div>
                            </div>
                            <div className="bg-slate-900/50 p-3 rounded-lg">
                                <div className="text-xs text-slate-400">Severity</div>
                                <div className={`text-xl font-bold ${siteData.severity === 'CRITICAL' ? 'text-red-500' :
                                    siteData.severity === 'HIGH' ? 'text-orange-500' :
                                        siteData.severity === 'MEDIUM' ? 'text-yellow-500' : 'text-green-500'
                                    }`}>
                                    {siteData.severity}
                                </div>
                            </div>
                            {/* <div className="bg-slate-900/50 p-3 rounded-lg">
                                <div className="text-xs text-slate-400">Priority</div>
                                <div className={`text-sm font-bold ${siteData.severity === 'CRITICAL' || siteData.severity === 'HIGH'
                                        ? 'text-red-400' : 'text-yellow-400'
                                    }`}>
                                    {siteData.severity === 'CRITICAL' || siteData.severity === 'HIGH'
                                        ? (lang === 'EN' ? 'HIGH' : '高')
                                        : (lang === 'EN' ? 'MEDIUM' : '中')}
                                </div>
                            </div> */}
                        </div>
                    </div>

                    {/* Waste Distribution */}
                    {siteData.wasteDistribution && (
                        <div className="mb-6">
                            <h4 className="font-semibold mb-2 text-white">
                                {lang === 'EN' ? 'Waste Types Found' : '發現的垃圾類型'}
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {Object.entries(siteData.wasteDistribution).map(([type, count]) => (
                                    <div key={type} className="bg-slate-700 px-3 py-1 rounded-full text-sm">
                                        <span className="text-white">{type}</span>
                                        <span className="text-emerald-400 ml-1 font-bold">{count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recent Photos */}
                    <div>
                        <h4 className="font-semibold mb-3 text-white flex items-center gap-2">
                            <AlertTriangle size={18} />
                            {lang === 'EN' ? 'Recent Evidence' : '最近證據'}
                        </h4>
                        <div className="grid grid-cols-2 gap-3">
                            {reports.slice(0, 4).map((report, idx) => (
                                <div key={idx} className="bg-slate-900/50 rounded-lg overflow-hidden border border-slate-700">
                                    {report.mediaUrl && (
                                        <img
                                            src={report.mediaUrl}
                                            alt=""
                                            className="w-full h-24 object-cover"
                                        />
                                    )}
                                    <div className="p-2">
                                        <div className="text-xs text-slate-400">{report.type}</div>
                                        <div className="text-xs text-slate-500 truncate">
                                            {new Date(report.timestamp).toLocaleDateString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SiteDetailsModal;