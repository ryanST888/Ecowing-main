import React, { useEffect, useRef, useState, useMemo } from 'react';
import { WasteDataPoint, Severity, Language } from '../types';
import { TRANSLATIONS } from '../constants';
import { Navigation, Filter, Calendar, Layers, Map as MapIcon, Flame, AlertTriangle } from 'lucide-react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';

interface CoastalMapProps {
    data: WasteDataPoint[];
    lang: Language;
    onVerify?: (report: WasteDataPoint) => void;
    onDelete?: (id: string) => void;
    onSiteClick?: (locationName: string) => void;
}

const TILE_LAYERS = {
    DARK: {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap &copy; CARTO'
    },
    SATELLITE: {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        attribution: 'Tiles &copy; Esri'
    }
};

const HEATMAP_GRADIENT = {
    0.2: '#3b82f6',
    0.4: '#22d3ee',
    0.6: '#4ade80',
    0.8: '#facc15',
    1.0: '#ef4444'
};

const CoastalMap: React.FC<CoastalMapProps> = ({ data, lang, onVerify, onDelete, onSiteClick }) => {
    const mapContainerRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<L.Map | null>(null);
    const tileLayerRef = useRef<L.TileLayer | null>(null);
    const markerLayerRef = useRef<L.LayerGroup | null>(null);
    const heatLayerRef = useRef<L.Layer | null>(null);

    const t = TRANSLATIONS[lang] || TRANSLATIONS[Language.EN];

    const [activeLayer, setActiveLayer] = useState<'DARK' | 'SATELLITE'>('DARK');
    const [viewMode, setViewMode] = useState<'MARKERS' | 'HEATMAP'>('MARKERS');

    const [filterType, setFilterType] = useState<string>('ALL');
    const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
    const [dateRange, setDateRange] = useState<'ALL' | 'WEEK' | 'MONTH'>('ALL');

    const getSeverityWeight = (severity: Severity): number => {
        switch (severity) {
            case Severity.CRITICAL: return 1.0;
            case Severity.HIGH: return 0.7;
            case Severity.MEDIUM: return 0.4;
            case Severity.LOW: return 0.15;
            default: return 0.1;
        }
    };

    const safeData = Array.isArray(data) ? data : [];

    const availableTypes = useMemo(() => {
        const types = new Set(safeData.map(d => d.type || "Other"));
        return ['ALL', ...Array.from(types)];
    }, [safeData]);

    const filteredData = useMemo(() => {
        const now = new Date();

        return safeData
            .map((point: any) => {
                const finalLat = point.lat !== undefined ? Number(point.lat) : Number(point.latitude);
                const finalLng = point.lng !== undefined ? Number(point.lng) : Number(point.longitude);

                return {
                    ...point,
                    lat: finalLat,
                    lng: finalLng
                };
            })
            .filter(point => {
                if (isNaN(point.lat) || isNaN(point.lng)) return false;
                if (filterType !== 'ALL' && point.type !== filterType) return false;
                if (filterSeverity !== 'ALL' && point.severity !== filterSeverity) return false;

                if (dateRange !== 'ALL') {
                    const pointDate = new Date(point.timestamp || Date.now());
                    const diffTime = Math.abs(now.getTime() - pointDate.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    if (dateRange === 'WEEK' && diffDays > 7) return false;
                    if (dateRange === 'MONTH' && diffDays > 30) return false;
                }
                return true;
            });
    }, [safeData, filterType, filterSeverity, dateRange]);

    useEffect(() => {
        if (!mapContainerRef.current || mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [22.3193, 114.1694],
            zoom: 11,
            scrollWheelZoom: true,
            zoomControl: false,
        });

        L.control.zoom({ position: 'topleft' }).addTo(map);

        markerLayerRef.current = L.layerGroup().addTo(map);
        mapInstanceRef.current = map;

        const resizeObserver = new ResizeObserver(() => map.invalidateSize());
        resizeObserver.observe(mapContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            map.remove();
            mapInstanceRef.current = null;
        };
    }, []);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        if (tileLayerRef.current) map.removeLayer(tileLayerRef.current);

        const config = TILE_LAYERS[activeLayer];
        const newLayer = L.tileLayer(config.url, { attribution: config.attribution, maxZoom: 20 });

        newLayer.addTo(map);
        newLayer.bringToBack();
        tileLayerRef.current = newLayer;
    }, [activeLayer]);

    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        markerLayerRef.current?.clearLayers();
        if (heatLayerRef.current) {
            map.removeLayer(heatLayerRef.current);
            heatLayerRef.current = null;
        }

        if (viewMode === 'MARKERS') {
            if (!markerLayerRef.current) return;

            filteredData.forEach(point => {
                let color = '#10b981';
                if (point.severity === Severity.MEDIUM || point.severity === 'MEDIUM') color = '#facc15';
                if (point.severity === Severity.HIGH || point.severity === 'HIGH') color = '#f97316';
                if (point.severity === Severity.CRITICAL || point.severity === 'CRITICAL') color = '#ef4444';

                const customIcon = L.divIcon({
                    className: 'custom-div-icon',
                    html: `<div style="background-color: ${color}; width: 12px; height: 12px; border-radius: 50%; box-shadow: 0 0 10px ${color}; border: 2px solid white;"></div>`,
                    iconSize: [12, 12],
                    iconAnchor: [6, 6]
                });

                const marker = L.marker([point.lat, point.lng], { icon: customIcon });

                const btnId = `verify-btn-${point.id}`;
                const verifyText = lang === Language.EN ? "Verify Status" : "驗證狀態";

                const popupContent = `
                  <div class="p-2 font-sans text-slate-800 min-w-[200px]">
                    <h3 class="font-bold text-sm mb-1">${point.locationName || (lang === Language.EN ? "Unknown Location" : "未知位置")}</h3>
                    <div class="text-xs text-slate-600 mb-2">
                      <span class="font-bold" style="color:${color}">${point.severity || "UNKNOWN"}</span> • ${point.type || "Waste"}
                    </div>
                    ${onVerify ? `<button id="${btnId}" class="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold py-1.5 px-3 rounded transition-colors">${verifyText}</button>` : ''}
                  </div>
                `;

                marker.bindPopup(popupContent);

                marker.on('popupopen', () => {
                    const btn = document.getElementById(btnId);
                    if (btn && onVerify) {
                        btn.onclick = (e) => {
                            e.stopPropagation();
                            onVerify(point);
                            marker.closePopup();
                        };
                    }
                });

                markerLayerRef.current?.addLayer(marker);
            });

            if (filteredData.length === 1) {
                map.setView([filteredData[0].lat, filteredData[0].lng], 15);
            }

        } else {
            const heatPoints = filteredData.map(p => [
                p.lat,
                p.lng,
                getSeverityWeight(p.severity as Severity || Severity.MEDIUM)
            ]);

            if (heatPoints.length > 0) {
                const heat = (L as any).heatLayer(heatPoints, {
                    radius: 40,
                    blur: 25,
                    minOpacity: 0.5,
                    max: 1.0,
                    gradient: HEATMAP_GRADIENT
                });

                heat.addTo(map);
                heatLayerRef.current = heat;
            }
        }

    }, [filteredData, viewMode, lang, onVerify]);

    return (
        <div className="relative w-full h-[700px] bg-[#0b1121] rounded-xl overflow-hidden border border-slate-700 shadow-2xl flex flex-col group">

            <div className="absolute top-4 right-4 z-[500] flex flex-col items-end gap-3 max-w-[90%] pointer-events-none">
                <div className="pointer-events-auto bg-slate-800/90 backdrop-blur-md p-2 rounded-lg border border-slate-600 shadow-xl flex gap-2">
                    <div className="relative">
                        <Filter size={14} className="absolute left-2.5 top-2 text-slate-400" />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-slate-700 text-white text-xs rounded pl-8 pr-3 py-1.5 border border-slate-600 outline-none cursor-pointer hover:bg-slate-600"
                        >
                            <option value="ALL">{lang === Language.EN ? 'All Types' : '所有類型'}</option>
                            {availableTypes.filter(t => t !== 'ALL').map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>

                    <div className="relative">
                        <AlertTriangle size={14} className="absolute left-2.5 top-2 text-slate-400" />
                        <select
                            value={filterSeverity}
                            onChange={(e) => setFilterSeverity(e.target.value)}
                            className="bg-slate-700 text-white text-xs rounded pl-8 pr-3 py-1.5 border border-slate-600 outline-none cursor-pointer hover:bg-slate-600"
                        >
                            <option value="ALL">{lang === Language.EN ? 'All Severities' : '所有嚴重程度'}</option>
                            <option value={Severity.CRITICAL}>{lang === Language.EN ? 'Critical' : '極高'}</option>
                            <option value={Severity.HIGH}>{lang === Language.EN ? 'High' : '高'}</option>
                            <option value={Severity.MEDIUM}>{lang === Language.EN ? 'Medium' : '中'}</option>
                            <option value={Severity.LOW}>{lang === Language.EN ? 'Low' : '低'}</option>
                        </select>
                    </div>
                </div>

                <div className="flex gap-2 pointer-events-auto">
                    <button
                        onClick={() => setActiveLayer(prev => prev === 'DARK' ? 'SATELLITE' : 'DARK')}
                        className="bg-slate-800/90 hover:bg-slate-700 p-2 rounded-lg border border-slate-600 text-white shadow-xl transition-all"
                        title={lang === Language.EN ? "Switch Map Style" : "切換地圖樣式"}
                    >
                        <Layers size={20} className="text-emerald-400" />
                    </button>

                    <button
                        onClick={() => setViewMode(prev => prev === 'MARKERS' ? 'HEATMAP' : 'MARKERS')}
                        className={`p-2 rounded-lg border shadow-xl transition-all flex items-center gap-2 ${viewMode === 'HEATMAP'
                            ? 'bg-emerald-600 border-emerald-500 text-white'
                            : 'bg-slate-800/90 border-slate-600 text-slate-300 hover:text-white'
                            }`}
                    >
                        {viewMode === 'MARKERS' ? <MapIcon size={20} /> : <Flame size={20} />}
                        <span className="text-xs font-bold pr-1">
                            {viewMode === 'MARKERS'
                                ? (lang === Language.EN ? 'Heatmap' : '熱力圖')
                                : (lang === Language.EN ? 'Markers' : '標記點')}
                        </span>
                    </button>
                </div>
            </div>

            <div ref={mapContainerRef} className="flex-grow w-full h-full z-0" />

            <div className="absolute bottom-6 left-6 z-[500] pointer-events-none">
                <div className="bg-slate-900/90 backdrop-blur p-4 rounded-lg border border-slate-600 pointer-events-auto shadow-2xl min-w-[160px]">
                    <h3 className="text-white font-bold text-xs uppercase tracking-wider mb-3 border-b border-slate-700 pb-2">
                        {viewMode === 'HEATMAP'
                            ? (lang === Language.EN ? 'Severity Density' : '嚴重程度密度')
                            : (lang === Language.EN ? 'Live Monitor' : '實時監控')}
                    </h3>

                    {viewMode === 'MARKERS' ? (
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 text-[11px] text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-[0_0_5px_red]"></span>
                                {lang === Language.EN ? 'Critical' : '極高'}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shadow-[0_0_5px_orange]"></span>
                                {lang === Language.EN ? 'High' : '高'}
                            </div>
                            <div className="flex items-center gap-2 text-[11px] text-slate-300">
                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_5px_emerald]"></span>
                                {lang === Language.EN ? 'Low/Medium' : '中/低'}
                            </div>
                        </div>
                    ) : (
                        <div>
                            <div className="h-2 w-full rounded-full bg-gradient-to-r from-blue-500 via-green-400 via-yellow-400 to-red-500 mb-2"></div>
                            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
                                <span>{lang === Language.EN ? 'Low' : '低'}</span>
                                <span>{lang === Language.EN ? 'Critical' : '極高'}</span>
                            </div>
                            <p className="text-[9px] text-slate-500 mt-2 leading-tight">
                                {lang === Language.EN
                                    ? 'Hotter colors indicate either critical waste or high accumulation.'
                                    : '較熱的顏色表示嚴重的垃圾問題或高堆積量。'}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default CoastalMap;