import React, { Component, useEffect, useRef, useState } from 'react';
import { initPurchases } from './utils/purchases';
import {
  Alert,
  Animated,
  Image,
  Linking,
  Platform,
  SafeAreaView,
  ScrollView,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';

import { useFonts } from 'expo-font';
import { Fredoka_600SemiBold } from '@expo-google-fonts/fredoka/600SemiBold';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';

import { api, onBoard, session, setToken } from './api';
import { C, s, Btn } from './ui';

import PostFlow from './components/PostFlow';
import CommuteForm from './components/CommuteForm';
import RideMatchCard from './components/RideMatchCard';
import { CarIllustration, DoodleSparkles, RouteDoodle } from './components/Illustrations';

import AuthScreen from './screens/AuthScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import {
  DetailScreen,
  Guest,
  ProfileScreen,
  RequestsScreen,
  TripsScreen,
} from './screens/RideScreens';

import InboxScreen, {
  RequestNotificationTarget,
} from './screens/InboxScreen';

import { formatDate, plusDays, today } from './utils/dates';

const blankCommute = () => ({
  origin: null,
  dest: null,
  tripType: 'recurring',
  tripDate: null,
  days: [0, 1, 2, 3, 4],
  startTime: '08:30',
  endTime: '09:30',
  startDate: today(),
  endDate: plusDays(30),
  role: 'need',
  seats: '1',
  price: '0',
  timeFlexibility: 0,
  maximumDetour: null,
});

const say = (message) =>
  Platform.OS === 'web'
    ? window.alert(message)
    : Alert.alert('PickMe', message);

const tabs = [
  ['home', '⌂', 'Home'],
  ['post', '+', 'Post'],
  ['requests', '♧', 'Requests'],
  ['inbox', '✉', 'Inbox'],
  ['trips', '◷', 'Trips'],
  ['profile', '●', 'Profile'],
];

const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const routeSuggestions = [
  {
    from: 'G-10',
    to: 'H-12',
    region: 'Islamabad',
  },
  {
    from: 'Bahria Town',
    to: 'NUST',
    region: 'Islamabad',
  },
  {
    from: 'Rawalpindi',
    to: 'Islamabad',
    region: 'Twin Cities',
    fromRegion: 'Pakistan',
    toRegion: 'Pakistan',
  },
];

function AppTab({ tab, active, onPress }) {
  const scale = useRef(
    new Animated.Value(active ? 1.08 : 1)
  ).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: active ? 1.12 : 1,
      speed: 24,
      bounciness: 4,
      useNativeDriver: true,
    }).start();
  }, [active, scale]);

  const [key, icon, label] = tab;
  useEffect(() => { initPurchases(); }, []);

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={s.tabButton}
    >
      <Animated.View
        style={[
          s.tabIconWrap,
          key === 'post' &&
            (active ? s.addTabActive : s.addTab),
          active &&
            key !== 'post' &&
            s.tabIconWrapActive,
          {
            transform: [{ scale }],
          },
        ]}
      >
        <Text
          style={[
            s.tabIcon,
            {
              fontSize: key === 'post' ? 25 : 19,
              color:
                key === 'post'
                  ? C.ink
                  : active
                    ? C.ink
                    : C.mute,
            },
          ]}
        >
          {icon}
        </Text>
      </Animated.View>

      <Text
        style={[
          s.tabLabel,
          {
            color: active ? C.ink : C.mute,
          },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function App() {
  const { width } = useWindowDimensions();

  const [fontsLoaded] = useFonts({
    Fredoka_600SemiBold,
    DMSans_400Regular,
    DMSans_700Bold,
  });

  const [screen, setScreen] = useState('splash');
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(blankCommute());
  const [results, setResults] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detailBackScreen, setDetailBackScreen] =
    useState('results');

  const [activeCommutes, setActiveCommutes] = useState([]);
  const [createdCommute, setCreatedCommute] = useState(null);

  const [onboardingPage, setOnboardingPage] = useState(0);
  const [authLocked, setAuthLocked] = useState(false);

  const [homeNotice, setHomeNotice] = useState('');
  const [profileNotice, setProfileNotice] = useState('');
  const [routeLoading, setRouteLoading] = useState('');

  const [notificationTarget, setNotificationTarget] =
    useState(null);

  const screenMotion = useRef(
    new Animated.Value(1)
  ).current;

  useEffect(() => {
    let mounted = true;
    let splashTimer;

    (async () => {
      const saved = await session.load();
      const onboardingSeen = await onBoard.seen();

      if (!mounted) return;

      if (saved) {
        setToken(saved.t);
        setMe(saved.u);
      }

      splashTimer = setTimeout(
        () =>
          mounted &&
          setScreen((current) =>
            current === 'splash'
              ? saved
                ? 'home'
                : onboardingSeen
                  ? 'auth'
                  : 'onboarding'
              : current
          ),
        1500
      );
    })();

    return () => {
      mounted = false;
      if (splashTimer) clearTimeout(splashTimer);
    };
  }, []);

  useEffect(() => {
    screenMotion.setValue(0.96);

    Animated.timing(screenMotion, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [screen, screenMotion]);

  useEffect(() => {
    if (screen !== 'home' || !me) return;

    api('/api/commutes/discover')
      .then((items) =>
        setActiveCommutes(
          (items || []).filter(
            (item) => item.availableSeats > 0
          )
        )
      )
      .catch(() => setActiveCommutes([]));
  }, [screen, me]);

  const go = setScreen;

  const requireUser = () => {
    if (!me) {
      setAuthLocked(false);
      go('auth');
      return false;
    }

    return true;
  };

  const search = async () => {
    if (!requireUser()) return;

    if (!form.origin || !form.dest) {
      setHomeNotice(
        'Choose a starting point and destination to find a ride.'
      );
      return;
    }

    setHomeNotice('');
    go('search');

    try {
      const matches = await api('/api/match', form);

      setResults(matches);
      setScreen('results');
    } catch (error) {
      setHomeNotice(
        `The road disappeared for a moment. ${
          error.message ||
          'Check your connection and try again.'
        }`
      );

      go('home');
    }
  };

  const loadSuggestedRoute = async (route) => {
    const key = `${route.from}-${route.to}`;

    setRouteLoading(key);
    setHomeNotice('');

    try {
      const locate = async (
        place,
        searchRegion = route.region
      ) => {
        const context =
          searchRegion === 'Pakistan'
            ? searchRegion
            : `${searchRegion}, Pakistan`;

        const matches = await api(
          `/api/geocode?q=${encodeURIComponent(
            `${place}, ${context}`
          )}`
        );

        if (!matches.length) {
          throw new Error(
            `We could not find ${place}. Enter it in the route fields instead.`
          );
        }

        return matches[0];
      };

      const [origin, dest] = await Promise.all([
        locate(route.from, route.fromRegion),
        locate(route.to, route.toRegion),
      ]);

      setForm((current) => ({
        ...current,
        origin,
        dest,
      }));

      setHomeNotice(
        'Route added. Adjust either stop, then find a ride.'
      );
    } catch (error) {
      setHomeNotice(
        error.message ||
          'That route could not load. Enter both stops manually.'
      );
    } finally {
      setRouteLoading('');
    }
  };

  const saveCommute = async (formData) => {
    if (!requireUser()) return;

    if (!formData.origin || !formData.dest) {
      return say(
        'Pick your From and To locations first'
      );
    }

    try {
      const id = formData._id;
      const isOneTime =
        formData.tripType === 'one_time';

      const body = {
        ...formData,

        seats: +formData.seats || 1,

        passengerCapacity:
          +formData.passengerCapacity ||
          +formData.seats ||
          1,

        requestedSeats:
          formData.rideMode === 'hired_shared_ride'
            ? +formData.requestedSeats ||
              +formData.seats ||
              1
            : undefined,

        price: +formData.price || 0,

        timeFlexibility:
          +formData.timeFlexibility || 0,

        maximumDetour:
          formData.maximumDetour != null
            ? +formData.maximumDetour
            : null,

        ...(isOneTime
          ? {
              days: undefined,
              startDate: undefined,
              endDate: undefined,
            }
          : {
              tripDate: undefined,
            }),
      };

      if (id) delete body._id;

      const savedCommute = await api(
        id
          ? `/api/commutes/${id}`
          : '/api/commutes',
        body,
        id ? 'PATCH' : undefined
      );

      setForm(blankCommute());

      if (id) {
        const confirmation = 'Commute updated!';

        setProfileNotice(confirmation);
        say(confirmation);
        go('profile');
      } else {
        setCreatedCommute(savedCommute);
        go('created');
      }
    } catch (error) {
      say(error.message);
    }
  };

  const logout = async () => {
    await session.clear();

    setToken(null);
    setMe(null);
    setAuthLocked(true);

    go('auth');
  };

  const finishAuth = (token, user) => {
    setToken(token);
    setMe(user);
    setAuthLocked(false);

    session.save(token, user);

    go('home');
  };

  const finishOnboarding = async () => {
    await onBoard.set();

    setAuthLocked(false);

    go('auth');
  };

  const openNotification = async (notification) => {
    setNotificationTarget(notification);

    const type =
      ({
        request: 'BOOKING_REQUEST',
        accepted: 'BOOKING_ACCEPTED',
        rejected: 'BOOKING_REJECTED',
        cancelled: 'BOOKING_CANCELLED',
      })[notification.type] ||
      notification.type;

    if (notification.tripId) {
      go('trips');
      return;
    }

    if (
      type?.startsWith('BOOKING_') ||
      notification.bookingId ||
      notification.data?.requestId
    ) {
      go('requests');
      return;
    }

    if (notification.commuteId) {
      try {
        const commute = await api(
          `/api/commutes/${notification.commuteId}`
        );

        setSelected(commute);
        setDetailBackScreen('inbox');

        go('detail');
      } catch {
        go('requests');
      }

      return;
    }

    go('requests');
  };

  if (!fontsLoaded) {
    return (
      <View
        style={[
          s.fill,
          s.splashScreen,
          {
            justifyContent: 'center',
            alignItems: 'center',
          },
        ]}
      >
        <Text style={s.logo}>PickMe</Text>
      </View>
    );
  }

  if (screen === 'splash') {
    return (
      <View
        style={[
          s.fill,
          s.splashScreen,
          {
            justifyContent: 'center',
            padding: 24,
          },
        ]}
      >
        <View
          style={{
            width: '100%',
            maxWidth: 520,
            alignSelf: 'center',
            alignItems: 'center',
          }}
        >
          <Text style={s.logo}>PickMe</Text>

          <Text style={s.splashTagline}>
            Same route.
            {'\n'}
            Better together.
          </Text>

          <CarIllustration
            style={s.splashIllustration}
          />

          <Text style={s.splashHint}>
            Share the ride. Keep more.
          </Text>
        </View>
      </View>
    );
  }

  if (screen === 'onboarding') {
    return (
      <OnboardingScreen
        page={onboardingPage}
        setPage={setOnboardingPage}
        done={finishOnboarding}
      />
    );
  }

  if (screen === 'search') {
    return (
      <View
        style={[
          s.fill,
          s.searchLoading,
        ]}
      >
        <DoodleSparkles
          style={s.loadingSparkles}
        />

        <Text style={s.h1}>
          Finding your way-friend
        </Text>

        <Text style={s.introText}>
          Checking who’s travelling your route.
        </Text>

        <RouteDoodle
          repeat
          style={s.loadingRoute}
        />

        <Text style={s.mute}>
          Matching your stops and schedule…
        </Text>
      </View>
    );
  }

  if (screen === 'auth') {
    return (
      <AuthScreen
        onDone={finishAuth}
        back={
          authLocked
            ? undefined
            : () => go('home')
        }
        say={say}
      />
    );
  }

  if (screen === 'detail') {
    return (
      <DetailScreen
        commute={selected}
        back={() => go(detailBackScreen)}
        need={requireUser}
      />
    );
  }

  /*
   * Created commute confirmation screen
   */
  if (screen === 'created' && createdCommute) {
    const sharedRide =
      createdCommute.rideMode ===
      'hired_shared_ride';

    const capacity =
      +createdCommute.passengerCapacity || 4;

    const booked = sharedRide
      ? +createdCommute.requestedSeats ||
        +createdCommute.seats ||
        1
      : 0;

    const remaining = Math.max(
      0,
      capacity - booked
    );

    const schedule =
      createdCommute.tripType === 'one_time'
        ? formatDate(createdCommute.tripDate)
        : `${formatDate(
            createdCommute.startDate
          )} – ${formatDate(
            createdCommute.endDate
          )}`;

    return (
      <SafeAreaView style={s.fill}>
        <ScrollView
          contentContainerStyle={s.pad}
        >
          <Text
            style={{
              fontSize: 38,
              color: C.success,
              textAlign: 'center',
              marginTop: 20,
            }}
          >
            ✓
          </Text>

          <Text
            style={[
              s.h2,
              {
                textAlign: 'center',
                marginTop: 8,
              },
            ]}
          >
            Commute Request Created
          </Text>

          <View
            style={[
              s.card,
              {
                marginTop: 18,
              },
            ]}
          >
            <Text style={s.name}>
              {createdCommute.origin?.name} →{' '}
              {createdCommute.dest?.name}
            </Text>

            <Text
              style={[
                s.mute,
                {
                  marginTop: 5,
                },
              ]}
            >
              {schedule} ·{' '}
              {createdCommute.startTime}
            </Text>

            <Text
              style={{
                marginTop: 12,
                fontWeight: '800',
                color: C.success,
              }}
            >
              Status: Active
            </Text>

            {sharedRide ? (
              <>
                <View style={s.divider} />

                <Text style={s.profileValue}>
                  Total capacity: {capacity}{' '}
                  (standard shared car)
                </Text>

                <Text style={s.profileValue}>
                  Currently booked: {booked}{' '}
                  (your party)
                </Text>

                <Text style={s.profileValue}>
                  Remaining: {remaining}
                </Text>

                <Text
                  style={[
                    s.profileValue,
                    {
                      marginTop: 6,
                    },
                  ]}
                >
                  Male:{' '}
                  {createdCommute.maleCount ||
                    0}{' '}
                  · Female:{' '}
                  {createdCommute.femaleCount ||
                    0}{' '}
                  · Other:{' '}
                  {createdCommute.otherCount ||
                    0}
                </Text>
              </>
            ) : (
              <>
                <View style={s.divider} />

                <Text style={s.profileValue}>
                  Saved vehicle:{' '}
                  {
                    createdCommute
                      .vehicleSnapshot?.make
                  }{' '}
                  {
                    createdCommute
                      .vehicleSnapshot?.model
                  }
                </Text>

                <Text style={s.profileValue}>
                  Passenger capacity: {capacity}
                </Text>

                <Text style={s.profileValue}>
                  Available seats: {capacity}
                </Text>
              </>
            )}
          </View>

          <Btn
            yellow
            t="Done"
            onPress={() => go('home')}
            style={{ marginTop: 8 }}
          />

          <Btn
            dark
            t="View my commutes"
            onPress={() => go('profile')}
            style={{ marginTop: 8 }}
          />
        </ScrollView>
      </SafeAreaView>
    );
  }

  /*
   * PostFlow has its own ScrollView
   */
  if (screen === 'post') {
    return (
      <SafeAreaView style={s.fill}>
        <PostFlow
          form={form}
          setForm={setForm}
          vehicle={me?.vehicle}
          gender={me?.gender}
          onManageVehicle={() =>
            go('profile')
          }
          onSubmit={saveCommute}
          onCancel={() => {
            setForm(blankCommute());
            go('home');
          }}
        />

        <View style={s.tabs}>
          {tabs.map((tab) => (
            <AppTab
              key={tab[0]}
              tab={tab}
              active={screen === tab[0]}
              onPress={() => go(tab[0])}
            />
          ))}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.fill}>
      <Animated.View
        style={[
          s.mainShell,
          {
            opacity: screenMotion,
            transform: [
              {
                translateY:
                  screenMotion.interpolate({
                    inputRange: [0, 1],
                    outputRange: [8, 0],
                  }),
              },
            ],
          },
        ]}
      >
        <ScrollView
          contentContainerStyle={[
            s.pad,
            screen === 'home' && {
              backgroundColor: C.cream,
              padding: 14,
              paddingBottom: 96,
            },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          {screen === 'home' && (
            <>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent:
                    'space-between',
                  marginBottom: 14,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 23,
                      color: C.primaryDark,
                    }}
                  >
                    🚘
                  </Text>

                  <Text
                    style={{
                      fontSize: 17,
                      fontWeight: '800',
                      color: C.ink,
                    }}
                  >
                    Pick Us
                  </Text>
                </View>

                <TouchableOpacity
                  onPress={() =>
                    go('profile')
                  }
                  accessibilityLabel="Open profile"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 17,
                    overflow: 'hidden',
                    backgroundColor:
                      C.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {me?.profileImage ? (
                    <Image
                      source={{
                        uri: me.profileImage,
                      }}
                      style={{
                        width: 34,
                        height: 34,
                      }}
                    />
                  ) : (
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '800',
                        color: C.ink,
                      }}
                    >
                      {(me?.name || 'P')
                        .slice(0, 1)
                        .toUpperCase()}
                    </Text>
                  )}
                </TouchableOpacity>
              </View>

              <View
                style={{
                  backgroundColor: C.card,
                  borderRadius: 9,
                  borderWidth: 1,
                  borderColor: C.border,
                  padding: 10,
                  marginBottom: 16,
                }}
              >
                <Text
                  style={{
                    fontSize: 18,
                    fontWeight: '800',
                    color: C.ink,
                    marginBottom: 4,
                  }}
                >
                  Find a Ride
                </Text>

                <CommuteForm
                  form={form}
                  setForm={setForm}
                  post={false}
                  compact
                />

                <Btn
                  yellow
                  t="Search"
                  onPress={search}
                  style={{
                    borderRadius: 7,
                    minHeight: 40,
                    paddingVertical: 9,
                    marginTop: 3,
                  }}
                  textStyle={{
                    fontSize: 14,
                  }}
                />
              </View>

              {!!homeNotice && (
                <View
                  style={s.inlineNotice}
                >
                  <DoodleSparkles
                    style={s.noticeSparkle}
                  />

                  <Text
                    style={s.noticeText}
                  >
                    {homeNotice}
                  </Text>
                </View>
              )}

              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'baseline',
                  justifyContent:
                    'space-between',
                  marginBottom: 2,
                }}
              >
                <Text
                  style={{
                    fontSize: 17,
                    fontWeight: '800',
                    color: C.ink,
                  }}
                >
                  Active Commutes
                </Text>

                <TouchableOpacity
                  onPress={() =>
                    go('requests')
                  }
                >
                  <Text
                    style={{
                      color: C.mute,
                      fontSize: 12,
                    }}
                  >
                    Commute Requests
                  </Text>
                </TouchableOpacity>
              </View>

              {activeCommutes.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={
                    false
                  }
                  contentContainerStyle={{
                    gap: 8,
                    paddingBottom: 10,
                    paddingTop: 5,
                  }}
                >
                  {activeCommutes
                    .slice(0, 10)
                    .map((commute) => {
                      const rideDate =
                        commute.tripDate ||
                        commute.nextOccurrenceDate ||
                        commute.startDate;

                      const schedule =
                        commute.tripType ===
                        'one_time'
                          ? 'One-time'
                          : (
                              commute.days || []
                            )
                              .map(
                                (day) =>
                                  weekDays[day]
                              )
                              .join(' ');

                      return (
                        <TouchableOpacity
                          key={commute._id}
                          onPress={() => {
                            setSelected(
                              commute
                            );
                            setDetailBackScreen(
                              'home'
                            );
                            go('detail');
                          }}
                          style={{
                            width: Math.max(
                              174,
                              Math.min(
                                218,
                                width - 52
                              )
                            ),
                            minHeight: 163,
                            backgroundColor:
                              C.card,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor:
                              C.border,
                            padding: 10,
                            justifyContent:
                              'space-between',
                          }}
                        >
                          <View>
                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 14,
                                fontWeight:
                                  '800',
                                color: C.ink,
                              }}
                            >
                              {commute.origin
                                ?.name ||
                                'From'}{' '}
                              →{' '}
                              {commute.dest
                                ?.name ||
                                'To'}
                            </Text>

                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 11,
                                color: C.mute,
                                marginTop: 3,
                              }}
                            >
                              Date ·{' '}
                              {formatDate(
                                rideDate
                              )}
                            </Text>

                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 11,
                                color: C.mute,
                                marginTop: 3,
                              }}
                            >
                              Days:{' '}
                              {schedule ||
                                'Flexible'}
                            </Text>

                            <Text
                              numberOfLines={1}
                              style={{
                                fontSize: 11,
                                color: C.mute,
                                marginTop: 3,
                              }}
                            >
                              Departure time:{' '}
                              {
                                commute.startTime
                              }
                            </Text>

                            <Text
                              style={{
                                fontSize: 11,
                                color: C.mute,
                                marginTop: 3,
                              }}
                            >
                              Available seats:{' '}
                              {
                                commute.availableSeats
                              }
                            </Text>
                          </View>

                          <View
                            style={{
                              borderTopWidth: 1,
                              borderColor:
                                C.border,
                              paddingTop: 7,
                              flexDirection:
                                'row',
                              alignItems:
                                'center',
                              justifyContent:
                                'space-between',
                            }}
                          >
                            <View
                              style={{
                                flexDirection:
                                  'row',
                                alignItems:
                                  'center',
                                gap: 5,
                                flex: 1,
                              }}
                            >
                              <View
                                style={{
                                  width: 25,
                                  height: 25,
                                  borderRadius: 13,
                                  overflow:
                                    'hidden',
                                  backgroundColor:
                                    C.primary,
                                  alignItems:
                                    'center',
                                  justifyContent:
                                    'center',
                                }}
                              >
                                {commute.user
                                  ?.profileImage ? (
                                  <Image
                                    source={{
                                      uri: commute
                                        .user
                                        .profileImage,
                                    }}
                                    style={{
                                      width: 25,
                                      height: 25,
                                    }}
                                  />
                                ) : (
                                  <Text
                                    style={{
                                      color:
                                        C.ink,
                                      fontWeight:
                                        '800',
                                      fontSize: 10,
                                    }}
                                  >
                                    {(
                                      commute
                                        .user
                                        ?.name ||
                                      'O'
                                    )
                                      .slice(
                                        0,
                                        1
                                      )
                                      .toUpperCase()}
                                  </Text>
                                )}
                              </View>

                              <View
                                style={{
                                  flexShrink: 1,
                                }}
                              >
                                <Text
                                  numberOfLines={
                                    1
                                  }
                                  style={{
                                    fontSize: 11,
                                    fontWeight:
                                      '700',
                                    color:
                                      C.ink,
                                  }}
                                >
                                  Owner
                                </Text>

                                <Text
                                  style={{
                                    fontSize: 9,
                                    color:
                                      C.mute,
                                  }}
                                >
                                  {commute.user
                                    ?.count ||
                                    0}{' '}
                                  ratings
                                </Text>
                              </View>
                            </View>

                            <Text
                              style={{
                                fontSize: 11,
                                fontWeight:
                                  '800',
                                color:
                                  C.primaryDark,
                              }}
                            >
                              ★{' '}
                              {commute.user
                                ?.avg ||
                                'New'}
                              {commute.user?.avg
                                ? ' / 5'
                                : ''}
                            </Text>
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                </ScrollView>
              ) : (
                <Text
                  style={{
                    color: C.mute,
                    fontSize: 12,
                    paddingVertical: 14,
                  }}
                >
                  No open commutes right now.
                </Text>
              )}

              <Btn
                yellow
                t="＋  Create Commute Request"
                onPress={() => {
                  if (requireUser()) {
                    go('post');
                  }
                }}
                style={{
                  borderRadius: 8,
                  minHeight: 42,
                  paddingVertical: 10,
                  marginTop: 2,
                }}
                textStyle={{
                  fontSize: 14,
                }}
              />

              <Text
                style={[
                  s.lbl,
                  {
                    marginTop: 18,
                  },
                ]}
              >
                Suggested local routes
              </Text>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={
                  false
                }
                contentContainerStyle={
                  s.suggestedRouteList
                }
              >
                {routeSuggestions.map(
                  (route) => {
                    const routeKey = `${route.from}-${route.to}`;

                    return (
                      <TouchableOpacity
                        key={routeKey}
                        disabled={
                          !!routeLoading
                        }
                        activeOpacity={0.84}
                        onPress={() =>
                          loadSuggestedRoute(
                            route
                          )
                        }
                        style={
                          s.suggestedRouteCard
                        }
                      >
                        <Text
                          style={
                            s.suggestedRouteEyebrow
                          }
                        >
                          {routeLoading ===
                          routeKey
                            ? 'LOOKING UP…'
                            : route.region.toUpperCase()}
                        </Text>

                        <Text
                          style={
                            s.suggestedRouteText
                          }
                        >
                          {route.from}
                        </Text>

                        <Text
                          style={
                            s.suggestedRouteArrow
                          }
                        >
                          ↘
                        </Text>

                        <Text
                          style={
                            s.suggestedRouteText
                          }
                        >
                          {route.to}
                        </Text>
                      </TouchableOpacity>
                    );
                  }
                )}
              </ScrollView>
            </>
          )}

          {screen === 'results' && (
            <>
              <TouchableOpacity
                onPress={() => go('home')}
                style={s.backLink}
              >
                <Text
                  style={s.backLinkText}
                >
                  ← Edit route
                </Text>
              </TouchableOpacity>

              <Text style={s.h2}>
                Available Rides
              </Text>

              <Text
                style={[
                  s.mute,
                  {
                    marginBottom: 14,
                  },
                ]}
              >
                {form.origin?.name} →{' '}
                {form.dest?.name}
              </Text>

              {results.length === 0 && (
                <View style={s.emptyState}>
                  <RouteDoodle
                    style={
                      s.emptyRouteDoodle
                    }
                  />

                  <Text style={s.name}>
                    Looks like you’re
                    travelling solo today.
                  </Text>

                  <Text
                    style={[
                      s.mute,
                      {
                        marginTop: 5,
                      },
                    ]}
                  >
                    Try another stop or post
                    your commute so people
                    going your way can find
                    you.
                  </Text>

                  <Btn
                    yellow
                    t="Post my commute"
                    onPress={() =>
                      go('post')
                    }
                  />
                </View>
              )}

              {results.map(
                (commute, index) => (
                  <RideMatchCard
                    key={commute._id}
                    commute={commute}
                    index={index}
                    onPress={() => {
                      setSelected(
                        commute
                      );
                      setDetailBackScreen(
                        'results'
                      );
                      go('detail');
                    }}
                  />
                )
              )}
            </>
          )}

          {screen === 'requests' &&
            (me ? (
              <>
                {(notificationTarget
                  ?.data?.requestId ||
                  notificationTarget
                    ?.bookingId) && (
                  <RequestNotificationTarget
                    requestId={
                      notificationTarget
                        ?.data?.requestId
                    }
                    bookingId={
                      notificationTarget
                        ?.bookingId
                    }
                  />
                )}

                <RequestsScreen />
              </>
            ) : (
              <Guest go={go} />
            ))}

          {screen === 'inbox' &&
            (me ? (
              <InboxScreen
                onOpen={openNotification}
              />
            ) : (
              <Guest go={go} />
            ))}

          {screen === 'trips' &&
            (me ? (
              <TripsScreen
                me={me}
                focusTripId={
                  notificationTarget?.tripId
                }
              />
            ) : (
              <Guest go={go} />
            ))}

          {screen === 'profile' &&
            (me ? (
              <ProfileScreen
                me={me}
                setMe={setMe}
                logout={logout}
                go={go}
                setForm={setForm}
                notice={profileNotice}
              />
            ) : (
              <Guest go={go} />
            ))}
        </ScrollView>

        <View style={s.tabs}>
          {tabs.map((tab) => (
            <AppTab
              key={tab[0]}
              tab={tab}
              active={screen === tab[0]}
              onPress={() => go(tab[0])}
            />
          ))}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

class AppErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <View
          style={[
            s.fill,
            {
              backgroundColor: C.y,
              justifyContent: 'center',
              padding: 24,
            },
          ]}
        >
          <Text style={s.h2}>
            PickMe needs a refresh
          </Text>

          <Text style={s.mute}>
            Something went wrong while
            opening this screen.
          </Text>

          <Btn
            yellow
            t="Reload app"
            onPress={() =>
              this.setState({
                error: null,
              })
            }
          />
        </View>
      );
    }

    return this.props.children;
  }
}

export default function RootApp() {
  return (
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  );
}