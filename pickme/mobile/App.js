import React, { Component, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Linking, Platform, SafeAreaView, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { useFonts } from 'expo-font';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { api, onBoard, session, setToken } from './api';
import { C, s, Btn } from './ui';
import CommuteForm from './components/CommuteForm';
import RideMatchCard from './components/RideMatchCard';
import { CarIllustration, DoodleSparkles, RouteDoodle } from './components/Illustrations';
import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import { DetailScreen, Guest, ProfileScreen, RequestsScreen, TripsScreen } from './screens/RideScreens';
import { plusDays, today } from './utils/dates';
const blankCommute = () => ({ origin: null, dest: null, days: [0, 1, 2, 3, 4], startTime: '08:30', endTime: '09:00', startDate: today(), endDate: plusDays(30), role: 'need', seats: '1', price: '0' });
const say = (message) => Platform.OS === 'web' ? window.alert(message) : Alert.alert('PickMe', message);
const tabs = [['home', '⌂', 'Home'], ['post', '+', 'Post'], ['requests', '▣', 'Requests'], ['trips', '◷', 'Trips'], ['profile', '●', 'Profile']];
const routeSuggestions = [
  { from: 'G-10', to: 'H-12', region: 'Islamabad' },
  { from: 'Bahria Town', to: 'NUST', region: 'Islamabad' },
  { from: 'Rawalpindi', to: 'Islamabad', region: 'Twin Cities', fromRegion: 'Pakistan', toRegion: 'Pakistan' },
];

function AppTab({ tab, active, onPress }) {
  const scale = useRef(new Animated.Value(active ? 1.08 : 1)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: active ? 1.12 : 1, speed: 24, bounciness: 4, useNativeDriver: true }).start();
  }, [active, scale]);
  const [key, icon, label] = tab;
  return <TouchableOpacity onPress={onPress} style={[s.tabButton, key === 'post' && (active ? s.addTabActive : s.addTab)]}>
    <Animated.Text style={[s.tabIcon, { fontSize: key === 'post' ? 27 : 19, color: key === 'post' ? C.ink : undefined, transform: [{ scale }] }]}>{icon}</Animated.Text>
    <Text style={[s.tabLabel, { color: active ? C.ink : C.mute }]}>{label}</Text>
  </TouchableOpacity>;
}

function App() {
  const [fontsLoaded] = useFonts({ Fredoka_600SemiBold, DMSans_400Regular, DMSans_700Bold });
  const [screen, setScreen] = useState('splash');
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(blankCommute());
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [onboardingPage, setOnboardingPage] = useState(0);
  const [authLocked, setAuthLocked] = useState(false);
  const [homeNotice, setHomeNotice] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [routeLoading, setRouteLoading] = useState('');
  const screenMotion = useRef(new Animated.Value(1)).current;
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

  useEffect(() => {
    screenMotion.setValue(0.96);
    Animated.timing(screenMotion, { toValue: 1, duration: 220, useNativeDriver: true }).start();
  }, [screen, screenMotion]);

  const go = setScreen;
  const requireUser = () => { if (!me) { setAuthLocked(false); go('auth'); return false; } return true; };
  const search = async () => {
    if (!requireUser()) return;
    if (!form.origin || !form.dest) { setHomeNotice('Choose a starting point and destination to find a ride.'); return; }
    setHomeNotice('');
    go('search');
    try { const matches = await api('/api/match', form); setResults(matches); setScreen('results'); }
    catch (error) { setHomeNotice(`The road disappeared for a moment. ${error.message || 'Check your connection and try again.'}`); go('home'); }
  };
  const loadSuggestedRoute = async (route) => {
    const key = `${route.from}-${route.to}`;
    setRouteLoading(key);
    setHomeNotice('');
    try {
      const locate = async (place, searchRegion = route.region) => {
        const context = searchRegion === 'Pakistan' ? searchRegion : `${searchRegion}, Pakistan`;
        const matches = await api(`/api/geocode?q=${encodeURIComponent(`${place}, ${context}`)}`);
        if (!matches.length) throw new Error(`We could not find ${place}. Enter it in the route fields instead.`);
        return matches[0];
      };
      const [origin, dest] = await Promise.all([locate(route.from, route.fromRegion), locate(route.to, route.toRegion)]);
      setForm((current) => ({ ...current, origin, dest }));
      setHomeNotice('Route added. Adjust either stop, then find a ride.');
    } catch (error) {
      setHomeNotice(error.message || 'That route could not load. Enter both stops manually.');
    } finally {
      setRouteLoading('');
    }
  };
  const saveCommute = async () => {
    if (!requireUser()) return;
    if (!form.origin || !form.dest) return say('Pick your From and To locations first');
    try {
      const id = form._id;
      const body = { ...form, seats: +form.seats || 1, price: +form.price || 0 };
      if (id) delete body._id;
      await api(id ? `/api/commutes/${id}` : '/api/commutes', body, id ? 'PATCH' : undefined);
      const confirmation = id ? 'Commute updated!' : 'Commute posted! Others can now find you.';
      setProfileNotice(confirmation);
      say(confirmation);
      go('profile');
    } catch (error) { say(error.message); }
  };
  const logout = async () => { await session.clear(); setToken(null); setMe(null); setAuthLocked(true); go('auth'); };
  const finishAuth = (token, user) => { setToken(token); setMe(user); setAuthLocked(false); session.save(token, user); go('home'); };
  const finishOnboarding = async () => { await onBoard.set(); setAuthLocked(false); go('auth'); };

  if (!fontsLoaded) return <View style={[s.fill, { backgroundColor: C.y, justifyContent: 'center', alignItems: 'center' }]}><Text style={s.logo}>PickMe</Text></View>;
  if (screen === 'splash') return <View style={[s.fill, { backgroundColor: C.y, justifyContent: 'center', padding: 24 }]}><View style={{ width: '100%', maxWidth: 520, alignSelf: 'center', alignItems: width >= 700 ? 'center' : 'flex-start' }}><Text style={s.logo}>PickMe</Text><Text style={s.splashTagline}>Same route.{ '\n' }Better together.</Text><CarIllustration style={s.splashIllustration} /><Text style={s.splashHint}>Share the ride. Keep more.</Text></View></View>;
  if (screen === 'onboarding') return <OnboardingScreen page={onboardingPage} setPage={setOnboardingPage} done={finishOnboarding} />;
  if (screen === 'search') return <View style={[s.fill, s.searchLoading]}><DoodleSparkles style={s.loadingSparkles} /><Text style={s.h1}>Finding your way-friend</Text><Text style={s.introText}>Checking who’s travelling your route.</Text><RouteDoodle repeat style={s.loadingRoute} /><Text style={s.mute}>Matching your stops and schedule…</Text></View>;
  if (screen === 'auth') return <AuthScreen onDone={finishAuth} back={authLocked ? undefined : () => go('home')} say={say} />;
  if (screen === 'detail') return <DetailScreen commute={selected} back={() => go('results')} need={requireUser} />;

  return <SafeAreaView style={s.fill}><Animated.View style={[s.mainShell, { opacity: screenMotion, transform: [{ translateY: screenMotion.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }] }]}><ScrollView contentContainerStyle={s.pad} keyboardShouldPersistTaps="handled">
    {screen === 'home' && <><View style={s.homeIntro}><Text style={s.eyebrow}>YOUR DAILY ROUTE  ✦</Text><Text style={s.homeTitle}>Find someone going your way.</Text><Text style={s.introText}>Same stops, shared rides, easier mornings.</Text><RouteDoodle style={s.homeRouteDoodle} /></View><CommuteForm form={form} setForm={setForm} post={false} /><View style={s.homeActions}><Btn yellow t="Find a Ride  →" onPress={search} style={s.homeActionButton} /><Btn dark t="Offer a Ride  ↗" onPress={() => go('post')} style={s.homeActionButton} /></View>{!!homeNotice && <View style={s.inlineNotice}><DoodleSparkles style={s.noticeSparkle} /><Text style={s.noticeText}>{homeNotice}</Text></View>}<Text style={s.lbl}>Suggested local routes</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestedRouteList}>{routeSuggestions.map((route) => { const routeKey = `${route.from}-${route.to}`; return <TouchableOpacity key={routeKey} disabled={!!routeLoading} activeOpacity={0.84} onPress={() => loadSuggestedRoute(route)} style={s.suggestedRouteCard}><Text style={s.suggestedRouteEyebrow}>{routeLoading === routeKey ? 'LOOKING UP…' : route.region.toUpperCase()}</Text><Text style={s.suggestedRouteText}>{route.from}</Text><Text style={s.suggestedRouteArrow}>↘</Text><Text style={s.suggestedRouteText}>{route.to}</Text></TouchableOpacity>; })}</ScrollView></>}
    {screen === 'post' && <><View style={s.postIntro}><Text style={s.eyebrow}>COMMUNITY COMMUTE  ✦</Text><Text style={s.h1}>Offer a seat on your route.</Text><Text style={s.introText}>Make your regular commute visible and share the cost.</Text><RouteDoodle style={s.postRouteDoodle} /></View><CommuteForm form={form} setForm={setForm} post /><Btn yellow t="Post Commute  →" onPress={saveCommute} /></>}
    {screen === 'results' && <><TouchableOpacity onPress={() => go('home')} style={s.backLink}><Text style={s.backLinkText}>←  Edit route</Text></TouchableOpacity><Text style={s.h2}>Available Rides</Text><Text style={[s.mute, { marginBottom: 14 }]}>{form.origin?.name} → {form.dest?.name}</Text>{results.length === 0 && <View style={s.emptyState}><RouteDoodle style={s.emptyRouteDoodle} /><Text style={s.name}>Looks like you’re travelling solo today.</Text><Text style={[s.mute, { marginTop: 5 }]}>Try another stop or post your commute so people going your way can find you.</Text><Btn yellow t="Post my commute" onPress={() => go('post')} /></View>}{results.map((commute, index) => <RideMatchCard key={commute._id} commute={commute} index={index} onPress={() => { setSelected(commute); go('detail'); }} />)}</>}
    {screen === 'requests' && (me ? <RequestsScreen /> : <Guest go={go} />)}
    {screen === 'trips' && (me ? <TripsScreen me={me} /> : <Guest go={go} />)}
    {screen === 'profile' && (me ? <ProfileScreen me={me} setMe={setMe} logout={logout} go={go} setForm={setForm} notice={profileNotice} /> : <Guest go={go} />)}
  </ScrollView><View style={s.tabs}>{tabs.map((tab) => <AppTab key={tab[0]} tab={tab} active={screen === tab[0]} onPress={() => go(tab[0])} />)}</View></Animated.View></SafeAreaView>;
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
