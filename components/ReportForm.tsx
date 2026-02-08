import React, { useState, useEffect } from 'react';
import { Camera, Upload, Loader2, AlertCircle, CheckCircle, Video, MapPin, Scan, Send, Trash, Edit2, MousePointerClick } from 'lucide-react';
import { detectWaste } from '../services/apiService';
import { analyzeWasteMedia, fileToData } from '../services/geminiService';
import { DetectionResult, Language, WasteDataPoint, GeminiAnalysisResult } from '../types';
import heic2any from 'heic2any';

// ... (imports remain similar)

// Helper to convert file to base64 (if needed for preview, but detectWaste sends File)

// ... inside component

import { TRANSLATIONS } from '../constants';

// Declare EXIF global for the exif-js library imported in index.html
declare const EXIF: any;

interface ReportFormProps {
  lang: Language;
  onReportSubmit: (result: GeminiAnalysisResult, mediaData: { type: 'image' | 'video', url: string }, location: { lat: number, lng: number }, locationName: string, id?: string) => void;
  initialData?: WasteDataPoint | null;
}

const ReportForm: React.FC<ReportFormProps> = ({ lang, onReportSubmit, initialData }) => {
  const [selectedMedia, setSelectedMedia] = useState<{ url: string, type: 'image' | 'video' } | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<GeminiAnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Add state for displayed image position
  const [imageDisplayInfo, setImageDisplayInfo] = useState<{
    actualWidth: number;
    actualHeight: number;
    offsetX: number;
    offsetY: number;
    scale: number;
  } | null>(null);

  // Location state
  const [editLocation, setEditLocation] = useState<{ lat: string, lng: string }>({ lat: '', lng: '' });
  const [locationName, setLocationName] = useState<string>('');
  const [locationStatus, setLocationStatus] = useState<string>("");

  // Interaction State
  const [activeBoxIndex, setActiveBoxIndex] = useState<number | null>(null);

  const t = TRANSLATIONS[lang];

  const getAddressFromCoords = async (lat: number, lng: number) => {
    try {
      setLocationStatus("Fetching address...");
      const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=14`);
      const data = await response.json();

      let formattedAddress = "Unknown Location";
      if (data && data.address) {
        const parts = [
          data.address.tourism || data.address.amenity || data.address.building || data.address.road,
          data.address.suburb || data.address.quarter,
          data.address.city || data.address.town || data.address.county,
          data.address.country
        ].filter(Boolean);
        formattedAddress = parts.join(', ');
      } else if (data && data.display_name) {
        formattedAddress = data.display_name;
      }

      setLocationName(formattedAddress);
      setLocationStatus("Address found");
      return formattedAddress;
    } catch (err) {
      console.error("Reverse geocoding error:", err);
      setLocationStatus("Address lookup failed");
      return "Unknown Location";
    }
  };

  const extractLocationFromFile = async (file: File): Promise<void> => {
    setLocationStatus("Reading GPS data...");

    // For HEIC files
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
          return; // This return is OK
        }
      } catch (err) {
        console.log('exifr failed:', err);
      }
    }

    // For regular images with EXIF.js
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
              await getAddressFromCoords(decimalLat, decimalLon);
              setLocationStatus("GPS found in image");
            } else {
              await useDeviceLocation(); // Make this async too
            }

            URL.revokeObjectURL(tempUrl);
            resolve();
          });
        };
      });
    } else {
      // For videos or no EXIF
      await useDeviceLocation();
    }
  };

  // Option 2
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
          async (error) => {
            console.error("Geolocation error:", error);
            setLocationStatus("Device location failed, using default");

            try {
              const res = await fetch('https://ipapi.co/json/');
              const data = await res.json();
              if (data.latitude && data.longitude) {
                setEditLocation({ lat: data.latitude.toFixed(6), lng: data.longitude.toFixed(6) });
                await getAddressFromCoords(data.latitude, data.longitude);
              } else {
                useDefaultHK();
              }
            } catch {
              useDefaultHK();
            }
            resolve();
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } else {
        setLocationStatus("Geolocation not supported");
        useDefaultHK();
        resolve();
      }
    });
  };

  // Option 3
  const useDefaultHK = () => {
    const def = { lat: 22.3193, lng: 114.1694 };
    setEditLocation({ lat: def.lat.toFixed(6), lng: def.lng.toFixed(6) });
    getAddressFromCoords(def.lat, def.lng);
  };


  // Convert DMS to Decimal
  const toDecimal = (number: any[]) => {
    return number[0].numerator + number[1].numerator / (60 * number[1].denominator) + number[2].numerator / (3600 * number[2].denominator);
  };

  const parseCoords = (url: string) => {
    const atRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const atMatch = url.match(atRegex);
    if (atMatch) return { lat: atMatch[1], lng: atMatch[2] };

    const qRegex = /q=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const qMatch = url.match(qRegex);
    if (qMatch) return { lat: qMatch[1], lng: qMatch[2] };

    return null;
  };

  const handleLinkPaste = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const url = e.target.value;
    if (!url) return;

    setLocationStatus("Resolving link...");

    // First try direct parse
    let coords = parseCoords(url);

    // If failed, try backend expansion
    if (!coords) {
      try {
        const res = await fetch(`http://localhost:8000/api/expand-url?url=${encodeURIComponent(url)}`);
        const data = await res.json();
        if (data.url) {
          coords = parseCoords(data.url);
        }
      } catch (err) {
        console.error("Link expansion failed", err);
      }
    }

    if (coords) {
      setEditLocation({ lat: coords.lat, lng: coords.lng });
      getAddressFromCoords(parseFloat(coords.lat), parseFloat(coords.lng));
      setLocationStatus("Location found!");
    } else {
      setLocationStatus("Could not extract location.");
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
    setActiveBoxIndex(null);
    setLocationStatus("Processing file...");

    try {
      // Convert HEIC to JPEG for display and analysis
      let processedFile = file;
      let objectUrl: string;

      if (file.name.toLowerCase().endsWith('.heic') || file.type === 'image/heic') {
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
          objectUrl = URL.createObjectURL(file);
          setSelectedMedia({ url: objectUrl, type: 'image' });
        }
      } else {
        const isVideo = file.type.startsWith('video');
        objectUrl = URL.createObjectURL(file);
        setSelectedMedia({ url: objectUrl, type: isVideo ? 'video' : 'image' });
      }

      // Extract location from the original file
      await extractLocationFromFile(file);

      // Convert to base64 for analysis
      const fileData = await fileToData(processedFile);

      setIsAnalyzing(true);
      // Return location info to data.json
      const lat = editLocation.lat ? parseFloat(editLocation.lat) : 22.3193;
      const lng = editLocation.lng ? parseFloat(editLocation.lng) : 114.1694;
      const analysis = await detectWaste(processedFile, { lat, lng }, locationName);
      setResult(analysis);

    } catch (err) {
      console.error(err);
      setError("Failed to analyze media. Please check API key and format.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  // New handleImageLoad function for proper bounding box display
  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const container = img.parentElement;

    if (!container) return;

    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;

    // For object-contain calculation
    const containerRatio = containerWidth / containerHeight;
    const imgRatio = img.naturalWidth / img.naturalHeight;

    let actualWidth, actualHeight, offsetX, offsetY, scale;

    if (containerRatio > imgRatio) {
      // Image height matches container, width is smaller (padding on sides)
      actualHeight = containerHeight;
      actualWidth = containerHeight * imgRatio;
      offsetX = (containerWidth - actualWidth) / 2;
      offsetY = 0;
      scale = actualHeight / img.naturalHeight;
    } else {
      // Image width matches container, height is smaller (padding top/bottom)
      actualWidth = containerWidth;
      actualHeight = containerWidth / imgRatio;
      offsetX = 0;
      offsetY = (containerHeight - actualHeight) / 2;
      scale = actualWidth / img.naturalWidth;
    }

    setImageDisplayInfo({
      actualWidth,
      actualHeight,
      offsetX,
      offsetY,
      scale
    });
  };

  /*
  // Old handleMediaUpload function
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 20 * 1024 * 1024) {
      setError(lang === Language.EN ? "File too large (Max 20MB)" : "文件太大 (最大 20MB)");
      return;
    }

    setError(null);
    setResult(null);
    setActiveBoxIndex(null);
    setLocationStatus("Processing file...");

    try {
      const fileData = await fileToData(file);
      const isVideo = file.type.startsWith('video');
      const mediaType = isVideo ? 'video' : 'image';

      // Use ObjectURL for preview (faster, reliable) instead of base64
      const objectUrl = URL.createObjectURL(file);
      setSelectedMedia({ url: objectUrl, type: mediaType });

      // Attempt to get location from EXIF if it's an image
      if (!isVideo && typeof EXIF !== 'undefined') {
        const img = new Image();
        img.src = objectUrl;

        img.onload = () => {
          EXIF.getData(img, async function (this: any) {
            const lat = EXIF.getTag(this, "GPSLatitude");
            const lon = EXIF.getTag(this, "GPSLongitude");
            const latRef = EXIF.getTag(this, "GPSLatitudeRef") || "N";
            const lonRef = EXIF.getTag(this, "GPSLongitudeRef") || "E";

            if (lat && lon) {
              let decimalLat = toDecimal(lat);
              let decimalLon = toDecimal(lon);

              if (latRef === "S") decimalLat = -decimalLat;
              if (lonRef === "W") decimalLon = -decimalLon;

              setEditLocation({ lat: decimalLat.toFixed(6), lng: decimalLon.toFixed(6) });
              await getAddressFromCoords(decimalLat, decimalLon);
            } else {
              setLocationStatus(lang === Language.EN ? "No GPS in image. Using device location." : "圖片無 GPS。使用裝置位置。");
              // Fallback to device location
              navigator.geolocation.getCurrentPosition(
                async (pos) => {
                  const { latitude, longitude } = pos.coords;
                  setEditLocation({ lat: latitude.toFixed(6), lng: longitude.toFixed(6) });
                  await getAddressFromCoords(latitude, longitude);
                },
                () => {
                  // Fallback to HK default
                  const def = { lat: 22.3193, lng: 114.1694 };
                  setEditLocation({ lat: def.lat.toFixed(6), lng: def.lng.toFixed(6) });
                  getAddressFromCoords(def.lat, def.lng);
                }
              );
            }
          });
        };
      } else {
        // Video or no EXIF lib: Use Device Location
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const { latitude, longitude } = pos.coords;
            setEditLocation({ lat: latitude.toFixed(6), lng: longitude.toFixed(6) });
            await getAddressFromCoords(latitude, longitude);
          },
          () => {
            const def = { lat: 22.3193, lng: 114.1694 };
            setEditLocation({ lat: def.lat.toFixed(6), lng: def.lng.toFixed(6) });
            getAddressFromCoords(def.lat, def.lng);
          }
        );
      }

      setIsAnalyzing(true);
      const analysis = await analyzeWasteMedia(fileData, lang);
      setResult(analysis);

    } catch (err) {
      console.error(err);
      setError("Failed to analyze media. Please check API key and format.");
    } finally {
      setIsAnalyzing(false);
    }
  };
  */
  const handleConfirmSubmit = () => {
    if (!result || !selectedMedia) return;

    const finalLat = parseFloat(editLocation.lat);
    const finalLng = parseFloat(editLocation.lng);

    if (isNaN(finalLat) || isNaN(finalLng)) {
      setError(lang === Language.EN ? "Invalid coordinates" : "無效的座標");
      return;
    }

    onReportSubmit(result, selectedMedia, { lat: finalLat, lng: finalLng }, locationName, initialData?.id);
  };

  const handleDiscard = () => {
    setSelectedMedia(null);
    setResult(null);
    setError(null);
    setActiveBoxIndex(null);
    setEditLocation({ lat: '', lng: '' });
    setLocationName('');
  };

  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden animate-fade-in">
      {/* Verification Banner */}
      {initialData && (
        <div className="bg-emerald-500/10 border-b border-emerald-500/20 p-4 flex items-center gap-3">
          <div className="p-2 bg-emerald-500/20 rounded-full text-emerald-400">
            <MapPin size={20} />
          </div>
          <div>
            <h3 className="text-emerald-400 font-bold text-sm uppercase tracking-wider">
              {lang === Language.EN ? "Updating Status For" : "正在更新狀態"}
            </h3>
            <p className="text-white font-medium">{initialData.locationName}</p>
            <p className="text-slate-400 text-xs mt-0.5">Original Report: {initialData.type} ({initialData.severity})</p>
          </div>
        </div>
      )}

      <div className="p-6 border-b border-slate-700 flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Camera className="text-emerald-400" />
            {t.uploadTitle}
          </h2>
          <p className="text-slate-400 text-sm mt-1">{t.uploadDesc}</p>
        </div>
        <div className="text-right hidden md:block">
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <MapPin size={12} className={locationName ? "text-emerald-400" : "text-yellow-400"} />
            {locationStatus || t.detectingLocation}
          </div>
        </div>
      </div>

      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Upload Section with Clickable Bounding Box Overlay */}
        <div className="space-y-4">
          <div className={`relative border-2 border-dashed border-slate-600 rounded-xl h-64 md:h-80 flex flex-col items-center justify-center transition-colors overflow-hidden ${selectedMedia ? 'bg-slate-900' : 'hover:bg-slate-700/50'}`}>

            {selectedMedia ? (
              <div className="relative w-full h-full flex items-center justify-center group">
                {selectedMedia.type === 'video' ? (
                  <video src={selectedMedia.url} controls className="h-full w-full object-contain" />
                ) : (
                  <>
                    <img
                      src={selectedMedia.url}
                      alt="Preview"
                      className="h-full w-full object-contain"
                      onLoad={handleImageLoad}
                    /> {/*Updated to include handleImageLoad function*/}

                    {/* Bounding Boxes - Always visible */}
                    {result?.boundingBoxes?.map((box, idx) => {
                      if (!imageDisplayInfo) return null;

                      // Qwen uses 0-1000 normalized coordinates
                      // Convert to pixels in the displayed image area
                      const boxLeft = (box.xmin / 1000) * imageDisplayInfo.actualWidth;
                      const boxTop = (box.ymin / 1000) * imageDisplayInfo.actualHeight;
                      const boxWidth = ((box.xmax - box.xmin) / 1000) * imageDisplayInfo.actualWidth;
                      const boxHeight = ((box.ymax - box.ymin) / 1000) * imageDisplayInfo.actualHeight;

                      // Adjust for object-contain padding
                      const left = imageDisplayInfo.offsetX + boxLeft;
                      const top = imageDisplayInfo.offsetY + boxTop;

                      return (
                        <div
                          key={idx}
                          className="absolute border-2 border-red-500 bg-red-500/20 z-10"
                          style={{
                            top: `${top}px`,
                            left: `${left}px`,
                            height: `${boxHeight}px`,
                            width: `${boxWidth}px`,
                          }}
                        >
                          <div className="absolute -top-6 left-0 bg-red-500 text-white text-xs px-2 py-1">
                            {box.label}
                          </div>
                        </div>
                      );
                    })}
                  </>
                )}
              </div>
            ) : (
              <div className="text-center p-4">
                <div className="flex justify-center space-x-2 mb-2">
                  <Upload className="h-8 w-8 text-slate-500" />
                  <Video className="h-8 w-8 text-slate-500" />
                </div>
                <p className="text-slate-400 text-sm">{t.uploadBtn}</p>
              </div>
            )}
            {!selectedMedia && (
              <input
                type="file"
                accept="image/*,video/mp4,video/webm,video/quicktime"
                onChange={handleMediaUpload}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
            )}
          </div>

          {isAnalyzing && (
            <div className="flex items-center justify-center gap-2 text-emerald-400 animate-pulse">
              <Loader2 className="animate-spin" size={20} />
              <span>{t.analyzing}</span>
            </div>
          )}

          {result && selectedMedia?.type === 'image' && (
            <div className="text-xs text-slate-500 flex items-center gap-1 justify-center animate-pulse">
              <MousePointerClick size={12} />
              {lang === Language.EN ? "Click on objects in the image to identify them" : "點擊圖片中的物體以查看類型"}
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 text-red-400 p-3 rounded-lg flex items-center gap-2 text-sm">
              <AlertCircle size={16} /> {error}
            </div>
          )}
        </div>

        {/* Results Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center border-l-4 border-emerald-400 pl-3">
            <h3 className="text-lg font-semibold text-white">
              {t.analysisResult}
            </h3>
            {result && (
              <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded border border-yellow-500/30">
                {t.reviewTitle}
              </span>
            )}
          </div>

          {!result && !isAnalyzing && (
            <div className="h-full flex items-center justify-center text-slate-500 text-sm italic">
              {lang === Language.EN ? "Waiting for upload..." : "等待上傳..."}
            </div>
          )}

          {result && (
            <div className="space-y-4 animate-fade-in flex flex-col h-full">
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <span className="text-xs text-slate-400 uppercase tracking-wider">{lang === Language.EN ? "Severity" : "嚴重程度"}</span>
                <div className="flex items-center gap-2 mt-1">
                  <div className={`h-3 w-3 rounded-full ${result.severity === 'CRITICAL' ? 'bg-red-500' : result.severity === 'HIGH' ? 'bg-orange-500' : 'bg-emerald-500'}`}></div>
                  <span className="text-xl font-bold text-white">{result.severity}</span>
                </div>
              </div>

              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <span className="text-xs text-slate-400 uppercase tracking-wider">{lang === Language.EN ? "AI Assessment" : "AI 評估"}</span>
                <p className="text-slate-300 text-sm mt-1 leading-relaxed">
                  {result.description}
                </p>
              </div>

              {/* Location Correction */}
              <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
                <span className="text-xs text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-2">
                  <Edit2 size={12} /> {t.editLocation}
                </span>

                {/* Address Display */}
                <div className="mb-3">
                  <label className="text-[10px] text-slate-500 block mb-1">
                    {lang === Language.EN ? "Detected Address" : "偵測地址"}
                  </label>
                  <input
                    type="text"
                    value={locationName}
                    onChange={(e) => setLocationName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1.5 text-sm text-white focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="mb-3">
                  <label className="text-[10px] text-emerald-400 block mb-1 flex items-center gap-1">
                    <MapPin size={10} />
                    {lang === Language.EN ? "Paste Map Link (Auto-Fill)" : "貼上地圖連結 (自動填寫)"}
                  </label>
                  <input
                    type="text"
                    placeholder="https://www.google.com/maps/place/..."
                    onChange={handleLinkPaste}
                    className="w-full bg-slate-900 border border-emerald-500/30 rounded px-2 py-1.5 text-xs text-emerald-300 placeholder-slate-600 focus:border-emerald-500 outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] text-slate-500">{t.latitude}</label>
                    <input
                      type="number"
                      step="any"
                      value={editLocation.lat}
                      onChange={(e) => setEditLocation(prev => ({ ...prev, lat: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-emerald-500 outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500">{t.longitude}</label>
                    <input
                      type="number"
                      step="any"
                      value={editLocation.lng}
                      onChange={(e) => setEditLocation(prev => ({ ...prev, lng: e.target.value }))}
                      className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white focus:border-emerald-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              <div className="mt-auto pt-4 space-y-3">
                <p className="text-xs text-slate-400 italic text-center">
                  {t.reviewDesc}
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={handleDiscard}
                    className="flex items-center justify-center gap-2 py-3 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors font-semibold"
                  >
                    <Trash size={18} />
                    {t.discardReport}
                  </button>
                  <button
                    onClick={handleConfirmSubmit}
                    className="flex items-center justify-center gap-2 py-3 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition-colors font-bold shadow-lg shadow-emerald-500/20"
                  >
                    <Send size={18} />
                    {t.confirmSubmission}
                  </button>
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