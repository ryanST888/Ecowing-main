import React, { useEffect, useState } from 'react';
import { Language } from '../types';
import { TRANSLATIONS } from '../constants';
import {
  BarChart3, Trash2, AlertTriangle, Crosshair, FileClock,
  LayoutGrid, List as ListIcon, FolderOpen, Calendar, MapPin, XCircle
} from 'lucide-react';
// Note: We will move the card components inside here for this example, 
// or you can pass the delete function down as a prop if they are separate files.

interface DashboardProps {
  lang: Language;
}

export interface WasteReport {
  id: string;
  timestamp: number;
  latitude: number;
  longitude: number;
  severity: any;
  imageUrl?: string;
  message?: string;
  status: 'pending' | 'verified' | 'cleaned';
}

// --- STATIC MOCK DATA ---
const STATIC_REPORTS: WasteReport[] = [
  {
    id: "RPT-2026-001",
    timestamp: Date.now() - 3600000 * 2,
    latitude: 22.3193,
    longitude: 114.1694,
    severity: 'HIGH',
    imageUrl: "https://images.unsplash.com/photo-1618477461853-cf6ed80faba5?q=80&w=600&auto=format&fit=crop",
    message: "Large accumulation of plastic bottles trapped between rocks.",
    status: 'pending'
  }
];

// --- UPDATED FOLDER ITEM (Now with a Delete Button) ---
const FolderItem = ({ report, onDelete }: { report: WasteReport, onDelete: (id: string) => void }) => (
  <div className="group bg-[#151e2e] border border-white/5 rounded-2xl overflow-hidden hover:border-emerald-500/50 transition-all duration-300 hover:shadow-xl relative">

    {/* Delete Button (Appears on hover) */}
    <button
      onClick={() => onDelete(report.id)}
      className="absolute top-2 right-2 z-20 bg-red-500/80 hover:bg-red-500 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-md"
      title="Delete this report"
    >
      <XCircle size={18} />
    </button>

    <div className="aspect-[4/3] w-full bg-slate-800 relative overflow-hidden">
      <img src={report.imageUrl} alt="Evidence" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
      <div className="absolute inset-0 bg-gradient-to-t from-[#151e2e] to-transparent opacity-60 pointer-events-none"></div>
    </div>
    <div className="p-4">
      <h4 className="text-white font-bold text-sm mb-1">{report.id}</h4>
      <p className="text-xs text-slate-400 truncate">{report.message}</p>
    </div>
  </div>
);

// --- UPDATED LIST ITEM (Now with a Delete Button) ---
const ListItem = ({ report, onDelete }: { report: WasteReport, onDelete: (id: string) => void }) => (
  <div className="bg-[#151e2e] border border-white/5 rounded-xl p-4 flex items-center justify-between hover:border-emerald-500/30 transition-colors">
    <div className="flex items-center gap-4">
      <img src={report.imageUrl} className="w-12 h-12 rounded-lg object-cover" alt="thumb" />
      <div>
        <h4 className="text-white font-bold">{report.id}</h4>
        <p className="text-xs text-slate-400">{new Date(report.timestamp).toLocaleString()}</p>
      </div>
    </div>

    {/* Delete Button */}
    <button
      onClick={() => onDelete(report.id)}
      className="text-slate-500 hover:text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
      title="Delete Report"
    >
      <Trash2 size={18} />
    </button>
  </div>
);


const Dashboard: React.FC<DashboardProps> = ({ lang }) => {
  const t = TRANSLATIONS[lang];
  const [viewMode, setViewMode] = useState<'list' | 'folder'>('folder'); // Set folder as default

  const [allReports, setAllReports] = useState<WasteReport[]>(STATIC_REPORTS);

  // Load Data on Mount
  useEffect(() => {
    const savedData = localStorage.getItem('ecoWingReports');
    if (savedData) {
      try {
        const userReports = JSON.parse(savedData);
        setAllReports([...userReports, ...STATIC_REPORTS]);
      } catch (e) {
        console.error("Failed to load reports", e);
      }
    }
  }, []);

  // --- NEW: DELETE FUNCTION ---
  const handleDelete = (idToDelete: string) => {
    // 1. Confirm with the user
    if (!window.confirm("Are you sure you want to delete this report?")) return;

    // 2. Remove from the screen (React State)
    const updatedReports = allReports.filter(report => report.id !== idToDelete);
    setAllReports(updatedReports);

    // 3. Update Local Storage so it stays deleted if you refresh
    // Note: We only save user-generated reports to local storage, not the static mock ones.
    const userReportsOnly = updatedReports.filter(r => !STATIC_REPORTS.find(sr => sr.id === r.id));
    localStorage.setItem('ecoWingReports', JSON.stringify(userReportsOnly));
  };

  return (
    <div className="min-h-screen bg-[#0b1121] text-white p-6 md:p-10 pb-32 overflow-y-auto custom-scrollbar">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Header */}
        <div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">{t.navDashboard}</h1>
        </div>

        {/* SUBMISSION HISTORY & FOLDER */}
        <div className="pt-8 border-t border-white/5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-4">
              <FileClock size={24} className="text-emerald-400" />
              <h2 className="text-2xl font-bold text-white tracking-tight">Evidence Folder</h2>
            </div>

            {/* View Toggles */}
            <div className="flex bg-[#0f172a] p-1 rounded-lg border border-white/10">
              <button onClick={() => setViewMode('list')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'list' ? 'bg-slate-700 text-white' : 'text-slate-500'}`}>
                <ListIcon size={16} /> List
              </button>
              <button onClick={() => setViewMode('folder')} className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-bold transition-all ${viewMode === 'folder' ? 'bg-emerald-600 text-white' : 'text-slate-500'}`}>
                <LayoutGrid size={16} /> Folder
              </button>
            </div>
          </div>

          <div className="animate-fade-in">
            {viewMode === 'list' ? (
              <div className="space-y-4">
                {allReports.map((report, idx) => (
                  <ListItem key={idx} report={report} onDelete={handleDelete} />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {allReports.map((report, idx) => (
                  <FolderItem key={idx} report={report} onDelete={handleDelete} />
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