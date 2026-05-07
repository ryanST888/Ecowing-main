import { DetectionResult, WasteDataPoint } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;

export const detectWaste = async (
    file: File,
    location?: { lat: number; lng: number },
    locationName?: string
): Promise<DetectionResult> => {
    const formData = new FormData();
    formData.append('file', file);

    if (location) {
        formData.append('lat', location.lat.toString());
        formData.append('lng', location.lng.toString());
    }
    if (locationName) {
        formData.append('locationName', locationName);
    }

    const response = await fetch(apiUrl('/api/detect'), {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Detection failed');
    }

    return response.json();
};

export const getHistory = async (): Promise<WasteDataPoint[]> => {
    const response = await fetch(apiUrl('/api/history'));
    if (!response.ok) {
        console.error('Failed to fetch history');
        return [];
    }
    return response.json();
};
