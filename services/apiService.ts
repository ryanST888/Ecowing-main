import { AuthSession, AuthUser, DetectionResult, Severity, WasteDataPoint } from '../types';

const API_BASE_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const apiUrl = (path: string) => `${API_BASE_URL}${path}`;
const AUTH_STORAGE_KEY = 'ecoWingAuth';
let refreshPromise: Promise<StoredAuth> | null = null;

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

const getTokenExpiry = (token: string): number | null => {
    try {
        const payload = token.split('.')[1];
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
        const claims = JSON.parse(atob(padded)) as { exp?: number };
        return claims.exp ? claims.exp * 1000 : null;
    } catch {
        return null;
    }
};

const refreshStoredAuth = async (): Promise<StoredAuth> => {
    if (refreshPromise) return refreshPromise;

    const stored = getStoredAuth();
    if (!stored?.session?.refresh_token) {
        clearStoredAuth();
        throw new Error('Session expired');
    }

    refreshPromise = (async () => {
        const response = await fetch(apiUrl('/api/auth/refresh'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refresh_token: stored.session.refresh_token }),
        });

        if (!response.ok) {
            clearStoredAuth();
            throw new Error(await readErrorMessage(response, 'Session expired'));
        }

        const data = await response.json();
        const auth = {
            user: data.user as AuthUser,
            session: data.session as AuthSession,
        };
        setStoredAuth(auth);
        return auth;
    })();

    try {
        return await refreshPromise;
    } finally {
        refreshPromise = null;
    }
};

export const authenticatedFetch = async (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    let stored = getStoredAuth();
    const expiresAt = stored?.session?.access_token ? getTokenExpiry(stored.session.access_token) : null;
    if (stored?.session?.refresh_token && expiresAt && expiresAt <= Date.now() + 30_000) {
        stored = await refreshStoredAuth();
    }

    const headers = new Headers(init.headers);
    if (stored?.session?.access_token) {
        headers.set('Authorization', `Bearer ${stored.session.access_token}`);
    }

    let response = await fetch(input, { ...init, headers });
    if (response.status === 401 && stored?.session?.refresh_token) {
        const refreshed = await refreshStoredAuth();
        headers.set('Authorization', `Bearer ${refreshed.session.access_token}`);
        response = await fetch(input, { ...init, headers });
    }
    return response;
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

export const googleLogin = async (credential: string): Promise<StoredAuth> => {
    const response = await fetch(apiUrl('/api/auth/google'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ credential }),
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response, 'Google login failed'));
    }

    const data = await response.json();
    const auth = {
        user: data.user as AuthUser,
        session: data.session as AuthSession,
    };
    setStoredAuth(auth);
    return auth;
};

export const logout = async (): Promise<void> => {
    const refreshToken = getStoredAuth()?.session?.refresh_token;
    try {
        if (refreshToken) {
            await fetch(apiUrl('/api/auth/logout'), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
            });
        }
    } finally {
        clearStoredAuth();
    }
};

export const getCurrentUser = async (): Promise<AuthUser> => {
    const response = await authenticatedFetch(apiUrl('/api/auth/me'));

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

    const response = await authenticatedFetch(apiUrl('/api/detect'), {
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
    const response = await authenticatedFetch(apiUrl(`/api/reports/${encodeURIComponent(id)}`), {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error(await readErrorMessage(response, `Failed to delete report (${response.status})`));
    }
};
