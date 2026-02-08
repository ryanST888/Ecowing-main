import React, { useEffect, useRef, useState, useMemo } from 'react';
import { WasteDataPoint, Severity, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { Navigation, Filter, Calendar } from 'lucide-react';
import * as L from 'leaflet';

interface CoastalMapProps {
  data: WasteDataPoint[];
  lang: Language;
  onVerify?: (report: WasteDataPoint) => void;
  onDelete?: (id: string) => void;
  onSiteClick?: (locationName: string) => void;
}

const CoastalMap: React.FC<CoastalMapProps> = ({ data, lang, onVerify, onDelete, onSiteClick }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const t = TRANSLATIONS[lang];

  // Filter States (Restored)
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [dateRange, setDateRange] = useState<'ALL' | 'WEEK' | 'MONTH'>('ALL');

  // Extract unique waste types for filter dropdown
  const availableTypes = useMemo(() => {
    const types = new Set(data.map(d => d.type));
    return ['ALL', ...Array.from(types)];
  }, [data]);

  // Filter Data Logic
  const filteredData = useMemo(() => {
    const now = new Date();
    return data.filter(point => {
      // Type Filter
      if (filterType !== 'ALL' && point.type !== filterType) return false;

      // Severity Filter
      if (filterSeverity !== 'ALL' && point.severity !== filterSeverity) return false;

      // Date Filter
      if (dateRange !== 'ALL') {
        const pointDate = new Date(point.timestamp);
        const diffTime = Math.abs(now.getTime() - pointDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        if (dateRange === 'WEEK' && diffDays > 7) return false;
        if (dateRange === 'MONTH' && diffDays > 30) return false;
      }

      return true;
    });
  }, [data, filterType, filterSeverity, dateRange]);

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (mapInstanceRef.current) return;

    // Initialize Map (Default to HK, but will zoom to bounds)
    const map = L.map(mapContainerRef.current, {
      center: [22.3193, 114.1694],
      zoom: 11,
      scrollWheelZoom: true,
      dragging: true,
      zoomControl: true,
      attributionControl: false
    });

    L.control.attribution({ prefix: false }).addAttribution('&copy; OpenStreetMap &copy; CARTO').addTo(map);

    mapInstanceRef.current = map;

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(map);

    const resizeObserver = new ResizeObserver(() => {
      map.invalidateSize();
    });
    resizeObserver.observe(mapContainerRef.current);

    setTimeout(() => {
      map.invalidateSize();
    }, 200);

    return () => {
      resizeObserver.disconnect();
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update markers when data or filters change
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const map = mapInstanceRef.current;

    // Clear existing layers
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });

    const markers: L.Marker[] = [];

    filteredData.forEach(point => {
      let color = '#10b981'; // Low
      if (point.severity === Severity.MEDIUM) color = '#facc15'; // Yellow
      if (point.severity === Severity.HIGH) color = '#f97316'; // Orange
      if (point.severity === Severity.CRITICAL) color = '#ef4444'; // Red

      const customIcon = L.divIcon({
        className: 'custom-div-icon',
        html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px ${color}; border: 2px solid white;"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
        popupAnchor: [0, -10]
      });

      const marker = L.marker([point.lat, point.lng], { icon: customIcon }).addTo(map);
      markers.push(marker);

      // Unique ID for the buttons
      const btnId = `verify-btn-${point.id}`;
      const delBtnId = `delete-btn-${point.id}`;

      const popupContent = `
        <div class="p-2 min-w-[200px]">
          <div class="flex justify-between items-start mb-1">
            <h3 class="font-bold text-sm text-white cursor-pointer hover:text-emerald-400" 
                onclick="window.parentSiteClick && window.parentSiteClick('${point.locationName}')">
              ${point.locationName}
            </h3>
            ${onDelete ? `<button id="${delBtnId}" class="text-red-400 hover:text-red-300 transition-colors" title="Delete"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg></button>` : ''}
          </div>
          <div class="text-xs text-slate-300 mb-2">
            <p><strong>${lang === Language.EN ? 'Type' : '類型'}:</strong> ${point.type}</p>
            <p><strong>${lang === Language.EN ? 'Severity' : '嚴重程度'}:</strong> <span style="color:${color}">${point.severity}</span></p>
          </div>
          ${point.mediaUrl ?
          (point.mediaType === 'video'
            ? `<video src="${point.mediaUrl}" controls class="w-full h-24 object-cover rounded bg-black mb-2"></video>`
            : `<img src="${point.mediaUrl}" class="w-full h-24 object-cover rounded mb-2" />`
          )
          : ''}
          <div class="text-[10px] text-slate-500 mb-2">${new Date(point.timestamp).toLocaleString()}</div>
          <button id="${btnId}" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors">
            ${lang === Language.EN ? 'Verify / Update Status' : '驗證 / 更新狀態'}
          </button>
        </div>
      `;

      marker.bindPopup(popupContent);

      // Attach event listener when popup opens
      marker.on('popupopen', () => {
        const btn = document.getElementById(btnId);
        if (btn && onVerify) {
          btn.onclick = () => onVerify(point);
        }

        const delBtn = document.getElementById(delBtnId);
        if (delBtn && onDelete) {
          delBtn.onclick = () => onDelete(point.id);
        }
        // For site details
        (window as any).parentSiteClick = (name: string) => {
          onSiteClick?.(name);
        };
      });
    });

    // Fit map to bounds if markers exist
    if (markers.length > 0) {
      const group = L.featureGroup(markers);
      map.fitBounds(group.getBounds().pad(0.1));
    }

  }, [filteredData, lang, onVerify]);


  return (
    <div className="relative w-full h-[700px] bg-[#0b1121] rounded-xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col group">

      {/* Filters Bar */}
      <div className="absolute top-4 right-4 z-[500] flex flex-col md:flex-row gap-2 max-w-[80%] md:max-w-none items-end md:items-start">
        <div className="bg-slate-800/90 backdrop-blur p-2 rounded-lg border border-slate-600 shadow-xl flex gap-2">
          {/* Type Filter */}
          <div className="relative group">
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none border border-slate-600 focus:border-emerald-500 appearance-none pl-6 pr-6 cursor-pointer"
            >
              {availableTypes.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <Filter size={12} className="absolute left-2 top-1.5 text-slate-400 pointer-events-none" />
          </div>

          {/* Severity Filter */}
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none border border-slate-600 focus:border-emerald-500 cursor-pointer"
          >
            <option value="ALL">All Severities</option>
            <option value={Severity.LOW}>Low</option>
            <option value={Severity.MEDIUM}>Medium</option>
            <option value={Severity.HIGH}>High</option>
            <option value={Severity.CRITICAL}>Critical</option>
          </select>

          {/* Date Filter */}
          <div className="relative">
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="bg-slate-700 text-white text-xs rounded px-2 py-1 outline-none border border-slate-600 focus:border-emerald-500 appearance-none pl-6 pr-6 cursor-pointer"
            >
              <option value="ALL">All Time</option>
              <option value="WEEK">Past Week</option>
              <option value="MONTH">Past Month</option>
            </select>
            <Calendar size={12} className="absolute left-2 top-1.5 text-slate-400 pointer-events-none" />
          </div>
        </div>
      </div>

      <div
        ref={mapContainerRef}
        className="flex-grow w-full h-full z-0"
        style={{ minHeight: '600px' }}
      />

      {filteredData.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-[400]">
          <div className="bg-slate-900/80 p-4 rounded-xl border border-slate-700 text-center">
            <p className="text-slate-400 text-sm">No reports found.</p>
            <p className="text-slate-500 text-xs">Start by reporting waste!</p>
          </div>
        </div>
      )}

      {/* Overlay Instructions */}
      <div className="absolute bottom-4 left-4 z-[500] pointer-events-none">
        <div className="bg-slate-800/90 backdrop-blur p-3 rounded-lg border border-slate-600 pointer-events-auto shadow-xl max-w-xs">
          <h3 className="text-white font-bold flex items-center gap-2 text-sm">
            <Navigation size={14} className="text-emerald-400" />
            {lang === Language.EN ? "Live Monitor" : "實時監測"}
          </h3>
          <p className="text-[10px] text-slate-400 mt-1">
            {t.mapInstructions}
          </p>
          <div className="mt-2 flex gap-4">
            <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-red-500 shadow-[0_0_5px_rgba(239,68,68,0.5)]"></span> Critical
            </div>
            <div className="flex items-center gap-1.5 text-[10px] text-slate-300">
              <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_5px_rgba(16,185,129,0.5)]"></span> Low Risk
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoastalMap;