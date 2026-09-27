import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { api } from '../api';
import { s, Btn, In } from '../ui';
import { getCurrentGeneralLocation } from '../utils/location';

const privacyFields = [
  ['name', 'Name'],
  ['profileImage', 'Profile photo'],
  ['location', 'General location'],
  ['email', 'Email'],
  ['phone', 'Phone'],
  ['gender', 'Gender'],
];
const privacyDefaults = { name: 'visible', profileImage: 'visible', location: 'visible', email: 'contact-only', phone: 'contact-only', gender: 'visible' };
const privacyOptions = [['visible', 'Visible'], ['contact-only', 'Contact only'], ['hidden', 'Hidden']];

export default function ProfilePreferences({ userId, user, onSaved }) {
  const [city, setCity] = useState(user?.city || '');
  const [currentLocation, setCurrentLocation] = useState(null);
  const [privacy, setPrivacy] = useState({ ...privacyDefaults, ...(user?.privacy || {}) });
  const [locationStatus, setLocationStatus] = useState('idle');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setCity(user?.city || '');
    setCurrentLocation(null);
    setPrivacy({ ...privacyDefaults, ...(user?.privacy || {}) });
  }, [userId, user?.city, user?.privacy]);

  const useGpsLocation = async () => {
    setLocationStatus('loading'); setError('');
    try {
      const location = await getCurrentGeneralLocation();
      setCity(location.publicLabel); setCurrentLocation(location); setLocationStatus('ready');
    } catch (locationError) {
      setLocationStatus('error'); setError(locationError.message || 'Could not get your location. Type a general area instead.');
    }
  };

  const save = async () => {
    if (!city.trim()) return setError('Enter a general area or use current location.');
    setSaving(true); setError('');
    try {
      const updated = await api(`/api/users/${userId}`, { city: city.trim(), currentLocation: currentLocation || undefined, privacy }, 'PUT');
      setCurrentLocation(null);
      await onSaved(updated);
    } catch (saveError) { setError(saveError.message || 'Unable to save profile preferences.'); }
    finally { setSaving(false); }
  };

  return <View style={s.card}>
    <Text style={s.sectionTitle}>General location & privacy</Text>
    <Text style={s.authLabel}>General area (never shows coordinates)</Text>
    <In value={city} onChangeText={(value) => { setCity(value); setCurrentLocation(null); }} placeholder="Area or city" />
    <TouchableOpacity onPress={useGpsLocation} disabled={locationStatus === 'loading'}>
      <Text style={s.profileLink}>{locationStatus === 'loading' ? 'Getting current location…' : 'Use current location'}</Text>
    </TouchableOpacity>
    {locationStatus === 'ready' && <Text style={s.mute}>Using an approximate area; exact coordinates remain private.</Text>}
    {privacyFields.map(([field, label]) => <View key={field} style={{ marginTop: 8 }}>
      <Text style={s.authLabel}>{label} visibility</Text>
      <View style={s.selectWrap}><Picker selectedValue={privacy[field]} onValueChange={(value) => setPrivacy((current) => ({ ...current, [field]: value }))} style={s.genderPicker}>
        {privacyOptions.map(([value, title]) => <Picker.Item key={value} label={title} value={value} />)}
      </Picker></View>
    </View>)}
    {!!error && <Text style={s.authError}>{error}</Text>}
    <View style={s.profileButtonRow}><Btn small yellow t={saving ? 'Saving…' : 'Save preferences'} disabled={saving} onPress={save} /></View>
  </View>;
}