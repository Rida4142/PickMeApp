import React, { useEffect, useState } from 'react';
import { Alert, Image, Linking, Platform, SafeAreaView, ScrollView, Switch, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { api, session } from '../api';
import { C, s, Btn, In, Stars } from '../ui';
import { DoodleSparkles, RouteDoodle } from '../components/Illustrations';
import ProfilePreferences from '../components/ProfilePreferences';
import SeatOccupancy from '../components/SeatOccupancy';
import { getCurrentGeneralLocation } from '../utils/location';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const SAVED_LOCATION_TYPES = ['Home', 'University', 'Work', 'Other'];
const say = (message) => Platform.OS === 'web' ? window.alert(message) : Alert.alert('PickMe', message);
const hav = (a, b) => { const r = (x) => x * Math.PI / 180; const k = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(k)); };
const wa = (phone, text) => phone ? Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`) : say('This user has not shared their phone number.');

export const Guest = ({ go }) => <View style={s.card}><Text style={s.name}>Log in to continue</Text><Btn t="Log in / Sign up" onPress={() => go('auth')} /></View>;

export function DetailScreen({ commute, back, need }) {
  const [profile, setProfile] = useState(null); const [sent, setSent] = useState(false);
  useEffect(() => { api(`/api/users/${commute.user._id}`).then(setProfile).catch(() => {}); }, [commute.user._id]);
  const join = () => { if (!need()) return; api('/api/requests', { commuteId: commute._id }).then(() => { setSent(true); say('Request sent! You can also WhatsApp them.'); }).catch((error) => say(error.message)); };
  const message = `Hi ${commute.user.name || 'rider'}! I found you on PickMe. Are you still going ${commute.origin.name} → ${commute.dest.name} around ${commute.startTime}?`;
  const report = () => need() && api('/api/report', { userId: commute.user._id, reason: 'Reported from ride details' }).then(() => say('Reported. Thanks!')).catch((error) => say(error.message));
  const block = () => need() && api('/api/block', { userId: commute.user._id }).then(() => { say('Blocked.'); back(); }).catch((error) => say(error.message));
  return <SafeAreaView style={s.fill}><ScrollView contentContainerStyle={s.pad}>
    <TouchableOpacity onPress={back} style={s.backLink}><Text style={s.backLinkText}>←  Available rides</Text></TouchableOpacity>
    <Text style={s.h2}>Ride Details</Text>
    <View style={s.card}>
      <View style={s.detailTopRow}><View style={{ flex: 1 }}><Text style={s.name}>{commute.user.name || 'PickMe rider'}{commute.user.verified ? '  ✓' : ''}</Text><Text style={s.rideRating}>★ {commute.user.avg || 'New'} <Text style={s.mute}>· {commute.user.count} ratings</Text></Text></View><View style={s.matchBadge}><Text style={s.matchBadgeText}>{commute.score}%</Text><Text style={s.matchBadgeCaption}>match</Text></View></View>
      <View style={s.detailDeparture}><Text style={s.detailDepartureTime}>{commute.startTime}</Text><Text style={s.mute}>Departure · until {commute.endTime}</Text></View>
      <View style={s.detailStop}><View style={s.detailOriginPin} /><View style={{ flex: 1 }}><Text style={s.detailStopLabel}>FROM</Text><Text style={s.rideRouteName}>{commute.origin.name}</Text></View></View>
      <RouteDoodle style={s.detailRouteDoodle} />
      <View style={s.detailStop}><View style={s.detailDestinationPin} /><View style={{ flex: 1 }}><Text style={s.detailStopLabel}>TO</Text><Text style={s.rideRouteName}>{commute.dest.name}</Text></View></View>
      <View style={s.detailFacts}><Text style={s.detailFact}>{commute.seats} seats</Text><Text style={s.detailFact}>Rs. {commute.price} / seat</Text></View>
      <Text style={s.detailSchedule}>{commute.startDate || 'Date flexible'} → {commute.endDate || 'Date flexible'} · {commute.days.map((day) => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][day]).join(', ')}</Text>
    </View>
    {sent && <View style={s.successBanner}><DoodleSparkles style={s.successSparkle} /><View style={{ flex: 1 }}><Text style={s.successTitle}>Request sent</Text><Text style={s.successCopy}>You’re one step closer to sharing this route.</Text><RouteDoodle style={s.successBannerRoute} /></View></View>}
    <Btn yellow t={sent ? 'Request sent ✓' : 'Request to Join  →'} onPress={join} />
    {!!commute.user.phone&&<Btn dark t="Chat on WhatsApp  →" onPress={() => wa(commute.user.phone, message)} />}
    <Text style={s.lbl}>Reviews</Text>
    {profile && profile.reviews.length === 0 && <Text style={s.mute}>No reviews yet.</Text>}
    {profile && profile.reviews.map((review, index) => <View key={index} style={s.card}><Stars v={review.stars} /><Text>{review.comment || '—'}</Text><Text style={s.mute}>by {review.from || 'rider'}</Text></View>)}
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}><Btn style={{ flex: 1, backgroundColor: C.lav }} t="Report" onPress={report} /><Btn style={{ flex: 1, backgroundColor: C.red }} t="Block" onPress={block} /></View>
  </ScrollView></SafeAreaView>;
}

export function RequestsScreen() {
  const [data, setData] = useState({ incoming: [], outgoing: [] }); const [tripForm, setTripForm] = useState(null); const [matches, setMatches] = useState([]);
  const load = () => api('/api/requests').then(setData).catch((error) => say(error.message));
  useEffect(() => { load(); api('/api/commutes/mine').then((commutes) => commutes[0] && api('/api/match', commutes[0])).then((result) => result && setMatches(result.slice(0, 3))).catch(() => {}); }, []);
  const act = (id, status) => api(`/api/requests/${id}`, { status }, 'PATCH').then(load);
  const accepted = {}; data.incoming.filter((request) => request.status === 'accepted' && request.commuteId).forEach((request) => { (accepted[request.commuteId._id] = accepted[request.commuteId._id] || { commute: request.commuteId, count: 0 }).count += 1; });
  const finish = () => api('/api/trips', { commuteId: tripForm.commute._id, distanceKm: tripForm.km, fare: tripForm.fare }).then((trip) => { setTripForm(null); say(`Trip recorded! Each person pays Rs. ${trip.perPerson}.`); load(); }).catch((error) => say(error.message));
  return <><Text style={s.h2}>Requests & matches</Text>{matches.length > 0 && <><Text style={s.sectionTitle}>Best matches for your commute</Text>{matches.map((match) => <View key={match._id} style={s.matchCard}><View style={{ flex: 1 }}><Text style={s.name}>{match.user.name}</Text><Text style={s.mute}>★ {match.user.avg || 'New'} · {match.startTime} · {match.origin.name} → {match.dest.name}</Text><Text style={s.matchReason}>Going your way · {match.explanation?.daysOverlap}</Text></View><Text style={s.matchScore}>{match.score}%</Text></View>)}</>}<Text style={s.lbl}>People who want to join you</Text>{data.incoming.length === 0 && <Text style={s.mute}>None yet.</Text>}{data.incoming.map((request) => <View key={request._id} style={s.card}><Text style={s.name}>{request.fromUser?.name}</Text><Text style={s.mute}>{request.commuteId?.origin?.name} → {request.commuteId?.dest?.name} · {request.status}</Text>{request.status === 'pending' && <View style={{ flexDirection: 'row', gap: 10 }}><Btn style={{ flex: 1 }} yellow t="Accept" onPress={() => act(request._id, 'accepted')} /><Btn style={{ flex: 1, backgroundColor: C.red }} t="Reject" onPress={() => act(request._id, 'rejected')} /></View>}{request.status === 'accepted' && <Btn dark t="WhatsApp rider" onPress={() => wa(request.fromUser.phone, 'Hi! Your PickMe request is accepted.')} />}</View>)}{Object.values(accepted).map(({ commute, count }) => <View key={commute._id} style={[s.card, { backgroundColor: C.mint }]}><Text style={s.name}>Ride complete with {count} rider(s)?</Text>{tripForm && tripForm.commute._id === commute._id ? <><Text style={s.lbl}>Distance (km)</Text><In keyboardType="numeric" value={String(tripForm.km)} onChangeText={(value) => setTripForm({ ...tripForm, km: value })} /><Text style={s.lbl}>Total fare (Rs)</Text><In keyboardType="numeric" value={tripForm.fare} onChangeText={(value) => setTripForm({ ...tripForm, fare: value })} placeholder="e.g. 1200" /><Text style={s.mute}>{tripForm.fare ? `Split ${count + 1} ways: Rs. ${Math.round(+tripForm.fare / (count + 1))} each` : 'Enter fare to see split'}</Text><Btn t="Save trip & split cost" onPress={finish} /></> : <Btn yellow t="Complete trip & split cost" onPress={() => setTripForm({ commute, km: Math.round(hav(commute.origin, commute.dest) * 1.3), fare: '' })} />}</View>)}<Text style={s.lbl}>Requests you sent</Text>{data.outgoing.length === 0 && <Text style={s.mute}>None yet.</Text>}{data.outgoing.map((request) => <View key={request._id} style={s.card}><Text style={s.name}>{request.toUser?.name}</Text><Text style={s.mute}>{request.commuteId?.origin?.name} → {request.commuteId?.dest?.name}</Text><Text style={{ fontWeight: '700' }}>{request.status.toUpperCase()}</Text></View>)}</>;
}

export function TripsScreen({ me, focusTripId }) {
  const [trips, setTrips] = useState([]);
  const load = () => api('/api/trips/mine').then((items) => setTrips((items || []).map((item) => item._doc ? { ...item._doc, rated: item.rated || [] } : item))).catch((error) => say(error.message));
  useEffect(() => { load(); }, []);
  const rate = (tripId, toUser, stars) => api('/api/ratings', { tripId, toUser, stars }).then(load).catch((error) => say(error.message));
  return <>
    <Text style={s.h2}>Trips & Ratings</Text>
    {trips.length === 0 && <View style={s.emptyState}><RouteDoodle style={s.emptyRouteDoodle} /><Text style={s.name}>Your next shared journey starts here.</Text><Text style={[s.mute, { marginTop: 5 }]}>Completed trips and ratings will appear on this route.</Text></View>}
    {trips.map((trip) => {
      const people = [trip.driverId, ...(trip.riders || [])].filter((person) => person && String(person._id) !== String(me?._id));
      const rated = trip.rated || [];
      return <View key={trip._id} style={[s.card, String(trip._id) === String(focusTripId) && { borderColor: C.red, borderWidth: 2 }]}>
        <View style={s.tripRouteRow}><Text style={s.tripRouteText} numberOfLines={1}>{trip.origin?.name || 'Unknown pickup'}</Text><Text style={s.tripRouteArrow}>→</Text><Text style={s.tripRouteText} numberOfLines={1}>{trip.dest?.name || 'Unknown destination'}</Text></View>
        <Text style={s.mute}>{trip.createdAt ? new Date(trip.createdAt).toDateString() : 'Recent trip'} · {trip.distanceKm || 0} km</Text>
        <Text style={s.tripFare}>Rs. {trip.perPerson || 0} each</Text>
        {people.map((person) => <View key={person._id} style={s.tripRiderRow}><Text style={s.tripRiderName}>{person.name || 'Participant'}</Text>{rated.includes(String(person._id)) ? <Text style={s.mute}>Rated ✓</Text> : <Stars v={0} set={(stars) => rate(trip._id, person._id, stars)} />}</View>)}
      </View>;
    })}
  </>;
}

export function ProfileScreen({ me, logout, go, setForm, setMe, notice }) {
  const { width } = useWindowDimensions();
  const userId = me?._id || me?.id;
  const [commutes, setCommutes] = useState([]);
  const [locations, setLocations] = useState([]);
  const [buddies, setBuddies] = useState([]);
  const [occupancy, setOccupancy] = useState({});
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingProfile, setEditingProfile] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [saving, setSaving] = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationError, setLocationError] = useState('');
  const [savedLocationDraft, setSavedLocationDraft] = useState(null);
  const [savedLocationQuery, setSavedLocationQuery] = useState('');
  const [savedLocationOptions, setSavedLocationOptions] = useState([]);
  const [savedLocationError, setSavedLocationError] = useState('');
  const [savedLocationSaving, setSavedLocationSaving] = useState(false);
  const [profilePhotoSaving, setProfilePhotoSaving] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState('');
  const [profileDraft, setProfileDraft] = useState({ name: '', email: '', phone: '', gender: '', city: '', currentLocation: null });
  const [vehicleDraft, setVehicleDraft] = useState({ make: '', model: '', type: '', color: '', passengerCapacity: '', active: true });
  const user = profile?.user || me;
  const vehicle = user?.vehicle;
  const load = async () => {
    setLoading(true); setError('');
    try {
      if (!userId) throw new Error('Your session does not contain a user ID. Please log in again.');
      const [userData, commuteData] = await Promise.all([api(`/api/users/${userId}`), api('/api/commutes/mine')]);
      setProfile(userData); setCommutes(commuteData || []);
      const [locationData, buddyData] = await Promise.all([api('/api/locations').catch(() => []), api('/api/buddies').catch(() => [])]);
      setLocations(locationData || []); setBuddies(buddyData || []);
      const occupancyEntries = await Promise.all((commuteData || []).map(async (commute) => [commute._id, await api(`/api/commutes/${commute._id}/occupancy`).catch(() => null)]));
      setOccupancy(Object.fromEntries(occupancyEntries.filter(([, value]) => value)));
    } catch (loadError) {
      console.error('Profile load failed', loadError);
      if (loadError.message === 'Not found') { await logout(); return; }
      setError(loadError.message || 'Unable to load your profile. Try again.');
    }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, [userId]);
  const startProfileEdit = () => { const gender=user.gender?String(user.gender).charAt(0).toUpperCase()+String(user.gender).slice(1).toLowerCase():''; setProfileDraft({ name: user.name || '', email: user.email || '', phone: user.phone || '', gender, city: user.city || '', currentLocation: null }); setEditingProfile(true); setError(''); };
  const startVehicleEdit = () => { setVehicleDraft({ make: vehicle?.make || '', model: vehicle?.model || '', type: vehicle?.type || '', color: vehicle?.color || '', passengerCapacity: String(vehicle?.passengerCapacity || vehicle?.seats || ''), active: vehicle?.active !== false }); setEditingVehicle(true); setError(''); };
  const setProfileField = (key, value) => setProfileDraft((current) => ({ ...current, [key]: value }));
  const setVehicleField = (key, value) => setVehicleDraft((current) => ({ ...current, [key]: value }));
  const syncProfileUpdate = async (updatedUser) => {
    setProfile((current) => ({ ...current, user: updatedUser })); setMe(updatedUser);
    const saved = await session.load(); if (saved?.t) await session.save(saved.t, updatedUser);
  };
  const chooseLocation = async () => {
    setLocationStatus('loading'); setLocationError('');
    try { const location = await getCurrentGeneralLocation(); setProfileDraft((current) => ({ ...current, city: location.publicLabel, currentLocation: location })); setLocationStatus('ready'); }
    catch (locationLoadError) { setLocationStatus('error'); setLocationError(locationLoadError.message || 'Unable to get your current location.'); }
  };
  const saveProfile = async () => {
    if (!profileDraft.name.trim()) return setError('Name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileDraft.email.trim())) return setError('Enter a valid email address.');
    if (!profileDraft.gender) return setError('Gender is required.');
    setSaving(true); setError('');
    try {
      const updated = await api(`/api/users/${userId}`, { name: profileDraft.name.trim(), email: profileDraft.email.trim(), phone: profileDraft.phone.trim(), gender: profileDraft.gender, city: profileDraft.city.trim(), currentLocation: profileDraft.currentLocation || undefined }, 'PUT');
      const nextUser = { ...user, ...updated, name: profileDraft.name.trim(), email: profileDraft.email.trim(), phone: updated.phone || profileDraft.phone.trim(), gender: profileDraft.gender, city: profileDraft.city.trim() };
      setProfile((current) => ({ ...current, user: nextUser }));
      setMe(nextUser);
      const saved = await session.load(); if (saved?.t) await session.save(saved.t, nextUser);
      setEditingProfile(false);
    } catch (saveError) { setError(saveError.message || 'Unable to save profile.'); }
    finally { setSaving(false); }
  };
  const saveVehicle = async () => {
    const passengerCapacity = Number(vehicleDraft.passengerCapacity);
    if (!vehicleDraft.make.trim() || !vehicleDraft.model.trim() || !vehicleDraft.type.trim() || !vehicleDraft.color.trim()) return setError('Complete all vehicle fields.');
    if (!Number.isInteger(passengerCapacity) || passengerCapacity < 1) return setError('Passenger capacity must be a whole number greater than zero.');
    setSaving(true); setError('');
    try {
      const result = await api(`/api/users/${userId}/vehicle`, { ...vehicleDraft, passengerCapacity }, 'PUT');
      setProfile((current) => ({ ...current, user: { ...current.user, vehicle: result.vehicle } })); setEditingVehicle(false);
    } catch (saveError) { setError(saveError.message || 'Unable to save vehicle.'); }
    finally { setSaving(false); }
  };
  const syncProfilePhoto = async (updatedUser) => {
    setProfile((current) => ({ ...current, user: updatedUser }));
    setMe(updatedUser);
    const saved = await session.load(); if (saved?.t) await session.save(saved.t, updatedUser);
  };
  const chooseProfilePhoto = async () => {
    setProfilePhotoError('');
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [1, 1], quality: 0.85 });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset) return setProfilePhotoError('No photo was selected. Try again.');
      const body = new FormData();
      if (Platform.OS === 'web') {
        const response = await fetch(asset.uri);
        if (!response.ok) throw new Error('Unable to read the selected photo.');
        body.append('photo', await response.blob(), asset.fileName || 'profile-photo.jpg');
      } else {
        body.append('photo', { uri: asset.uri, name: asset.fileName || 'profile-photo.jpg', type: asset.mimeType || 'image/jpeg' });
      }
      setProfilePhotoSaving(true);
      const response = await api('/api/profile-image', body);
      await syncProfilePhoto(response.user);
    } catch (photoError) { setProfilePhotoError(photoError.message || 'Unable to save profile photo.'); }
    finally { setProfilePhotoSaving(false); }
  };
  const removeProfilePhoto = async () => {
    setProfilePhotoSaving(true); setProfilePhotoError('');
    try { const response = await api('/api/profile-image', null, 'DELETE'); await syncProfilePhoto(response.user); }
    catch (photoError) { setProfilePhotoError(photoError.message || 'Unable to remove profile photo.'); }
    finally { setProfilePhotoSaving(false); }
  };
  const confirmRemoveProfilePhoto = () => {
    if (Platform.OS === 'web') { if (window.confirm('Remove your profile photo?')) removeProfilePhoto(); return; }
    Alert.alert('Remove profile photo?', 'Your profile will show your initials instead.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: removeProfilePhoto },
    ]);
  };
  const editSavedLocation = (location) => {
    setSavedLocationDraft(location ? { ...location, type: SAVED_LOCATION_TYPES.includes(location.type) ? location.type : 'Other' } : { label: '', name: '', lat: null, lng: null, type: 'Other' });
    setSavedLocationQuery(location?.name || '');
    setSavedLocationOptions([]);
    setSavedLocationError('');
  };
  const searchSavedLocation = async () => {
    if (!savedLocationQuery.trim()) return setSavedLocationError('Enter an address or landmark to search.');
    setSavedLocationError('');
    try {
      const options = await api(`/api/geocode?q=${encodeURIComponent(savedLocationQuery.trim())}`);
      setSavedLocationOptions(options || []);
      if (!options?.length) setSavedLocationError('No locations found. Try another area or landmark.');
    } catch (searchError) { setSavedLocationError(searchError.message || 'Unable to search for this location.'); }
  };
  const saveSavedLocation = async () => {
    const latitude = Number(savedLocationDraft?.lat), longitude = Number(savedLocationDraft?.lng);
    if (!savedLocationDraft?.label?.trim()) return setSavedLocationError('Enter a label for this saved location.');
    if (!savedLocationDraft?.name?.trim() || savedLocationDraft.lat == null || savedLocationDraft.lng == null || !Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return setSavedLocationError('Search for and select a valid address first.');
    const body = { label: savedLocationDraft.label.trim(), name: savedLocationDraft.name.trim(), lat: latitude, lng: longitude, type: (savedLocationDraft.type || '').trim() };
    setSavedLocationSaving(true); setSavedLocationError('');
    try {
      const saved = savedLocationDraft._id
        ? await api(`/api/locations/${savedLocationDraft._id}`, body, 'PUT')
        : await api('/api/locations', body);
      setLocations((current) => savedLocationDraft._id ? current.map((location) => location._id === saved._id ? saved : location) : [saved, ...current]);
      setSavedLocationDraft(null); setSavedLocationQuery(''); setSavedLocationOptions([]);
    } catch (saveError) { setSavedLocationError(saveError.message || 'Unable to save this location.'); }
    finally { setSavedLocationSaving(false); }
  };
  const removeSavedLocation = async (location) => {
    setSavedLocationSaving(true); setSavedLocationError('');
    try {
      await api(`/api/locations/${location._id}`, null, 'DELETE');
      setLocations((current) => current.filter((item) => item._id !== location._id));
      if (savedLocationDraft?._id === location._id) setSavedLocationDraft(null);
    } catch (deleteError) { setSavedLocationError(deleteError.message || 'Unable to delete this location.'); }
    finally { setSavedLocationSaving(false); }
  };
  const confirmRemoveSavedLocation = (location) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`Delete ${location.label || location.name}?`)) removeSavedLocation(location);
      return;
    }
    Alert.alert('Delete saved location?', location.label || location.name, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => removeSavedLocation(location) },
    ]);
  };
  if (loading) return <View style={s.profileContainer}><Text style={s.h2}>Profile</Text><RouteDoodle repeat style={s.loadingRoute} /><Text style={s.mute}>Finding your profile details…</Text></View>;
  if (error && !profile) return <View style={s.profileContainer}><Text style={s.h2}>Profile</Text><DoodleSparkles style={s.noticeSparkle} /><Text style={s.authError}>{error}</Text><Text style={s.locationNotice}>The road disappeared for a moment. Check your connection and try again.</Text><Btn yellow t="Try again" onPress={load} /></View>;
  const initials = (user.name || 'P').split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase();
  const rating = profile?.rating || { average: 0, count: 0 };
  const primaryOccupancy = commutes.length ? occupancy[commutes[0]._id] : null;
  return <View style={[s.profileContainer, { maxWidth: width >= 700 ? 780 : 780 }]}>
    <View style={s.profileHeader}><View style={s.profileAvatar}>{user.profileImage ? <Image source={{ uri: user.profileImage }} style={s.profileAvatarImage} /> : <Text style={s.profileAvatarText}>{initials}</Text>}</View><View style={s.profileIdentity}><Text style={s.h2}>{user.name || 'Name not available'}</Text><Text style={s.mute}>{user.email || 'Email not available'}</Text><Text style={s.mute}>{user.phone || 'Phone not available'}</Text></View><TouchableOpacity onPress={startProfileEdit}><Text style={s.profileLink}>Edit profile</Text></TouchableOpacity></View>
    <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}><TouchableOpacity onPress={chooseProfilePhoto} disabled={profilePhotoSaving}><Text style={s.profileLink}>{profilePhotoSaving ? 'Saving photo…' : user.profileImage ? 'Change photo' : 'Add photo'}</Text></TouchableOpacity>{!!user.profileImage&&<TouchableOpacity onPress={confirmRemoveProfilePhoto} disabled={profilePhotoSaving}><Text style={s.profileDanger}>Remove photo</Text></TouchableOpacity>}</View>
    {!!profilePhotoError&&<Text style={s.authError}>{profilePhotoError}</Text>}
    <ProfilePreferences userId={userId} user={user} onSaved={syncProfileUpdate} />
    {!!notice && <View style={s.successBanner}><DoodleSparkles style={s.successSparkle} /><View style={{ flex: 1 }}><Text style={s.successTitle}>{notice}</Text><Text style={s.successCopy}>Your commute is ready for the PickMe community.</Text><RouteDoodle style={s.successBannerRoute} /></View></View>}
    {!!error && <Text style={s.authError}>{error}</Text>}
    {editingProfile ? <View style={s.card}><Text style={s.sectionTitle}>Personal information</Text><Text style={s.authLabel}>Full Name *</Text><In value={profileDraft.name} onChangeText={(value) => setProfileField('name', value)} /><Text style={s.authLabel}>Email *</Text><In value={profileDraft.email} autoCapitalize="none" keyboardType="email-address" onChangeText={(value) => setProfileField('email', value)} /><Text style={s.authLabel}>Phone Number</Text><In value={profileDraft.phone} keyboardType="phone-pad" onChangeText={(value) => setProfileField('phone', value)} /><Text style={s.authLabel}>Gender *</Text><View style={s.selectWrap}><Picker selectedValue={profileDraft.gender} onValueChange={(value) => setProfileField('gender', value)} style={s.genderPicker}><Picker.Item label="Select gender" value="" /><Picker.Item label="Female" value="Female" /><Picker.Item label="Male" value="Male" /><Picker.Item label="Non-binary" value="Non-binary" /><Picker.Item label="Prefer not to say" value="Prefer not to say" /></Picker></View><Text style={s.authLabel}>Current/general location</Text><In value={profileDraft.city} editable={false} placeholder="Location not available" /><TouchableOpacity onPress={chooseLocation} disabled={locationStatus === 'loading'}><Text style={s.profileLink}>{locationStatus === 'loading' ? 'Getting current location...' : 'Use my current location'}</Text></TouchableOpacity>{!!locationError && <Text style={s.authError}>{locationError}</Text>}<View style={s.profileButtonRow}><Btn small outline t="Cancel" onPress={() => setEditingProfile(false)} /><Btn small yellow t={saving ? 'Saving...' : 'Save profile'} disabled={saving} onPress={saveProfile} /></View></View> : <View style={s.card}><Text style={s.sectionTitle}>Personal information</Text><Text style={s.profileValueLabel}>Gender</Text><Text style={s.profileValue}>{user.gender || 'Gender not available'}</Text><Text style={s.profileValueLabel}>Current/general location</Text><Text style={s.profileValue}>{user.city || 'Location not available'}</Text></View>}
    <View style={s.card}><Text style={s.sectionTitle}>Rating</Text>{rating.count > 0 ? <View style={s.ratingRow}><Text style={s.ratingNumber}>★ {rating.average}</Text><Text style={s.mute}>{rating.count} ratings</Text></View> : <Text style={s.mute}>No ratings yet</Text>}{profile?.reviews?.slice(0, 3).map((review, index) => <View key={index} style={s.reviewRow}><Text style={s.name}>{review.from || 'PickMe user'} · {review.stars}/5</Text>{review.comment && <Text style={s.mute}>{review.comment}</Text>}</View>)}</View>
    <View style={s.card}><View style={s.sectionHeaderRow}><Text style={s.sectionTitle}>Vehicle</Text><TouchableOpacity onPress={startVehicleEdit}><Text style={s.profileLink}>{vehicle ? 'Edit vehicle' : 'Add vehicle'}</Text></TouchableOpacity></View>{editingVehicle ? <><Text style={s.authLabel}>Make</Text><In value={vehicleDraft.make} onChangeText={(value) => setVehicleField('make', value)} /><Text style={s.authLabel}>Model</Text><In value={vehicleDraft.model} onChangeText={(value) => setVehicleField('model', value)} /><Text style={s.authLabel}>Type</Text><In value={vehicleDraft.type} onChangeText={(value) => setVehicleField('type', value)} /><Text style={s.authLabel}>Color</Text><In value={vehicleDraft.color} onChangeText={(value) => setVehicleField('color', value)} /><Text style={s.authLabel}>Passengers (driver excluded)</Text><In keyboardType="numeric" value={vehicleDraft.passengerCapacity} onChangeText={(value) => setVehicleField('passengerCapacity', value)} /><View style={s.switchRow}><Text style={s.profileValue}>Vehicle active</Text><Switch value={vehicleDraft.active} onValueChange={(value) => setVehicleField('active', value)} /></View><View style={s.profileButtonRow}><Btn small outline t="Cancel" onPress={() => setEditingVehicle(false)} /><Btn small yellow t={saving ? 'Saving...' : 'Save vehicle'} disabled={saving} onPress={saveVehicle} /></View></> : vehicle ? <><Text style={s.profileVehicleTitle}>{vehicle.make || ''} {vehicle.model || ''}</Text><Text style={s.profileValue}>{vehicle.type || 'Type not available'} · {vehicle.color || 'Color not available'}</Text><Text style={s.profileValue}>{vehicle.passengerCapacity || vehicle.seats || 0} passengers (driver excluded) · {vehicle.active === false ? 'Inactive' : 'Active'}</Text></> : <Text style={s.mute}>No vehicle added</Text>}</View>
    {vehicle && <SeatOccupancy occupancy={primaryOccupancy} />}
    <View style={s.card}><View style={s.sectionHeaderRow}><Text style={s.sectionTitle}>Saved locations</Text><TouchableOpacity onPress={() => editSavedLocation()} disabled={savedLocationSaving}><Text style={s.profileLink}>Add location</Text></TouchableOpacity></View>
      {savedLocationDraft&&<View><Text style={s.lbl}>{savedLocationDraft._id?'Edit saved location':'Add saved location'}</Text><Text style={s.authLabel}>Label</Text><In placeholder="Home, Work, etc." value={savedLocationDraft.label} onChangeText={(value)=>setSavedLocationDraft((current)=>({...current,label:value}))}/><Text style={s.authLabel}>Address or landmark</Text><In placeholder="Search an address or landmark" value={savedLocationQuery} onChangeText={(value)=>{setSavedLocationQuery(value);setSavedLocationDraft((current)=>({...current,name:value,lat:null,lng:null}));setSavedLocationOptions([])}}/><Btn small outline t="Search locations" disabled={savedLocationSaving} onPress={searchSavedLocation}/>{savedLocationOptions.map((option,index)=><TouchableOpacity key={`${option.lat}-${option.lng}-${index}`} style={s.locationSuggestion} onPress={()=>{setSavedLocationDraft((current)=>({...current,name:option.name,lat:option.lat,lng:option.lng}));setSavedLocationQuery(option.name);setSavedLocationOptions([]);setSavedLocationError('')}}><Text style={s.locationSuggestionText}>{option.name}</Text></TouchableOpacity>)}<Text style={s.authLabel}>Type</Text><View style={s.selectWrap}><Picker selectedValue={savedLocationDraft.type||'Other'} onValueChange={(value)=>setSavedLocationDraft((current)=>({...current,type:value}))} style={s.genderPicker}>{SAVED_LOCATION_TYPES.map(type=><Picker.Item key={type} label={type} value={type}/>)}</Picker></View>{!!savedLocationDraft.name&&savedLocationDraft.lat!=null&&<Text style={s.mute}>Coordinates selected: {Number(savedLocationDraft.lat).toFixed(4)}, {Number(savedLocationDraft.lng).toFixed(4)}</Text>}<View style={s.profileButtonRow}><Btn small outline t="Cancel" disabled={savedLocationSaving} onPress={()=>{setSavedLocationDraft(null);setSavedLocationOptions([]);setSavedLocationError('')}}/><Btn small yellow t={savedLocationSaving?'Saving…':'Save location'} disabled={savedLocationSaving} onPress={saveSavedLocation}/></View></View>}
      {!!savedLocationError&&<Text style={s.authError}>{savedLocationError}</Text>}
      {locations.length===0?<View style={s.savedLocationEmpty}><Text style={s.savedLocationEmptyIcon}>⌖</Text><Text style={s.mute}>Save Home, University, or Work to add familiar stops faster.</Text></View>:locations.map((location)=><View key={location._id} style={s.listRow}><View style={{flex:1}}><Text style={s.name}>{location.label||'Saved location'}</Text><Text style={s.mute}>{location.name||'General location'}</Text></View><TouchableOpacity onPress={()=>editSavedLocation(location)} disabled={savedLocationSaving}><Text style={s.profileLink}>Edit</Text></TouchableOpacity><TouchableOpacity onPress={()=>confirmRemoveSavedLocation(location)} disabled={savedLocationSaving}><Text style={s.profileDanger}>Delete</Text></TouchableOpacity></View>)}
    </View>
    <View style={s.card}><Text style={s.sectionTitle}>Buddies</Text>{buddies.length === 0 ? <Text style={s.mute}>No buddies yet</Text> : buddies.map((entry) => <View key={entry._id} style={s.buddyRow}><View style={s.buddyAvatar}>{entry.buddy?.profileImage ? <Image source={{ uri: entry.buddy.profileImage }} style={s.buddyImage} /> : <Text style={s.buddyInitial}>{(entry.buddy?.name || 'P')[0].toUpperCase()}</Text>}</View><View><Text style={s.name}>{entry.buddy?.name || 'PickMe user'}</Text><Text style={s.mute}>{entry.buddy?.city || 'Location not available'}</Text></View></View>)}</View>
    <Text style={s.sectionTitle}>My commutes</Text>{commutes.length === 0 && <Text style={s.mute}>Nothing posted yet — use the + tab.</Text>}{commutes.map((commute) => { const data=occupancy[commute._id]; return <View key={commute._id} style={s.card}><Text style={{ fontWeight: '700' }}>{commute.origin.name} → {commute.dest.name}</Text><Text style={s.mute}>{commute.startTime}–{commute.endTime} · {commute.role} · {commute.days.map((day) => DAYS[day]).join('')} · {commute.paused ? 'Paused' : 'Active'}</Text>{data && <View style={s.occupancyBox}><Text style={s.mute}>Next occurrence: {data.date}</Text><View style={s.seatGrid}>{data.seats.map((seat) => <View key={seat.number} style={[s.seat, seat.status === 'occupied' ? s.seatOccupied : s.seatOpen]}><Text style={s.seatNumber}>S{seat.number}</Text><Text style={s.seatStatus}>{seat.status.toUpperCase()}</Text></View>)}</View><Text style={s.profileValue}>Open: {data.availableSeats} · Occupied: {data.occupiedSeats}</Text></View>}<View style={s.profileActionRow}><Text onPress={() => { setForm({ ...commute, seats: String(commute.seats || commute.passengerCapacity || 1), price: String(commute.price || 0) }); go('post'); }} style={s.profileLink}>Edit</Text><Text onPress={() => api(`/api/commutes/${commute._id}`, { paused: !commute.paused }, 'PATCH').then(load)} style={s.profileLink}>{commute.paused ? 'Resume' : 'Pause'}</Text><Text onPress={() => api(`/api/commutes/${commute._id}`, null, 'DELETE').then(load)} style={s.profileDanger}>Delete</Text></View></View>; })}
    <View style={s.profileLogout}><Btn red t="Log out" onPress={logout} /></View>
  </View>;
}
