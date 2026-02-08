import { DetectionResult, WasteDataPoint } from '../types';

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

    const response = await fetch('/api/detect', {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        throw new Error('Detection failed');
    }

    return response.json();
};

export const getHistory = async (): Promise<WasteDataPoint[]> => {
    const response = await fetch('/api/history');
    if (!response.ok) {
        console.error('Failed to fetch history');
        return [];
    }
    return response.json();
};
