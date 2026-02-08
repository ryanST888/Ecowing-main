export enum Language {
  EN = 'EN',
  ZH = 'ZH' // Traditional Chinese for HK
}

export enum Severity {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface BoundingBox {
  ymin: number;
  xmin: number;
  ymax: number;
  xmax: number;
  label: string;
}

export interface WasteDataPoint {
  id: string;
  lat: number;
  lng: number;
  type: string;
  subType?: string;
  severity: Severity;
  timestamp: string;
  mediaType: 'image' | 'video';
  mediaUrl?: string; // Base64 or URL
  verified: boolean;
  locationName: string;
  boundingBoxes?: BoundingBox[]; // Store coordinates for the map/image overlay
  waste_distribution: Record<string, number>;
  unique_item_count: number;
}

export interface ChartData {
  name: string;
  value: number;
  color?: string;
}

// Match backend 'DetectionResult' model
export interface DetectionResult {
  wasteType: string[]; // Deprecated but kept for compatibility
  category: string;
  subCategory?: string;
  severity: Severity;
  description: string;
  estimatedWeightKg: number;
  cleanupPriority: 'Low' | 'Medium' | 'High' | 'Immediate';
  boundingBoxes: BoundingBox[];
  waste_distribution: Record<string, number>;
  unique_item_count: number;
  timestamp: string;
}

export type GeminiAnalysisResult = DetectionResult; // Alias for backward compat