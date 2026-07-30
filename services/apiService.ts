import { AuthSession, AuthUser, DetectionResult, Severity, WasteDataPoint } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
const AUTH_STORAGE_KEY = 'ecoWingAuth';

export interface StoredAuth {
    user: AuthUser;
    session: AuthSession;
}

export const getStoredAuth = (): StoredAuth | null => {
    try {
        const raw = localStorage.getItem(AUTH_STORAGE_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
};

export const setStoredAuth = (auth: StoredAuth) => {
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(auth));
};

export const clearStoredAuth = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
};

export const getAuthHeaders = (): HeadersInit => {
    const token = getStoredAuth()?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
};

const readErrorMessage = async (response: Response, fallback: string) => {
    try {
        const error = await response.json();
        return error.detail || error.message || fallback;
    } catch {
        return fallback;
    }
};

export const signUp = async (email: string, password: string, username: string): Promise<StoredAuth | null> => {
    const response = await fetch(apiUrl('/api/auth/signup'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username }),
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Sign up failed'));
    }

    const data = await response.json();
    if (!data.session?.access_token) {
        return null;
    }

    const auth = {
        user: data.user as AuthUser,
        session: data.session as AuthSession,
    };
    setStoredAuth(auth);
    return auth;
};

export const login = async (email: string, password: string): Promise<StoredAuth> => {
    const response = await fetch(apiUrl('/api/auth/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Login failed'));
    }

    const data = await response.json();
    const auth = {
        user: data.user as AuthUser,
        session: data.session as AuthSession,
    };
    setStoredAuth(auth);
    return auth;
};

export const getCurrentUser = async (): Promise<AuthUser> => {
    const response = await fetch(apiUrl('/api/auth/me'), {
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Session expired'));
    }

    const user = await response.json();
    return user as AuthUser;
};

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
        headers: getAuthHeaders(),
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
        throw new Error(await readErrorMessage(response, 'Failed to fetch history'));
    }

    const history: unknown = await response.json();
    if (!Array.isArray(history)) return [];

    const severityValues = new Set(Object.values(Severity));
    return history.map((value): WasteDataPoint => {
        const report = value as Record<string, unknown>;
        const severity = String(report.severity || Severity.MEDIUM).toUpperCase();
        const mediaUrl = String(report.mediaUrl || report.imageUrl || '');

        return {
            id: String(report.id || ''),
            user_id: report.user_id ? String(report.user_id) : null,
            username: String(report.username || 'Anonymous'),
            lat: Number(report.lat ?? report.latitude ?? 0),
            lng: Number(report.lng ?? report.longitude ?? 0),
            type: String(report.type || report.category || 'Other'),
            subType: report.subType || report.subCategory ? String(report.subType || report.subCategory) : undefined,
            description: report.description ? String(report.description) : undefined,
            severity: severityValues.has(severity as Severity) ? severity as Severity : Severity.MEDIUM,
            timestamp: String(report.timestamp || new Date().toISOString()),
            mediaType: report.mediaType === 'video' || /\.(mp4|webm|mov)(?:$|\?)/i.test(mediaUrl) ? 'video' : 'image',
            mediaUrl: mediaUrl || undefined,
            verified: Boolean(report.verified),
            status: report.status === 'verified' || report.status === 'cleaned' ? report.status : 'pending',
            locationName: String(report.locationName || 'Unknown'),
            boundingBoxes: Array.isArray(report.boundingBoxes) ? report.boundingBoxes as WasteDataPoint['boundingBoxes'] : [],
            waste_distribution: report.waste_distribution && typeof report.waste_distribution === 'object'
                ? report.waste_distribution as Record<string, number>
                : {},
            unique_item_count: Number(report.unique_item_count || 0),
        };
    });
};

export const deleteReport = async (id: string): Promise<void> => {
    const response = await fetch(apiUrl(`/api/reports/${encodeURIComponent(id)}`), {
        method: 'DELETE',
        headers: getAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to delete report (${response.status})`));
    }
};
