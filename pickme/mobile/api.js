import AsyncStorage from '@react-native-async-storage/async-storage';

export const API = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';
let token = null;

export const setToken = (t) => { token = t };

export async function api(path, body, method, opts = {}) {
  const isFormData = body instanceof FormData;
  const r = await fetch(API + path, {
    method: method || (body ? 'POST' : 'GET'),
    headers: {
      'Content-Type': isFormData ? undefined : 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...opts.headers,
    },
    body: body
      ? isFormData
        ? body
        : JSON.stringify(body)
      : undefined,
  });
  let j = {};
  try { j = await r.json() } catch {}
  if (!r.ok) throw new Error(j.error || 'Request failed (' + r.status + ')');
  return j;
}

export const session = {
  save: (t, u) => AsyncStorage.setItem('s', JSON.stringify({ t, u })),
  load: async () => {
    const raw = await AsyncStorage.getItem('s');
    return raw ? JSON.parse(raw) : null;
  },
  clear: () => AsyncStorage.removeItem('s'),
};

export const onBoard = {
  seen: async () => {
    const v = await AsyncStorage.getItem('onboarded');
    return v === '1';
  },
  set: async () => { await AsyncStorage.setItem('onboarded', '1') },
};
