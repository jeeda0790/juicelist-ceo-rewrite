import * as SecureStore from 'expo-secure-store';

// The login session token lives on the phone so the user stays signed in
// after closing the app. SecureStore keeps it in the phone's secure storage
// (Keychain on iPhone, Keystore on Android). The token itself expires on the
// server after 30 days, after which the user simply signs in again.
const TOKEN_KEY = 'juicelist_session_token';
const USER_KEY = 'juicelist_session_user';

let cachedToken = null;
let unauthorizedHandler = null;

export function getToken() {
  return cachedToken;
}

export async function loadSession() {
  try {
    const [token, userJson] = await Promise.all([
      SecureStore.getItemAsync(TOKEN_KEY),
      SecureStore.getItemAsync(USER_KEY),
    ]);
    if (!token) return null;
    cachedToken = token;
    return { token, user: userJson ? JSON.parse(userJson) : null };
  } catch (error) {
    console.error('Could not read saved session', error);
    return null;
  }
}

export async function saveSession(token, user) {
  cachedToken = token;
  try {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(user || null)),
    ]);
  } catch (error) {
    // The user is still signed in for this app run; they just will not be
    // remembered after closing the app.
    console.error('Could not save session', error);
  }
}

export async function clearSession() {
  cachedToken = null;
  try {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);
  } catch (error) {
    console.error('Could not clear saved session', error);
  }
}

// AuthContext registers a function here so that any API call that comes back
// "401 session expired" signs the user out and shows the login screen.
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized() {
  if (unauthorizedHandler) unauthorizedHandler();
}
