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
  user_id?: string | null;
  username?: string;
  lat: number;
  lng: number;
  type: string;
  subType?: string;
  description?: string;
  severity: Severity;
  timestamp: string;
  mediaType: 'image' | 'video';
  mediaUrl?: string;
  verified: boolean;
  status?: 'pending' | 'verified' | 'cleaned';
  locationName: string;
  boundingBoxes?: BoundingBox[];
  waste_distribution: Record<string, number>;
  unique_item_count: number;
}

export interface DetectionResult {
  wasteType: string[];
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
  imageUrl?: string;
}

export type GeminiAnalysisResult = DetectionResult;

export interface AuthUser {
  id: string;
  email: string;
  username: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
}
