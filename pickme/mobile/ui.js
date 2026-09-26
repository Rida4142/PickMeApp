import React, { useRef } from 'react';
import { Animated, Text, TextInput, TouchableOpacity, StyleSheet, Platform, View, SafeAreaView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export const C = {
  primary: '#FFD84D',
  primaryDark: '#EFBF24',
  secondary: '#4054E8',
  secondaryDark: '#3044CF',
  accent: '#FF705B',
  background: '#FFF9E9',
  card: '#FFFFFF',
  cardAlt: '#FFFDF7',
  text: '#17233E',
  textSecondary: '#6F7180',
  textTertiary: '#9698A4',
  border: '#EFE8D8',
  borderDark: '#DED5C4',
  success: '#318B68',
  error: '#E5484D',
  warning: '#F2C94A',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.4)',
  y: '#FFD84D', cream: '#FFF9E9', blue: '#4054E8', ink: '#17233E',
  mute: '#77766F', lav: '#E8E2FF', mint: '#DDF2E8', red: '#E5484D',
  gradient: ['#FFE879', '#FFD84D'],
  darkGradient: ['#17233E', '#263656'],
};

const isWeb = Platform.OS === 'web';

export const GradientCard = ({ children, style, colors = C.gradient, dark }) =>
  dark ? (
    <View style={[styles.card, style]}>{children}</View>
  ) : (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.card, style]}
    >
      {children}
    </LinearGradient>
  );

export const Card = ({ children, style, dark, pressable, onPress, bordered }) => (
  <TouchableOpacity
    activeOpacity={pressable ? 0.84 : 1}
    onPress={onPress}
    style={[
      styles.card,
      dark && { backgroundColor: C.card, elevation: 4 },
      bordered && { borderWidth: 1, borderColor: C.border },
      style,
    ]}
    disabled={!pressable}
  >
    {children}
  </TouchableOpacity>
);

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export const Btn = ({
  t, onPress, dark, yellow, blue, red, outline, disabled, style, textStyle, small,
}) => {
  const scale = useRef(new Animated.Value(1)).current;
  const animateScale = (toValue) => Animated.spring(scale, { toValue, speed: 28, bounciness: 4, useNativeDriver: true }).start();
  return <AnimatedTouchable
    onPress={onPress}
    onPressIn={() => !disabled && animateScale(0.97)}
    onPressOut={() => animateScale(1)}
    activeOpacity={0.92}
    disabled={disabled}
    style={[
      styles.btn,
      {
        backgroundColor: disabled ? C.textTertiary : dark ? C.ink : yellow ? C.primary : blue ? C.secondary : red ? C.error : C.secondary,
        borderWidth: outline ? 1 : 0,
        borderColor: outline ? C.border : 'transparent',
      },
      small && { paddingVertical: 10, paddingHorizontal: 16, borderRadius: 12 },
      style,
      { transform: [{ scale }] },
    ]}
  >
    <Text
      style={[
        styles.btnText,
        { color: outline ? C.secondary : dark ? '#fff' : yellow ? C.ink : '#fff' },
        textStyle,
      ]}
    >
      {t}
    </Text>
  </AnimatedTouchable>;
};

export const In = (p) => (
  <TextInput
    placeholderTextColor={C.textTertiary}
    {...p}
    style={[styles.input, p.style]}
  />
);

export const LabeledInput = ({ label, placeholder, value, onChangeText, keyboardType, secureTextEntry, style }) => (
  <View style={{ marginBottom: 4 }}>
    {label && <Text style={styles.label}>{label}</Text>}
    <In
      placeholder={placeholder}
      value={value}
      onChangeText={onChangeText}
      keyboardType={keyboardType}
      secureTextEntry={secureTextEntry}
      style={style}
    />
  </View>
);

export const Stars = ({ v, set, small }) => (
  <View style={{ flexDirection: 'row' }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Text
        key={n}
        onPress={() => set && set(n)}
        style={{ fontSize: small ? 18 : 24, color: n <= v ? '#F5A623' : '#ddd', marginHorizontal: 1 }}
      >
        ★
      </Text>
    ))}
  </View>
);

export const Badge = ({ t, color = 'yellow', style }) => {
  const bg = color === 'yellow' ? C.primary : color === 'blue' ? C.secondary : color === 'green' ? C.success : color === 'red' ? C.error : C.accent;
  const txt = color === 'yellow' ? C.ink : '#fff';
  return (
    <View
      style={[
        { backgroundColor: bg, paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12, alignSelf: 'flex-start' },
        style,
      ]}
    >
      <Text style={{ color: txt, fontWeight: '700', fontSize: 12 }}>{t}</Text>
    </View>
  );
};

export const ProgressBar = ({ score }) => (
  <View style={{ marginVertical: 6 }}>
    <View style={{ height: 8, backgroundColor: C.border, borderRadius: 4, overflow: 'hidden' }}>
      <View
        style={{
          width: `${score}%`,
          height: '100%',
          backgroundColor: score > 70 ? C.success : score > 40 ? C.primary : C.error,
          borderRadius: 4,
        }}
      />
    </View>
  </View>
);

export const MatchExplanation = ({ exp }) => {
  if (!exp) return null;
  return (
    <View style={{ marginVertical: 12, gap: 6 }}>
      <LabeledRow label="Route overlap" value={`${exp.routeOverlap}%`} />
      <LabeledRow label="Time" value={exp.timeOverlap} />
      <LabeledRow label="Days" value={exp.daysOverlap} />
      <LabeledRow label="Pickup" value={`${exp.pickupAlongRoute} km along route`} />
      <LabeledRow label="Seats available" value={exp.seatsAvailable} />
    </View>
  );
};

export const LabeledRow = ({ label, value }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
    <Text style={{ color: C.textSecondary, fontSize: 14 }}>{label}</Text>
    <Text style={{ color: C.text, fontWeight: '600', fontSize: 14 }}>{value}</Text>
  </View>
);

export const DaySelector = ({ days, setDays, multi = true }) => {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const shortDays = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 8 }}>
      {DAYS.map((d, i) => {
        const sel = (days || []).includes(i);
        return (
          <TouchableOpacity
            key={i}
            onPress={() => {
              const arr = days || [];
              const newArr = sel ? arr.filter((x) => x !== i) : [...arr, i];
              setDays(multi ? newArr : [i]);
            }}
            style={[
              styles.dayChip,
              { backgroundColor: sel ? C.primary : C.card, borderColor: sel ? C.primaryDark : C.border },
            ]}
          >
            <Text style={{ fontWeight: '700', color: sel ? C.ink : C.textSecondary, fontSize: 14 }}>{d}</Text>
            <Text style={{ fontSize: 10, color: sel ? C.ink : C.textTertiary, marginTop: 2 }}>{shortDays[i]}</Text>
      </TouchableOpacity>
        );
      })}
    </View>
  );
};

export const Icon = ({ name, size = 20, color = C.text }) => {
  const icons = {
    home: '🏠', rides: '🚗', post: '➕', chat: '💬', profile: '👤',
    location: '📍', time: '⏰', date: '📅', seats: '💺', money: '💰',
    check: '✓', close: '✕', arrow: '→', back: '←', star: '★',
    notification: '🔔', safety: '🛡️', settings: '⚙️', logout: '🚪',
    edit: '✏️', delete: '🗑️', pause: '⏸️', save: '💾',
    phone: '📞', email: '📧', calendar: '📆', search: '🔍',
    map: '🗺️', route: '🛣️', verified: '✔️', warning: '⚠️',
  };
  return <Text style={{ fontSize: size, color }}>{icons[name] || name}</Text>;
};

export const TabBar = ({ tabs, active, setActive }) => (
  <View style={styles.tabBar}>
    {tabs.map(([key, icon, label]) => {
      const isActive = active === key;
      return (
        <TouchableOpacity key={key} onPress={() => setActive(key)} style={styles.tabItem}>
          <Text style={{ fontSize: isActive ? 24 : 18 }}>{icon}</Text>
          <Text style={{ fontSize: 11, color: isActive ? C.secondary : C.textTertiary, marginTop: 2 }}>{label}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

export const Header = ({ title, sub, back, onBack, right, rightAction, dark }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 16,
      paddingTop: Platform.OS === 'android' ? 44 : 20,
      paddingBottom: 16,
      backgroundColor: dark ? C.ink : C.card,
      borderBottomWidth: 1,
      borderBottomColor: C.border,
    }}
  >
    {back ? (
      <TouchableOpacity onPress={onBack} style={{ padding: 8, marginRight: 8 }}>
        <Icon name="back" size={24} color={dark ? '#fff' : C.text} />
      </TouchableOpacity>
    ) : <View style={{ width: 40 }} />}
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 22, fontWeight: '800', color: dark ? '#fff' : C.text }}>{title}</Text>
      {sub && <Text style={{ fontSize: 13, color: dark ? '#ccc' : C.textSecondary, marginTop: 2 }}>{sub}</Text>}
    </View>
    {right && (
      <TouchableOpacity onPress={rightAction} style={{ padding: 8 }}>
        <Icon name={right} size={22} color={dark ? '#fff' : C.text} />
      </TouchableOpacity>
    )}
  </View>
);

export const StatCard = ({ icon, value, label, color = C.secondary, style }) => (
  <View style={[styles.statCard, { backgroundColor: color + '10' }, style]}>
    <Text style={{ fontSize: 28 }}>{icon}</Text>
    <Text style={{ fontSize: 20, fontWeight: '800', color: C.text, marginTop: 4 }}>{value}</Text>
    <Text style={{ fontSize: 11, color: C.textSecondary, marginTop: 2 }}>{label}</Text>
  </View>
);

export const Loading = ({ text = 'Searching for rides...' }) => (
  <View style={{ flex: 1, backgroundColor: C.background, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
    <Text style={{ fontSize: 56 }}>🚕</Text>
    <Text style={{ fontSize: 18, fontWeight: '600', color: C.text }}>{text}</Text>
    <View style={{ width: 40, height: 4, backgroundColor: C.primary, borderRadius: 2, opacity: 0.5 }} />
    <Text style={{ fontSize: 12, color: C.textSecondary }}>PickMe is matching you...</Text>
  </View>
);

export const s = StyleSheet.create({
  fill: { flex: 1, backgroundColor: C.background },
  paper: { backgroundColor: C.cream },
  pad: { padding: 16, paddingBottom: 112, backgroundColor: C.background },
  padScroll: { padding: 16, paddingBottom: 100, backgroundColor: C.background },
  container: { flex: 1 },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
    boxShadow: '0px 5px 14px rgba(23,35,62,0.07)',
    elevation: 2,
  },
  statCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    minWidth: 80,
    boxShadow: '0px 2px 4px rgba(0,0,0,0.05)',
    elevation: 1,
  },
  dayChip: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: C.card,
  },
  btn: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderRadius: 18,
    alignItems: 'center',
    marginVertical: 10,
    boxShadow: '0px 4px 8px rgba(23,35,62,0.14)',
    elevation: 2,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, fontFamily: 'DMSans_700Bold' },
  input: {
    backgroundColor: '#FFFEFA',
    borderRadius: 14,
    padding: 13,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 15,
    fontFamily: 'DMSans_400Regular',
  },
  label: { fontWeight: '700', marginBottom: 2, color: C.ink, fontSize: 14, fontFamily: 'DMSans_700Bold' },
  name: { fontSize: 17, fontWeight: '700', color: C.ink, fontFamily: 'DMSans_700Bold' },
  badge: {
    backgroundColor: C.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    fontWeight: '700',
    overflow: 'hidden',
    fontSize: 12,
  },
  badgeText: { color: C.ink, fontSize: 12, fontWeight: '700' },
  pill: { backgroundColor: C.lav, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, overflow: 'hidden', marginRight: 8 },
  lbl: { color: C.ink, fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.7, fontFamily: 'DMSans_700Bold' },
  day: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, marginRight: 8 },
  scheduleField: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: C.border, minHeight: 48, paddingHorizontal: 12, marginVertical: 5 },
  scheduleIcon: { color: C.blue, fontSize: 18, marginRight: 8 },
  scheduleValue: { color: C.ink, fontSize: 14, fontWeight: '700' },
  matchCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 14, marginBottom: 10 },
  matchReason: { color: C.blue, fontSize: 12, fontWeight: '700', marginTop: 5 },
  matchScore: { backgroundColor: C.primary, color: C.ink, fontSize: 16, fontWeight: '900', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 18, overflow: 'hidden' },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
    boxShadow: '0px -2px 4px rgba(0,0,0,0.08)',
    elevation: 5,
  },
  tabItem: { alignItems: 'center', gap: 2 },
  tabs: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 72,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: C.cream,
    borderRadius: 0,
    borderTopWidth: 1,
    borderColor: C.border,
    boxShadow: '0px -2px 8px rgba(0,0,0,0.06)',
    elevation: 6,
    zIndex: 10,
  },
  tabButton: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { height: 30, textAlign: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '700', fontFamily: 'DMSans_700Bold' },
  addTab: { flex: 0, width: 52, height: 52, marginHorizontal: 4, borderRadius: 26, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border },
  addTabActive: { flex: 0, width: 52, height: 52, marginHorizontal: 4, borderRadius: 26, backgroundColor: C.primary, borderWidth: 3, borderColor: C.cream },
  addTabLabel: { color: '#fff' },
  h1: { fontSize: 30, fontWeight: '800', color: C.ink, marginBottom: 8, fontFamily: 'Fredoka_600SemiBold' },
  h2: { fontSize: 24, fontWeight: '800', color: C.ink, marginBottom: 4, fontFamily: 'Fredoka_600SemiBold' },
  h3: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 4, fontFamily: 'Fredoka_600SemiBold' },
  mute: { color: C.textSecondary, fontFamily: 'DMSans_400Regular' },
  section: { marginTop: 24, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5, fontFamily: 'DMSans_700Bold' },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', fontSize: 14 },
  logo: { fontSize: 58, fontWeight: '900', color: C.ink, letterSpacing: -2 },
  splashMark: { flexDirection: 'row', alignItems: 'flex-start' },
  splashSpark: { fontSize: 28, color: C.secondary, marginTop: 4, marginLeft: 4 },
  splashTagline: { fontSize: 20, fontWeight: '700', lineHeight: 26, color: C.ink, marginTop: 6 },
  splashCar: { fontSize: 74, marginTop: 30 },
  splashIllustration: { marginTop: 24 },
  splashHint: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 34, letterSpacing: 0.4 },
  mainShell: { flex: 1 },
  searchLoading: { backgroundColor: C.cream, justifyContent: 'center', alignItems: 'center', padding: 24 },
  loadingSparkles: { marginBottom: 14 },
  loadingRoute: { width: '100%', maxWidth: 340, marginTop: 26, marginBottom: 18 },
  homeIntro: { backgroundColor: C.y, borderRadius: 22, padding: 20, marginBottom: 14, borderBottomRightRadius: 40, overflow: 'hidden' },
  homeTitle: { color: C.ink, fontSize: 34, lineHeight: 39, fontWeight: '900', maxWidth: 320, marginBottom: 8, fontFamily: 'Fredoka_600SemiBold' },
  homeRouteDoodle: { height: 94, marginTop: 2, marginBottom: -7 },
  postIntro: { backgroundColor: C.lav, borderRadius: 22, padding: 20, marginBottom: 14, borderBottomRightRadius: 38, overflow: 'hidden' },
  postRouteDoodle: { height: 82, marginTop: 4, marginBottom: -4 },
  homeActions: { flexDirection: 'row', gap: 10, marginBottom: 10 },
  homeActionButton: { flex: 1, paddingHorizontal: 10, minHeight: 50 },
  inlineNotice: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#FFF0EC', borderWidth: 1, borderColor: '#FFD1C8', borderRadius: 12, padding: 10, marginVertical: 8 },
  noticeSparkle: { width: 30, height: 28 },
  noticeText: { color: C.ink, fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
  suggestedRouteList: { gap: 10, paddingVertical: 3, paddingRight: 16 },
  suggestedRouteCard: { width: 142, minHeight: 94, borderRadius: 14, padding: 12, backgroundColor: C.card, borderWidth: 1, borderColor: C.border, boxShadow: '0px 4px 10px rgba(23,35,62,0.06)', elevation: 1 },
  suggestedRouteEyebrow: { color: C.blue, fontSize: 9, fontWeight: '900', marginBottom: 6 },
  suggestedRouteText: { color: C.ink, fontSize: 13, fontWeight: '800' },
  suggestedRouteArrow: { color: C.accent, fontSize: 13, lineHeight: 16, marginLeft: 2 },
  emptyState: { alignItems: 'center', paddingVertical: 22, paddingHorizontal: 18 },
  emptyRouteDoodle: { height: 90, marginBottom: 8 },
  matchBadge: { width: 56, height: 52, borderRadius: 14, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '3deg' }] },
  matchBadgeText: { color: C.ink, fontSize: 15, lineHeight: 18, fontWeight: '900' },
  matchBadgeCaption: { color: C.ink, fontSize: 9, fontWeight: '800' },
  detailTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailDeparture: { flexDirection: 'row', alignItems: 'baseline', gap: 10, paddingVertical: 12, marginTop: 12, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  detailDepartureTime: { color: C.ink, fontSize: 25, fontWeight: '900' },
  detailStop: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 13 },
  detailOriginPin: { width: 13, height: 13, borderRadius: 7, backgroundColor: C.blue, borderWidth: 2, borderColor: C.lav },
  detailDestinationPin: { width: 13, height: 13, borderRadius: 7, backgroundColor: C.accent, borderWidth: 2, borderColor: '#FFE4DD' },
  detailStopLabel: { color: C.mute, fontSize: 9, fontWeight: '900', marginBottom: 2 },
  detailRouteDoodle: { height: 72, marginVertical: 0 },
  detailFacts: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  detailFact: { color: C.ink, fontSize: 12, fontWeight: '800', backgroundColor: C.lav, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, overflow: 'hidden' },
  detailSchedule: { color: C.textSecondary, fontSize: 12, lineHeight: 18, marginTop: 10 },
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, backgroundColor: C.mint, padding: 12, marginTop: 4, borderWidth: 1, borderColor: '#C5E8D5' },
  successSparkle: { width: 54, height: 46 },
  successBannerRoute: { height: 48, marginTop: 0, marginBottom: -4 },
  successTitle: { color: C.ink, fontSize: 15, fontWeight: '900' },
  successCopy: { color: C.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 2 },
  tripRouteRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  tripRouteText: { flex: 1, flexShrink: 1, color: C.ink, fontSize: 15, fontWeight: '800', fontFamily: 'DMSans_700Bold' },
  tripRouteArrow: { color: C.accent, fontSize: 19, fontWeight: '900' },
  tripFare: { color: C.ink, fontSize: 21, fontWeight: '900', marginVertical: 7, fontFamily: 'Fredoka_600SemiBold' },
  tripRiderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 8, marginTop: 6 },
  tripRiderName: { color: C.ink, fontSize: 13, fontWeight: '700', fontFamily: 'DMSans_700Bold' },
  eyebrow: { color: C.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8, fontFamily: 'DMSans_700Bold' },
  introText: { color: C.ink, fontSize: 15, lineHeight: 22, maxWidth: 340, fontFamily: 'DMSans_400Regular' },
  heroDoodle: { height: 22, width: 150, flexDirection: 'row', alignItems: 'center', marginTop: 14, transform: [{ rotate: '-4deg' }] },
  heroDoodleDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.blue },
  heroDoodleLine: { width: 60, borderTopWidth: 2, borderStyle: 'dashed', borderColor: C.ink, marginHorizontal: 5 },
  heroDoodleCar: { color: C.ink, fontSize: 18, fontWeight: '900', marginRight: 5 },
  heroDoodleDotEnd: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },
  routeDoodle: { height: 82, width: '100%', position: 'relative', overflow: 'hidden', marginVertical: 6 },
  routeDoodleCurve: { position: 'absolute', left: 18, right: 24, top: 25, height: 40, borderBottomWidth: 2, borderBottomColor: C.ink, borderBottomStyle: 'dashed', borderBottomLeftRadius: 30, borderBottomRightRadius: 48, transform: [{ rotate: '-4deg' }] },
  routeDoodleTrack: { position: 'absolute', left: 22, right: 22, top: 45, borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.blue, opacity: 0.7 },
  routeDoodleStart: { position: 'absolute', left: 16, top: 40, width: 12, height: 12, borderRadius: 7, backgroundColor: C.blue, borderWidth: 2, borderColor: '#fff' },
  routeDoodleEnd: { position: 'absolute', right: 16, top: 40, width: 12, height: 12, borderRadius: 7, backgroundColor: C.accent, borderWidth: 2, borderColor: '#fff' },
  routeDoodleSparkLeft: { position: 'absolute', top: 4, left: 42, color: C.blue, fontSize: 15 },
  routeDoodleSparkRight: { position: 'absolute', top: 10, right: 54, color: C.accent, fontSize: 17 },
  routeCarMover: { position: 'absolute', top: -40, left: -84, width: 250, height: 170 },
  routeCarScale: { width: 250, height: 170, transform: [{ scale: 0.31 }] },
  routeCarScene: { width: 250, height: 170 },
  sparkleBurst: { width: 72, height: 58, position: 'relative', alignItems: 'center', justifyContent: 'center' },
  sparkleMain: { color: C.primaryDark, fontSize: 38, fontWeight: '900' },
  sparkleSmall: { position: 'absolute', top: 2, right: 7, color: C.blue, fontSize: 18 },
  sparkleDot: { position: 'absolute', bottom: 1, left: 7, color: C.accent, fontSize: 18 },
  backLink: { alignSelf: 'flex-start', paddingVertical: 8, paddingRight: 12, marginBottom: 8 },
  backLinkText: { color: C.blue, fontSize: 14, fontWeight: '800' },
  rideCard: { backgroundColor: C.card, borderRadius: 12, borderWidth: 1, borderColor: C.border, padding: 15, marginBottom: 12, boxShadow: '0px 5px 14px rgba(23,35,62,0.07)', elevation: 2 },
  rideCardTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  rideAvatar: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: C.lav },
  rideAvatarText: { color: C.blue, fontSize: 18, fontWeight: '900' },
  rideRating: { color: C.ink, fontSize: 12, fontWeight: '700', marginTop: 3 },
  rideRoute: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, marginVertical: 10, borderTopWidth: 1, borderBottomWidth: 1, borderColor: C.border },
  rideRouteTrack: { width: 16, alignItems: 'center', marginRight: 10 },
  rideRouteDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: C.blue },
  rideRouteStem: { width: 2, height: 20, borderLeftWidth: 2, borderStyle: 'dashed', borderColor: C.primaryDark },
  routeDirectionMark: { position: 'absolute', top: 16, color: C.accent, fontSize: 10, fontWeight: '900', backgroundColor: C.card },
  rideRouteDotEnd: { backgroundColor: C.accent },
  rideRouteName: { color: C.ink, fontSize: 14, fontWeight: '700', fontFamily: 'DMSans_700Bold' },
  rideTime: { alignItems: 'flex-end', marginLeft: 8 },
  rideTimeText: { color: C.ink, fontSize: 15, fontWeight: '900' },
  rideTimeCaption: { color: C.mute, fontSize: 10, marginTop: 2 },
  rideCardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rideMeta: { color: C.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1 },
  ridePrice: { color: C.ink, fontSize: 16, fontWeight: '900' },
  ridePriceUnit: { color: C.mute, fontSize: 11, fontWeight: '600' },
  formTitle: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 6, marginBottom: 2, fontFamily: 'Fredoka_600SemiBold' },
  routeFieldBlock: { marginBottom: 2 },
  routeFieldLabel: { color: C.blue, fontSize: 10, fontWeight: '900', marginTop: 8, marginBottom: 1 },
  routeInputRow: { flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 11, height: 11, borderRadius: 6, marginHorizontal: 8 },
  routeInput: { flex: 1 },
  currentLocationButton: { minHeight: 34, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 10, borderRadius: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, marginLeft: 25, marginTop: 2 },
  currentLocationIcon: { width: 16, height: 16, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: C.lav },
  currentLocationIconText: { color: C.blue, fontSize: 11, lineHeight: 14, fontWeight: '900' },
  currentLocationText: { color: C.blue, fontSize: 11, fontWeight: '800' },
  locationNotice: { color: C.textSecondary, fontSize: 12, lineHeight: 17, marginTop: 5, marginHorizontal: 4 },
  locationNoticeError: { color: C.red },
  locationSuggestion: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 10, backgroundColor: C.card, borderBottomWidth: 1, borderBottomColor: C.border },
  locationSuggestionPin: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: C.lav },
  locationSuggestionText: { color: C.ink, fontSize: 13, fontWeight: '600', flex: 1 },
  mapCaption: { color: C.textSecondary, fontSize: 12, fontWeight: '600', marginTop: 9 },
  mapFrame: { height: 220, borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: '#EADFC5', marginTop: 6 },
  authPad: { padding: 22, paddingBottom: 80, backgroundColor: C.background, alignItems: 'center' },
  authPanel: { width: '100%', alignSelf: 'center' },
  authBrand: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 22 },
  authLogo: { fontSize: 34, fontWeight: '900', color: C.ink },
  authDot: { fontSize: 18, color: C.secondary, marginTop: 2, marginLeft: 3 },
  backButton: { fontSize: 26, color: C.ink, marginBottom: 18 },
  socialButton: { height: 48, borderRadius: 24, borderWidth: 1, borderColor: C.border, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', marginTop: 10 },
  socialIcon: { position: 'absolute', left: 18, color: C.ink, fontWeight: '900', fontSize: 17 },
  socialText: { color: C.ink, fontWeight: '700', fontSize: 14 },
  authDivider: { flexDirection: 'row', alignItems: 'center', marginVertical: 10 },
  dividerLine: { flex: 1, height: 1, backgroundColor: C.border },
  orText: { color: C.mute, fontSize: 12, marginHorizontal: 10 },
  authField: { marginBottom: 8 },
  authLabel: { color: C.ink, fontSize: 14, fontWeight: '800', marginBottom: 2 },
  required: { color: C.red },
  authError: { color: C.red, fontSize: 12, marginTop: 1 },
  authFormError: { color: C.red, fontSize: 13, marginTop: 4 },
  authModeToggle: { textAlign: 'center', marginTop: 16, color: C.blue, fontWeight: '700' },
  genderOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 3 },
  genderOption: { borderWidth: 1, borderColor: C.borderDark, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, backgroundColor: '#fff' },
  genderOptionActive: { borderColor: C.blue, backgroundColor: C.lav },
  genderOptionText: { color: C.ink, fontSize: 14 },
  genderOptionTextActive: { color: C.blue, fontWeight: '800' },
  selectWrap: { height: 52, borderWidth: 1, borderColor: C.border, borderRadius: 12, backgroundColor: '#fff', justifyContent: 'center', overflow: 'hidden' },
  genderPicker: { color: C.text, height: 52, width: '100%' },
  locationControl: { marginBottom: 2 },
  locationRetry: { color: C.blue, fontSize: 13, fontWeight: '800', marginTop: 2 },
  profileContainer: { width: '100%', alignSelf: 'center', paddingBottom: 24 },
  profileHeader: { backgroundColor: C.y, borderRadius: 22, padding: 18, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 14 },
  profileAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  profileAvatarImage: { width: '100%', height: '100%' },
  profileAvatarText: { color: '#fff', fontSize: 24, fontWeight: '900' },
  profileIdentity: { flex: 1, minWidth: 0 },
  profileLink: { color: C.blue, fontWeight: '800', paddingVertical: 6 },
  profileDanger: { color: C.red, fontWeight: '800', paddingVertical: 6 },
  sectionHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  profileValueLabel: { color: C.mute, fontSize: 12, fontWeight: '800', marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  profileValue: { color: C.ink, fontSize: 15, marginTop: 3 },
  profileVehicleTitle: { color: C.ink, fontSize: 19, fontWeight: '900', marginTop: 4 },
  ratingRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  ratingNumber: { color: C.ink, fontSize: 26, fontWeight: '900' },
  reviewRow: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 12, paddingTop: 10 },
  profileButtonRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  profileActionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 8 },
  profileLogout: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 12, paddingTop: 8 },
  listRow: { borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 10 },
  buddyRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 10 },
  buddyAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.ink, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  buddyImage: { width: '100%', height: '100%' },
  buddyInitial: { color: '#fff', fontWeight: '800' },
  occupancyBox: { borderTopWidth: 1, borderTopColor: C.border, marginTop: 10, paddingTop: 10 },
  seatGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  seat: { minWidth: 68, paddingVertical: 8, paddingHorizontal: 6, borderRadius: 10, borderWidth: 1, alignItems: 'center' },
  seatOpen: { backgroundColor: C.mint, borderColor: C.success },
  seatOccupied: { backgroundColor: '#FFE4DD', borderColor: C.accent },
  seatNumber: { color: C.ink, fontWeight: '900' },
  seatStatus: { color: C.ink, fontSize: 9, fontWeight: '800', marginTop: 2 },
  doodleStar: { position: 'absolute', top: 90, right: 32, color: C.blue, fontSize: 32 },
  onboardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, paddingTop: 20 },
  onboardBrand: { fontSize: 25, fontWeight: '900', color: C.ink, transform: [{ rotate: '-4deg' }] },
  skip: { color: C.blue, fontSize: 13, fontWeight: '800' },
  onboardBody: { flex: 1, paddingHorizontal: 24, paddingTop: 58 },
  onboardEyebrow: { color: C.blue, fontSize: 12, fontWeight: '900', letterSpacing: 1.5, transform: [{ rotate: '-4deg' }] },
  onboardTitle: { color: C.ink, fontSize: 39, lineHeight: 44, fontWeight: '900', marginTop: 8, maxWidth: 310, transform: [{ rotate: '-3deg' }] },
  onboardCopy: { color: C.ink, fontSize: 15, lineHeight: 22, marginTop: 18, maxWidth: 280 },
  onboardArt: { flex: 1, justifyContent: 'center', alignItems: 'center', minHeight: 270, position: 'relative' },
  onboardEmoji: { fontSize: 100, marginTop: 32 },
  onboardArtSpark: { position: 'absolute', top: 36, right: 28, color: C.secondary, fontSize: 34 },
  onboardRoad: { color: C.ink, fontSize: 28, letterSpacing: -6, transform: [{ rotate: '-8deg' }], marginTop: -18 },
  signpost: { backgroundColor: C.primary, borderWidth: 2, borderColor: C.ink, paddingHorizontal: 15, paddingVertical: 8, transform: [{ rotate: '-5deg' }], marginTop: 22 },
  signText: { color: C.ink, fontWeight: '900', fontSize: 14 },
  onboardBottom: { paddingHorizontal: 24, paddingBottom: 22 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, marginBottom: 7 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#D8CEB8' },
  dotActive: { width: 22, backgroundColor: C.ink },
  onboardLogin: { textAlign: 'center', color: C.mute, fontSize: 12, marginTop: 6 },
  carScene: { width: 250, height: 170, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  carShadow: { position: 'absolute', bottom: 28, width: 190, height: 16, borderRadius: 50, backgroundColor: '#D8C99D', transform: [{ rotate: '-4deg' }] },
  carBody: { position: 'absolute', bottom: 46, width: 190, height: 70, borderRadius: 42, backgroundColor: '#F7C928', borderWidth: 3, borderColor: C.ink, transform: [{ rotate: '-5deg' }] },
  carRoof: { position: 'absolute', top: -30, left: 43, width: 95, height: 52, borderTopLeftRadius: 45, borderTopRightRadius: 45, backgroundColor: '#F7C928', borderWidth: 3, borderColor: C.ink },
  carWindowFront: { position: 'absolute', top: -20, left: 53, width: 35, height: 29, backgroundColor: '#A9D5D7', borderWidth: 2, borderColor: C.ink, transform: [{ skewX: '-12deg' }] },
  carWindowBack: { position: 'absolute', top: -20, left: 91, width: 36, height: 29, backgroundColor: '#A9D5D7', borderWidth: 2, borderColor: C.ink, transform: [{ skewX: '12deg' }] },
  carBumper: { position: 'absolute', right: -5, bottom: 10, width: 18, height: 12, borderRadius: 7, backgroundColor: '#EBAE18', borderWidth: 2, borderColor: C.ink },
  carHeadlight: { position: 'absolute', right: 12, top: 21, width: 13, height: 13, borderRadius: 7, backgroundColor: '#FFF4B0', borderWidth: 2, borderColor: C.ink },
  carStripe: { position: 'absolute', left: 18, right: 22, bottom: 21, height: 5, backgroundColor: '#EAAE1A', borderRadius: 3 },
  carWheel: { position: 'absolute', bottom: 29, width: 36, height: 36, borderRadius: 20, backgroundColor: C.ink, borderWidth: 3, borderColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  carWheelFront: { right: 29 },
  carWheelBack: { left: 29 },
  carHub: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#D5C9A8', borderWidth: 2, borderColor: C.ink },
  carMirror: { position: 'absolute', right: 27, top: 42, width: 12, height: 8, borderRadius: 5, backgroundColor: C.ink, transform: [{ rotate: '-20deg' }] },
  carSpark: { position: 'absolute', top: 8, left: 20, color: C.secondary, fontSize: 25 },
  plantScene: { width: 190, height: 190, alignItems: 'center', position: 'relative' },
  plantSun: { position: 'absolute', top: 5, right: 15, color: C.primaryDark, fontSize: 30 },
  plantStem: { position: 'absolute', top: 64, width: 6, height: 88, borderRadius: 4, backgroundColor: '#3B8D58', transform: [{ rotate: '3deg' }] },
  leaf: { position: 'absolute', width: 48, height: 22, borderRadius: 25, backgroundColor: '#74B85B', borderWidth: 2, borderColor: C.ink },
  plantPot: { position: 'absolute', bottom: 14, width: 72, height: 46, backgroundColor: '#F19D54', borderWidth: 3, borderColor: C.ink, borderBottomLeftRadius: 18, borderBottomRightRadius: 18 },
});

const styles = s;

export default { C, s, Btn, In, Stars, Card, Badge, ProgressBar, MatchExplanation, LabeledRow, DaySelector, Icon, TabBar, Header, StatCard, Loading, LabeledInput, GradientCard, Label: LabeledInput };
