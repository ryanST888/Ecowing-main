import { useState } from 'react';
import { Calendar, MapPin, ChevronDown, ChevronUp, Tag, Image as ImageIcon, MessageSquare, Trash2, Loader2, User } from 'lucide-react';
import { Language } from '../types';

interface CardProps {
    report: {
        id: string;
        timestamp: number | string;
        latitude: number | string;
        longitude: number | string;
        severity: string;
        imageUrl?: string;
        message?: string;
        status?: string;
        category?: string; 
        waste_distribution?: Record<string, number>; 
        user_id?: string | null;
        username?: string;
    };
    lang: Language;
    onDelete?: (id: string) => void;
    isDeleting?: boolean;
}

const ReportHistoryCard = ({ report, lang, onDelete, isDeleting = false }: CardProps) => {
    const [isExpanded, setIsExpanded] = useState(false);

    const getSeverityColor = (sev: string) => {
        switch(sev) {
            case 'CRITICAL': return 'bg-red-500/20 text-red-400 border-red-500/30';
            case 'HIGH': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
            case 'MEDIUM': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
            case 'LOW': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
            default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
        }
    };

    const safeDate = report.timestamp ? new Date(report.timestamp).toLocaleString('en-US', {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    }) : "Unknown Date";

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
        <div className="bg-[#151e2e] border border-white/5 rounded-2xl overflow-hidden transition-all hover:border-slate-600 shadow-lg">
            <div 
                className="p-4 flex items-center justify-between cursor-pointer hover:bg-slate-800/50 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-4 w-full">
                    <img src={report.imageUrl || "https://via.placeholder.com/150"} alt="thumb" className="w-12 h-12 rounded-lg object-cover bg-slate-800 border border-white/10 shrink-0" />
                    <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-2 mb-1.5">
                            <h4 className="text-white font-bold text-base mr-1">{report.id}</h4>
                            
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getSeverityColor(report.severity)}`}>
                                {report.severity}
                            </span>

                            {displayCategories.map((cat, idx) => (
                                <span key={idx} className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-blue-500/20 text-blue-400 border-blue-500/30 uppercase tracking-wider flex items-center gap-1">
                                    <Tag size={10} /> {cat}
                                </span>
                            ))}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-slate-400">
                            <span className="flex items-center gap-1"><Calendar size={12} /> {safeDate}</span>
                            <span className="flex items-center gap-1"><MapPin size={12} /> {Number(report.latitude).toFixed(4)}, {Number(report.longitude).toFixed(4)}</span>
                            <span className="flex items-center gap-1"><User size={12} /> {report.username || 'Anonymous'}</span>
                        </div>
                    </div>
                </div>
                <div className="text-slate-500 pr-2 shrink-0 flex items-center gap-2">
                    {onDelete && (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                onDelete(report.id);
                            }}
                            disabled={isDeleting}
                            className="h-9 w-9 inline-flex items-center justify-center rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 transition-colors hover:bg-red-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                            title={lang === Language.EN ? 'Delete report' : '刪除報告'}
                            aria-label={lang === Language.EN ? `Delete ${report.id}` : `刪除 ${report.id}`}
                        >
                            {isDeleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        </button>
                    )}
                    {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                </div>
            </div>

            {isExpanded && (
                <div className="p-5 border-t border-slate-700/50 bg-[#1a2436] grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                    <div>
                        <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <ImageIcon size={14} /> {lang === Language.EN ? 'Evidence Photo' : '證據照片'}
                        </h5>
                        <div className="bg-[#0b1121] rounded-xl overflow-hidden h-56 border border-slate-700 flex items-center justify-center shadow-inner">
                            <img src={report.imageUrl || "https://via.placeholder.com/400"} className="max-h-full max-w-full object-contain" alt="Evidence full" />
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <h5 className="text-xs font-bold text-emerald-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <MessageSquare size={14} /> {lang === Language.EN ? 'Operator Message' : '操作員信息'}
                        </h5>
                        <div className="bg-[#151e2e] rounded-xl p-5 text-sm text-slate-300 italic border border-slate-700/50 flex-1 shadow-inner leading-relaxed">
                            "{report.message || (lang === Language.EN ? "No message provided." : "未提供信息。")}"
                        </div>
                        
                        <div className="mt-5 flex justify-between items-center border-t border-slate-700/50 pt-4">
                            <span className="text-xs text-slate-500 font-medium">
                                {lang === Language.EN ? 'Current Status:' : '當前狀態：'}
                            </span>
                            <span className="text-[10px] font-bold px-4 py-1.5 rounded-full bg-indigo-500/20 text-indigo-400 uppercase tracking-wider border border-indigo-500/30">
                                {report.status === 'pending' && lang === Language.ZH ? '待處理' : report.status || 'PENDING'}
                            </span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ReportHistoryCard;
