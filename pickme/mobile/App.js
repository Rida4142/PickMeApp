import React, { Component, useEffect, useState } from 'react';
import { Alert, Linking, Platform, SafeAreaView, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { api, onBoard, session, setToken } from './api';
import { C, s, Btn } from './ui';
import CommuteForm from './components/CommuteForm';
import { CarIllustration } from './components/Illustrations';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { DetailScreen, Guest, ProfileScreen, RequestsScreen, TripsScreen } from './screens/RideScreens';
import { plusDays, today } from './utils/dates';
const blankCommute = () => ({ origin: null, dest: null, days: [0, 1, 2, 3, 4], startTime: '08:30', endTime: '09:00', startDate: today(), endDate: plusDays(30), role: 'need', seats: '1', price: '0' });
const say = (message) => Platform.OS === 'web' ? window.alert(message) : Alert.alert('PickMe', message);
const tabs = [['home', '⌂', 'Home'], ['post', '+', 'Post'], ['requests', '▣', 'Requests'], ['trips', '◷', 'Trips'], ['profile', '●', 'Profile']];

function App() {
  const [screen, setScreen] = useState('splash');
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(blankCommute());
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [onboardingPage, setOnboardingPage] = useState(0);
  const [authLocked, setAuthLocked] = useState(false);
  const { width } = useWindowDimensions();

  useEffect(() => {
    let mounted = true;
    let splashTimer;
    (async () => {
      const saved = await session.load();
      const onboardingSeen = await onBoard.seen();
      if (!mounted) return;
      if (saved) { setToken(saved.t); setMe(saved.u); }
      splashTimer = setTimeout(() => mounted && setScreen((current) => current === 'splash' ? (saved ? 'home' : onboardingSeen ? 'auth' : 'onboarding') : current), 1500);
    })();
    return () => { mounted = false; if (splashTimer) clearTimeout(splashTimer); };
  }, []);

  const go = setScreen;
  const requireUser = () => { if (!me) { setAuthLocked(false); go('auth'); return false; } return true; };
  const search = async () => {
    if (!requireUser()) return;
    if (!form.origin || !form.dest) return say('Pick your From and To locations first');
    go('search');
    try { const matches = await api('/api/match', form); setResults(matches); setScreen('results'); }
    catch (error) { say(error.message); go('home'); }
  };
  const saveCommute = async () => {
    if (!requireUser()) return;
    if (!form.origin || !form.dest) return say('Pick your From and To locations first');
    try {
      const id = form._id;
      const body = { ...form, seats: +form.seats || 1, price: +form.price || 0 };
      if (id) delete body._id;
      await api(id ? `/api/commutes/${id}` : '/api/commutes', body, id ? 'PATCH' : undefined);
      say(id ? 'Commute updated!' : 'Commute posted! Others can now find you.');
      go('profile');
    } catch (error) { say(error.message); }
  };
  const logout = async () => { await session.clear(); setToken(null); setMe(null); setAuthLocked(true); go('auth'); };
  const finishAuth = (token, user) => { setToken(token); setMe(user); setAuthLocked(false); session.save(token, user); go('home'); };
  const finishOnboarding = async () => { await onBoard.set(); setAuthLocked(false); go('auth'); };

  if (screen === 'splash') return <View style={[s.fill, { backgroundColor: C.y, justifyContent: 'center', padding: 24 }]}><View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: width >= 700 ? 'center' : 'flex-start' }}><Text style={s.logo}>PickMe</Text><Text style={s.splashTagline}>Same route.{ '\n' }Better together.</Text><CarIllustration style={s.splashIllustration} /><Text style={s.splashHint}>Share the ride. Keep more.</Text></View></View>;
  if (screen === 'onboarding') return <OnboardingScreen page={onboardingPage} setPage={setOnboardingPage} done={finishOnboarding} />;
  if (screen === 'search') return <View style={[s.fill, { backgroundColor: C.y, justifyContent: 'center', alignItems: 'center', padding: 24 }]}><Text style={s.h1}>Finding your perfect ride...</Text><CarIllustration /><Text>Searching along your route...</Text></View>;
  if (screen === 'auth') return <AuthScreen onDone={finishAuth} back={authLocked ? undefined : () => go('home')} say={say} />;
  if (screen === 'detail') return <DetailScreen commute={selected} back={() => go('results')} need={requireUser} />;

  return <SafeAreaView style={s.fill}><ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
    {(screen === 'home' || screen === 'post') && <><View style={s.homeIntro}><Text style={s.eyebrow}>{screen === 'home' ? 'YOUR DAILY ROUTE' : 'COMMUNITY COMMUTE'}</Text><Text style={s.h1}>{screen === 'home' ? 'Where are we going?' : 'Post your daily commute'}</Text><Text style={s.introText}>{screen === 'home' ? 'Choose a route and find people travelling your way.' : 'Make your recurring route visible and share the cost.'}</Text></View><CommuteForm form={form} setForm={setForm} post={screen === 'post'} /><Btn yellow t={screen === 'home' ? 'Find a Ride  →' : 'Post Commute  →'} onPress={screen === 'home' ? search : saveCommute} /></>}
    {screen === 'results' && <><Text onPress={() => go('home')} style={{ fontSize: 22 }}>←</Text><Text style={s.h2}>Available Rides</Text><Text style={s.mute}>{form.origin?.name} → {form.dest?.name}</Text>{results.length === 0 && <View style={s.card}><Text>No matches yet. Post your commute so others can find you.</Text><Btn yellow t="Post my commute" onPress={() => go('post')} /></View>}{results.map((commute) => <TouchableOpacity key={commute._id} style={s.card} onPress={() => { setSelected(commute); go('detail'); }}><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={s.name}>{commute.user.name}{commute.user.verified ? ' ✔' : ''}</Text><Text style={s.badge}>{commute.score}% match</Text></View><Text style={s.mute}>★ {commute.user.avg || 'New'} ({commute.user.count}) · {commute.role === 'offer' ? 'Offering a ride' : 'Needs a ride'}</Text><Text style={{ fontSize: 20, fontWeight: '700', marginTop: 6 }}>{commute.startTime} – {commute.endTime}</Text><Text style={s.mute}>{commute.origin.name} → {commute.dest.name}</Text><Text style={{ marginTop: 4 }}>💺 {commute.seats} seats · Rs. {commute.price}/seat</Text></TouchableOpacity>)}</>}
    {screen === 'requests' && (me ? <RequestsScreen /> : <Guest go={go} />)}
    {screen === 'trips' && (me ? <TripsScreen me={me} /> : <Guest go={go} />)}
    {screen === 'profile' && (me ? <ProfileScreen me={me} setMe={setMe} logout={logout} go={go} setForm={setForm} /> : <Guest go={go} />)}
  </ScrollView><View style={s.tabs}>{tabs.map(([key, icon, label]) => <TouchableOpacity key={key} onPress={() => go(key)} style={[s.tabButton, key === 'post' && (screen === 'post' ? s.addTabActive : s.addTab)]}><Text style={[s.tabIcon, { fontSize: key === 'post' ? 27 : 19, color: key === 'post' ? C.ink : undefined }]}>{icon}</Text><Text style={[s.tabLabel, { color: screen === key ? C.ink : C.mute }]}>{label}</Text></TouchableOpacity>)}</View></SafeAreaView>;
}

class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) return <View style={[s.fill, { backgroundColor: C.y, justifyContent: 'center', padding: 24 }]}><Text style={s.h2}>PickMe needs a refresh</Text><Text style={s.mute}>Something went wrong while opening this screen.</Text><Btn yellow t="Reload app" onPress={() => this.setState({ error: null })} /></View>;
    return this.props.children;
  }
}

export default function RootApp() {
  return <AppErrorBoundary><App /></AppErrorBoundary>;
}
