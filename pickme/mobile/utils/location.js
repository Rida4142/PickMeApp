import { Platform } from 'react-native';
import * as Location from 'expo-location';
import { api } from '../api';

const coarseLocation = (name) => name.split(',').map((part) => part.trim()).filter(Boolean).slice(-2).join(', ');

export async function getCurrentGeneralLocation() {
  let coords;
  if (Platform.OS === 'web') {
    if (!navigator.geolocation) throw new Error('Location is not available in this browser.');
    const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: false, timeout: 15000 }));
    coords = position.coords;
  } else {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') throw new Error('Location permission was denied. Allow access in your device or browser settings, then try again.');
    coords = (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })).coords;
  }
  const result = await api(`/api/reverse?lat=${coords.latitude}&lng=${coords.longitude}`);
  const publicLabel = result?.name ? coarseLocation(result.name) : '';
  if (!publicLabel) throw new Error('We could not identify a general area from your current location. Please try again.');
  return { publicLabel, privateCoordinates: { lat: coords.latitude, lng: coords.longitude } };
}