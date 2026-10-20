import { getToken, notifyUnauthorized } from './session';

const configuredUrl = process.env.EXPO_PUBLIC_API_URL;

export const API_URL = (configuredUrl || 'http://localhost:3000').replace(/\/$/, '');

export async function apiRequest(path, options = {}) {
  const token = getToken();
  const headers = { ...(options.headers || {}) };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_URL}${path}`, { ...options, headers });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : { error: await response.text() };

  if (!response.ok) {
    // Only a signed-in user can have an expired session. Login attempts that
    // fail (wrong code etc.) must not bounce the user around.
    if (response.status === 401 && token) {
      notifyUnauthorized();
    }
    const error = new Error(data.error || `Request failed with status ${response.status}`);
    error.code = data.code;
    error.status = response.status;
    throw error;
  }

  return data;
}
