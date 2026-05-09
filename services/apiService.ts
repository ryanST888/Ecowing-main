import { AuthSession, AuthUser, DetectionResult, WasteDataPoint } from '../types';

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
        console.error('Failed to fetch history');
        return [];
    }
    return response.json();
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
