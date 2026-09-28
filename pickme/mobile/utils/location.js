import { Platform } from 'react-native';
import * as Location from 'expo-location';

const GPS_TIMEOUT_MS = 10000;
const REVERSE_TIMEOUT_MS = 8000;

const coarseLocation = (name) =>
  name.split(',').map((part) => part.trim()).filter(Boolean).slice(-2).join(', ');

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
  ]);
}

async function reverseGeocode(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'PickMe-App/1.0' },
  });
  if (!res.ok) throw new Error('Reverse geocode failed');
  const data = await res.json();
  return data.display_name || '';
}

async function getCoords() {
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) throw new Error('Location is not available in this browser.');
    const position = await new Promise((resolve, reject) =>
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: GPS_TIMEOUT_MS,
      })
    );
    return position.coords;
  }

  const permission = await Location.requestForegroundPermissionsAsync();
  if (permission.status !== 'granted') {
    throw new Error('Location permission was denied. Allow access in your device settings, then try again.');
  }

  // Try last known position first — instant if available
  try {
    const last = await Location.getLastKnownPositionAsync();
    if (last?.coords) return last.coords;
  } catch (_) {}

  // Fresh GPS with hard timeout
  const result = await withTimeout(
    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
    GPS_TIMEOUT_MS,
    'GPS timed out. Please try again or type your location.'
  );
  return result.coords;
}

export async function getCurrentGeneralLocation() {
  const coords = await getCoords();

  const name = await withTimeout(
    reverseGeocode(coords.latitude, coords.longitude),
    REVERSE_TIMEOUT_MS,
    'Could not look up your area. Please type your location.'
  );

  const publicLabel = name ? coarseLocation(name) : '';
  if (!publicLabel) throw new Error('Could not identify your area. Please type your location.');

  return {
    publicLabel,
    privateCoordinates: { lat: coords.latitude, lng: coords.longitude },
  };
}
