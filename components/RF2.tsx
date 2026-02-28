import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { Camera, Upload, Loader2, AlertCircle, CheckCircle, Video, MapPin, Scan, Send, Trash, Edit2, MousePointerClick, X, Plus, Minus, Tag } from 'lucide-react';
import { detectWaste } from '../services/apiService';
import { fileToData } from '../services/geminiService';
import { DetectionResult, Language, WasteDataPoint, GeminiAnalysisResult } from '../types';
import { TRANSLATIONS } from '../constants';

// Declare EXIF global for the exif-js library imported in index.html
declare const EXIF: any;

interface ReportFormProps {
    lang: Language;
    onReportSubmit: (result: GeminiAnalysisResult, mediaData: { type: 'image' | 'video', url: string }, location: { lat: number, lng: number }, locationName: string, id?: string) => void;
    initialData?: WasteDataPoint | null;
}

const WASTE_CATEGORIES = ["Plastic", "Metal", "Glass", "Paper", "Fabric", "Rubber", "Wood", "Other"];
const SEVERITY_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

const ReportForm: React.FC<ReportFormProps> = ({ lang, onReportSubmit, initialData }) => {
    const [selectedMedia, setSelectedMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [result, setResult] = useState<GeminiAnalysisResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Editable States
    const [customReportName, setCustomReportName] = useState<string>(''); // NEW: State for custom name
    const [wasteDistribution, setWasteDistribution] = useState<Record<string, number>>({});
    const [editedSeverity, setEditedSeverity] = useState<string>("MEDIUM");
    const [showConfirm, setShowConfirm] = useState(false);

    // Location state
    const [editLocation, setEditLocation] = useState<{ lat: string, lng: string }>({ lat: '', lng: '' });
    const [locationName, setLocationName] = useState<string>('');
    const [locationStatus, setLocationStatus] = useState<string>("");

    // Refs for precise positioning
    const containerRef = useRef<HTMLDivElement>(null);
    const mediaRef = useRef<HTMLImageElement | HTMLVideoElement>(null);
    const [overlayStyle, setOverlayStyle] = useState<{ top: number; left: number; width: number; height: number } | null>(null);

    const t = TRANSLATIONS[lang];

    useEffect(() => {
        if (result) {
            const initialDist: Record<string, number> = {};
            WASTE_CATEGORIES.forEach(cat => initialDist[cat] = 0);

            if (result.waste_distribution) {
                Object.entries(result.waste_distribution).forEach(([key, value]) => {
                    const normalizedKey = WASTE_CATEGORIES.find(c => key.includes(c)) || "Other";
                    initialDist[normalizedKey] = (initialDist[normalizedKey] || 0) + (value as number);
                });
            }
            setWasteDistribution(initialDist);
            setEditedSeverity(result.severity || "MEDIUM");
        }
    }, [result]);

    const updateOverlay = () => {
        const container = containerRef.current;
        const media = mediaRef.current;
        if (!container || !media) return;

        const cW = container.clientWidth;
        const cH = container.clientHeight;

        let mW = 0, mH = 0;
        if (media.tagName === 'IMG') {
            mW = (media as HTMLImageElement).naturalWidth;
            mH = (media as HTMLImageElement).naturalHeight;
        } else {
            mW = (media as HTMLVideoElement).videoWidth;
            mH = (media as HTMLVideoElement).videoHeight;
        }

        if (!mW || !mH) return;

        const cRatio = cW / cH;
        const mRatio = mW / mH;

        let finalW, finalH, top, left;

        if (cRatio > mRatio) {
            finalH = cH;
            finalW = cH * mRatio;
            top = 0;
            left = (cW - finalW) / 2;
        } else {
            finalW = cW;
            finalH = cW / mRatio;
            left = 0;
            top = (cH - finalH) / 2;
        }

        setOverlayStyle({ width: finalW, height: finalH, top, left });
    };

    useLayoutEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(() => {
            window.requestAnimationFrame(updateOverlay);
        });
        observer.observe(container);
        updateOverlay();

        return () => observer.disconnect();
    }, [selectedMedia, result]);

    const updateCount = (category: string, delta: number) => {
        setWasteDistribution(prev => ({
            ...prev,
            [category]: Math.max(0, (prev[category] || 0) + delta)
        }));
    };

    const getSeverityColor = (level: string) => {
        switch (level) {
            case 'CRITICAL': return 'bg-red-500 shadow-red-500/20';
            case 'HIGH': return 'bg-orange-500 shadow-orange-500/20';
            case 'MEDIUM': return 'bg-yellow-500 shadow-yellow-500/20';
            case 'LOW': return 'bg-emerald-500 shadow-emerald-500/20';
            default: return 'bg-slate-500';
        }
    };

    const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 20 * 1024 * 1024) {
            setError(lang === Language.EN ? "File too large (Max 20MB)" : "文件太大 (最大 20MB)");
            return;
        }

        setError(null);
        setResult(null);
        setWasteDistribution({});
        setOverlayStyle(null);
        setLocationStatus("Processing file...");

        try {
            let processedFile = file;
            let objectUrl = URL.createObjectURL(file);

            const isVideo = file.type.startsWith('video');
            setSelectedMedia({ url: objectUrl, type: isVideo ? 'video' : 'image' });

            if (file.name.toLowerCase().endsWith('.heic')) {
                try {
                    const heic2any = await import('heic2any');
                    const conversionResult = await heic2any.default({
                        blob: file,
                        toType: 'image/jpeg',
                        quality: 0.8
                    }) as Blob;

                    processedFile = new File([conversionResult], file.name.replace(/\.heic$/i, '.jpg'), {
                        type: 'image/jpeg'
                    });
                    objectUrl = URL.createObjectURL(conversionResult);
                    setSelectedMedia({ url: objectUrl, type: 'image' });
                } catch (err) {
                    console.error('HEIC conversion failed:', err);
                }
            }

            await extractLocationFromFile(file);

            setIsAnalyzing(true);
            const lat = editLocation.lat ? parseFloat(editLocation.lat) : 22.3193;
            const lng = editLocation.lng ? parseFloat(editLocation.lng) : 114.1694;

            const analysis = await detectWaste(processedFile, { lat, lng }, locationName);
            setResult(analysis);

        } catch (err) {
            console.error(err);
            setError("Failed to analyze media. Please check your Backend connection.");
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handlePreSubmit = () => {
        if (!result || !selectedMedia) return;
        const finalLat = parseFloat(editLocation.lat);
        const finalLng = parseFloat(editLocation.lng);
        if (isNaN(finalLat) || isNaN(finalLng)) {
            setError(lang === Language.EN ? "Invalid coordinates" : "無效的座標");
            return;
        }
        setShowConfirm(true);
    };

    const handleFinalSubmit = async () => {
        if (!result || !selectedMedia) return;
        const finalLat = parseFloat(editLocation.lat);
        const finalLng = parseFloat(editLocation.lng);

        const updatedResult = {
            ...result,
            waste_distribution: wasteDistribution,
            severity: editedSeverity
        } as GeminiAnalysisResult;

        const backendImageUrl = (result as any).imageUrl;
        const finalMediaData = {
            type: selectedMedia.type,
            url: backendImageUrl ? backendImageUrl : selectedMedia.url
        };

        // NEW: Check if user entered a custom name, otherwise fallback to RPT- timestamp
        const finalReportId = customReportName.trim() !== '' ? customReportName.trim() : `RPT-${Date.now()}`;

        const finalRecord = {
            ...updatedResult,
            id: finalReportId, // Use the custom name here
            latitude: finalLat,
            longitude: finalLng,
            locationName: locationName || "Unknown",
            verified: true,
            imageUrl: finalMediaData.url,
            message: updatedResult.description,
            status: "pending",
            timestamp: Date.now()
        };

        try {
            await fetch('http://localhost:8000/api/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(finalRecord)
            });
            console.log("Final edited report saved to database!");
        } catch (e) {
            console.error("Failed to save final report:", e);
        }

        onReportSubmit(updatedResult, finalMediaData, { lat: finalLat, lng: finalLng }, locationName, initialData?.id);
        setShowConfirm(false);
        handleDiscard();
    };

    const handleDiscard = () => {
        setSelectedMedia(null);
        setResult(null);
        setWasteDistribution({});
        setEditedSeverity("MEDIUM");
        setCustomReportName(''); // Reset custom name
        setOverlayStyle(null);
        setError(null);
        setEditLocation({ lat: '', lng: '' });
        setLocationName('');
        setShowConfirm(false);
    };

    const extractLocationFromFile = async (file: File): Promise<void> => {
        setLocationStatus("Reading GPS data...");

        if (file.type === 'image/heic' || file.name.toLowerCase().endsWith('.heic')) {
            try {
                const exifr = await import('exifr');
                const exifData = await exifr.parse(file);

                if (exifData?.latitude && exifData?.longitude) {
                    setEditLocation({
                        lat: exifData.latitude.toFixed(6),
                        lng: exifData.longitude.toFixed(6)
                    });
                    await getAddressFromCoords(exifData.latitude, exifData.longitude);
                    setLocationStatus("GPS found in HEIC file");
                    return;
                }
            } catch (err) {
                console.log('exifr failed:', err);
            }
        }

        if (typeof EXIF !== 'undefined' && file.type.startsWith('image/')) {
            return new Promise((resolve) => {
                const img = new Image();
                const tempUrl = URL.createObjectURL(file);
                img.src = tempUrl;

                img.onload = () => {
                    EXIF.getData(img, async function (this: any) {
                        const lat = EXIF.getTag(this, "GPSLatitude");
                        const lon = EXIF.getTag(this, "GPSLongitude");

                        if (lat && lon) {
                            let decimalLat = toDecimal(lat);
                            let decimalLon = toDecimal(lon);
                            const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
                            const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";

                            if (latRef === "S") decimalLat = -decimalLat;
                            if (lonRef === "W") decimalLon = -decimalLon;

                            setEditLocation({ lat: decimalLat.toFixed(6), lng: decimalLon.toFixed(6) });
                            getAddressFromCoords(decimalLat, decimalLon);
                            setLocationStatus("GPS found in image");
                        } else {
                            useDeviceLocation();
                        }
                        URL.revokeObjectURL(tempUrl);
                        resolve();
                    });
                };
            });
        } else {
            await useDeviceLocation();
        }
    };

    const useDeviceLocation = async (): Promise<void> => {
        return new Promise((resolve) => {
            setLocationStatus(lang === Language.EN ? "Getting device location..." : "獲取裝置位置...");
            if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const { latitude, longitude } = pos.coords;
                        setEditLocation({ lat: latitude.toFixed(6), lng: longitude.toFixed(6) });
                        await getAddressFromCoords(latitude, longitude);
                        setLocationStatus("Device location found");
                        resolve();
                    },
                    () => {
                        setLocationStatus("Device location failed, using default");
                        useDefaultHK();
                        resolve();
                    },
                    { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
                );
            } else {
                useDefaultHK();
                resolve();
            }
        });
    };

    const useDefaultHK = () => {
        const def = { lat: 22.3193, lng: 114.1694 };
        setEditLocation({ lat: def.lat.toFixed(6), lng: def.lng.toFixed(6) });
        getAddressFromCoords(def.lat, def.lng);
    };

    const getAddressFromCoords = async (lat: number, lng: number) => {
        try {
            setLocationStatus("Fetching address...");
            const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`);
            const data = await response.json();
            let formattedAddress = "Unknown Location";
            if (data && data.display_name) formattedAddress = data.display_name;
            setLocationName(formattedAddress);
            setLocationStatus("Address found");
            return formattedAddress;
        } catch {
            setLocationStatus("Address lookup failed");
            return "Unknown Location";
        }
    };

    const toDecimal = (number: any[]) => {
        return number[0].numerator + number[1].numerator / (60 * number[1].denominator) + number[2].numerator / (3600 * number[2].denominator);
    };

    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden animate-fade-in relative">

            {/* Confirmation Modal */}
            {showConfirm && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-slate-900 border border-slate-600 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <CheckCircle className="text-emerald-400" size={24} />
                                {lang === Language.EN ? "Confirm Report" : "確認報告"}
                            </h3>
                            <button onClick={() => setShowConfirm(false)} className="text-slate-400 hover:text-white transition-colors"><X size={20} /></button>
                        </div>
                        <div className="space-y-4 mb-6">
                            <p className="text-slate-300 text-sm">
                                {lang === Language.EN ? "Are you sure the Type, Severity and Location are all correct?" : "您確定類型、嚴重程度和位置都正確嗎？"}
                            </p>
                            <div className="bg-slate-800 rounded-lg p-3 text-sm border border-slate-700">

                                {/* Show the Custom Name in Confirmation */}
                                <div className="flex justify-between mb-2 pb-2 border-b border-slate-700">
                                    <span className="text-slate-400">{lang === Language.EN ? "Report Name:" : "報告名稱:"}</span>
                                    <span className="text-white font-medium truncate max-w-[150px] text-right">
                                        {customReportName.trim() ? customReportName : (lang === Language.EN ? "Auto-generated" : "自動生成")}
                                    </span>
                                </div>

                                <div className="mb-2 pb-2 border-b border-slate-700">
                                    <span className="text-slate-400 block mb-1">{lang === Language.EN ? "Waste Composition:" : "垃圾成分:"}</span>
                                    <div className="flex flex-wrap gap-2">
                                        {Object.entries(wasteDistribution).filter(([_, c]) => c > 0).map(([t, c]) => (
                                            <span key={t} className="px-2 py-0.5 bg-slate-700 rounded text-xs text-white border border-slate-600">{t}: <span className="text-emerald-400 font-bold">{c}</span></span>
                                        ))}
                                        {Object.values(wasteDistribution).every(c => c === 0) && <span className="text-slate-500 italic text-xs">No items counted</span>}
                                    </div>
                                </div>
                                <div className="flex justify-between mb-1">
                                    <span className="text-slate-400">{lang === Language.EN ? "Severity:" : "嚴重程度:"}</span>
                                    <span className={`font-bold ${editedSeverity === 'CRITICAL' ? 'text-red-400' : editedSeverity === 'HIGH' ? 'text-orange-400' : editedSeverity === 'MEDIUM' ? 'text-yellow-400' : 'text-emerald-400'}`}>{editedSeverity}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-slate-400">{lang === Language.EN ? "Location:" : "地點:"}</span>
                                    <span className="text-white font-medium truncate max-w-[150px] text-right">{locationName || "Unknown"}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowConfirm(false)} className="flex-1 py-2.5 rounded-lg border border-slate-600 text-slate-300 hover:bg-slate-800 transition-colors font-medium text-sm">{lang === Language.EN ? "Cancel" : "取消"}</button>
                            <button onClick={handleFinalSubmit} className="flex-1 py-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-bold text-sm shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"><Send size={16} />{lang === Language.EN ? "Submit Now" : "立即提交"}</button>
                        </div>
                    </div>
                </div>
            )}

            <div className="p-6 border-b border-slate-700 flex justify-between items-center">
                <div>
                    <h2 className="text-xl font-bold text-white flex items-center gap-2"><Camera className="text-emerald-400" />{t.uploadTitle}</h2>
                    <p className="text-slate-400 text-sm mt-1">{t.uploadDesc}</p>
                </div>
                <div className="text-right hidden md:block">
                    <div className="flex items-center gap-1.5 text-xs text-slate-400"><MapPin size={12} className={locationName ? "text-emerald-400" : "text-yellow-400"} />{locationStatus || t.detectingLocation}</div>
                </div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">

                {/* Upload & Overlay Section */}
                <div className="space-y-4">
                    <div ref={containerRef} className={`relative border-2 border-dashed border-slate-600 rounded-xl h-64 md:h-80 flex flex-col items-center justify-center transition-colors overflow-hidden ${selectedMedia ? 'bg-slate-900' : 'hover:bg-slate-700/50'}`}>
                        {selectedMedia ? (
                            <div className="relative w-full h-full flex items-center justify-center group bg-black">
                                {selectedMedia.type === 'video' ? (
                                    <video
                                        ref={mediaRef as any}
                                        src={selectedMedia.url}
                                        controls
                                        className="w-full h-full object-contain"
                                        onLoadedMetadata={() => updateOverlay()}
                                    />
                                ) : (
                                    <img
                                        ref={mediaRef as any}
                                        src={selectedMedia.url}
                                        alt="Preview"
                                        className="w-full h-full object-contain"
                                        onLoad={() => updateOverlay()}
                                    />
                                )}

                                {/* The Overlay Layer */}
                                {overlayStyle && (
                                    <div
                                        className="absolute pointer-events-none"
                                        style={{
                                            top: overlayStyle.top,
                                            left: overlayStyle.left,
                                            width: overlayStyle.width,
                                            height: overlayStyle.height
                                        }}
                                    >
                                        {result?.boundingBoxes?.map((box, idx) => (
                                            <div
                                                key={idx}
                                                className="absolute border-2 border-red-500 bg-red-500/20 z-10 hover:bg-red-500/40 transition-colors cursor-pointer pointer-events-auto"
                                                style={{
                                                    top: `${box.ymin / 10}%`,
                                                    left: `${box.xmin / 10}%`,
                                                    height: `${(box.ymax - box.ymin) / 10}%`,
                                                    width: `${(box.xmax - box.xmin) / 10}%`
                                                }}
                                            >
                                                <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-2 py-1 rounded shadow-sm whitespace-nowrap">
                                                    {box.label}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="text-center p-4">
                                <div className="flex justify-center space-x-2 mb-2"><Upload className="h-8 w-8 text-slate-500" /><Video className="h-8 w-8 text-slate-500" /></div>
                                <p className="text-slate-400 text-sm">{t.uploadBtn}</p>
                            </div>
                        )}
                        {!selectedMedia && <input type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={handleMediaUpload} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />}
                    </div>

                    {/* AI Accuracy Disclaimer */}
                    {result && !isAnalyzing && (
                        <div className="mt-3 p-2 bg-slate-900/50 rounded-lg border border-slate-700/50 text-xs text-slate-400 flex items-start gap-2">
                            <AlertCircle size={14} className="shrink-0 mt-0.5 text-yellow-500/70" />
                            <p>{lang === Language.EN ? "The analysis result is generated by AI, answer may not be entirely accurate. Please carefully check and adjust the data accordingly!" : "分析結果由 AI 生成，答案可能不完全準確。請仔細檢查並相應調整數據！"}</p>
                        </div>
                    )}

                    {isAnalyzing && <div className="flex items-center justify-center gap-2 text-emerald-400 animate-pulse"><Loader2 className="animate-spin" size={20} /><span>{t.analyzing}</span></div>}
                    {error && <div className="bg-red-900/20 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm"><AlertCircle size={16} /> {error}</div>}
                </div>

                {/* Results Section */}
                <div className="space-y-4">

                    <div className="flex justify-between items-center border-l-4 border-emerald-400 pl-3">
                        <h3 className="text-lg font-semibold text-white">{t.analysisResult}</h3>
                        {result && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded border border-yellow-500/30">{t.reviewTitle}</span>}
                    </div>

                    {!result && !isAnalyzing && (
                        <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
                            {lang === Language.EN ? "Waiting for upload..." : "等待上傳..."}
                        </div>
                    )}

                    {result && (
                        <div className="space-y-4 animate-fade-in flex flex-col h-full">

                            {/* NEW: Custom Report Name Field */}
                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <span className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                                    <Tag size={12} /> {lang === Language.EN ? "Report Name (Optional)" : "報告名稱 (可選)"}
                                </span>
                                <input
                                    type="text"
                                    value={customReportName}
                                    onChange={(e) => setCustomReportName(e.target.value)}
                                    placeholder={lang === Language.EN ? "e.g. Discovery Bay Cleanup" : "例如：發現灣清理區"}
                                    className="w-full bg-slate-800 border border-slate-600 rounded px-3 py-2 text-sm text-white focus:border-emerald-500 outline-none"
                                />
                            </div>

                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <span className="text-xs text-slate-400 uppercase tracking-wider block mb-2">{lang === Language.EN ? "Severity Level (Select to Change)" : "嚴重程度 (點擊更改)"}</span>
                                <div className="grid grid-cols-4 gap-2">
                                    {SEVERITY_LEVELS.map((level) => (
                                        <button key={level} onClick={() => setEditedSeverity(level)} className={`py-2 px-1 rounded text-[10px] sm:text-xs font-bold transition-all border border-transparent shadow-lg ${editedSeverity === level ? getSeverityColor(level) + " text-white scale-105 ring-2 ring-white/20" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{level}</button>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <span className="text-xs text-slate-400 uppercase tracking-wider">{lang === Language.EN ? "AI Assessment" : "AI 評估"}</span>
                                <p className="text-slate-300 text-sm mt-1 leading-relaxed">{result.description}</p>
                            </div>

                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <span className="text-xs text-slate-400 uppercase tracking-wider mb-2 block">{lang === Language.EN ? "Waste Composition (Edit Count)" : "垃圾成分 (編輯數量)"}</span>
                                <div className="space-y-2 mt-2 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
                                    {WASTE_CATEGORIES.map(category => (
                                        <div key={category} className="flex justify-between items-center bg-slate-800/50 p-2 rounded border border-slate-700">
                                            <span className="text-sm text-slate-300">{category}</span>
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => updateCount(category, -1)} className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-300 transition-colors" disabled={!wasteDistribution[category]}><Minus size={14} /></button>
                                                <span className="text-sm font-bold text-white w-6 text-center">{wasteDistribution[category] || 0}</span>
                                                <button onClick={() => updateCount(category, 1)} className="p-1 rounded bg-slate-700 hover:bg-slate-600 text-emerald-400 transition-colors"><Plus size={14} /></button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                                <span className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2"><Edit2 size={12} /> {t.editLocation}</span>
                                <div className="mb-3">
                                    <input type="text" value={locationName} onChange={(e) => setLocationName(e.target.value)} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-emerald-500 outline-none" />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <input type="number" step="any" value={editLocation.lat} onChange={(e) => setEditLocation(prev => ({ ...prev, lat: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-emerald-500 outline-none" placeholder={t.latitude} />
                                    <input type="number" step="any" value={editLocation.lng} onChange={(e) => setEditLocation(prev => ({ ...prev, lng: e.target.value }))} className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-emerald-500 outline-none" placeholder={t.longitude} />
                                </div>
                            </div>

                            <div className="mt-auto pt-4 space-y-3">
                                <p className="text-xs text-slate-400 italic text-center">{t.reviewDesc}</p>
                                <div className="grid grid-cols-2 gap-4">
                                    <button onClick={handleDiscard} className="flex items-center justify-center gap-2 py-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-semibold"><Trash size={18} /> {t.discardReport}</button>
                                    <button onClick={handlePreSubmit} className="flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-bold shadow-lg shadow-emerald-500/20"><Send size={18} /> {t.confirmSubmission}</button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ReportForm;