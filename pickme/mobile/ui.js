import React from 'react';
import { Text, TextInput, TouchableOpacity, StyleSheet, Platform, View, SafeAreaView, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';

export const C = {
  primary: '#FFD93D',
  primaryDark: '#F5B800',
  secondary: '#5B4BFF',
  secondaryDark: '#4361EE',
  accent: '#FF6B6B',
  background: '#FFF8E7',
  card: '#FFFFFF',
  cardAlt: '#FFFDF7',
  text: '#1A1A2E',
  textSecondary: '#6B6B82',
  textTertiary: '#9A9AC1',
  border: '#F0E9D7',
  borderDark: '#E0D4BB',
  success: '#27AE60',
  error: '#E5484D',
  warning: '#F2C94A',
  shadow: '#000000',
  overlay: 'rgba(0,0,0,0.4)',
  y: '#FFD93D', cream: '#FFF8E7', blue: '#4F46E5', ink: '#1B1B2F',
  mute: '#8A8570', lav: '#E4DCFF', mint: '#D6F5E3', red: '#E5484D',
  gradient: ['#FFD93D', '#FFB244'],
  darkGradient: ['#1A1A2E', '#16213E'],
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
    activeOpacity={pressable ? 0.8 : 1}
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

export const Btn = ({
  t, onPress, dark, yellow, blue, red, outline, disabled, style, textStyle, small,
}) => (
  <TouchableOpacity
    onPress={onPress}
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
  </TouchableOpacity>
);

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
  paper: { backgroundColor: '#FFF8E7' },
  pad: { padding: 16, paddingBottom: 112, backgroundColor: C.background },
  padScroll: { padding: 16, paddingBottom: 100, backgroundColor: C.background },
  container: { flex: 1 },
  card: {
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 5,
    elevation: 1,
  },
  statCard: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    minWidth: 80,
    shadowColor: C.shadow,
    shadowOpacity: 0.05,
    shadowRadius: 4,
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
    padding: 16,
    borderRadius: 24,
    alignItems: 'center',
    marginVertical: 10,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 13,
    marginVertical: 5,
    borderWidth: 1,
    borderColor: C.border,
    color: C.text,
    fontSize: 15,
  },
  label: { fontWeight: '700', marginBottom: 2, color: C.ink, fontSize: 14 },
  name: { fontSize: 17, fontWeight: '700', color: C.ink },
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
  lbl: { color: C.ink, fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.7 },
  day: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, alignItems: 'center', justifyContent: 'center' },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: C.border, marginRight: 8 },
  tabBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: C.card,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: C.border,
    paddingBottom: Platform.OS === 'android' ? 12 : 8,
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
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
    backgroundColor: '#FFFFFF',
    borderRadius: 0,
    borderTopWidth: 1,
    borderColor: '#EEE6D5',
    shadowColor: C.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 10,
  },
  tabButton: { flex: 1, height: 58, alignItems: 'center', justifyContent: 'center', gap: 2 },
  tabIcon: { height: 30, textAlign: 'center' },
  tabLabel: { fontSize: 10, fontWeight: '700' },
  addTab: { flex: 0, width: 52, height: 52, marginHorizontal: 4, borderRadius: 26, backgroundColor: C.primary, borderWidth: 3, borderColor: '#FFF8E7' },
  addTabLabel: { color: '#fff' },
  h1: { fontSize: 30, fontWeight: '800', color: C.ink, marginBottom: 8 },
  h2: { fontSize: 24, fontWeight: '800', color: C.ink, marginBottom: 4 },
  h3: { fontSize: 18, fontWeight: '700', color: C.ink, marginBottom: 4 },
  mute: { color: C.textSecondary },
  section: { marginTop: 24, marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.textSecondary, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  divider: { height: 1, backgroundColor: C.border, marginVertical: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', fontSize: 20 },
  smallAvatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: C.primary, alignItems: 'center', justifyContent: 'center', fontSize: 14 },
  logo: { fontSize: 58, fontWeight: '900', color: C.ink, letterSpacing: -2 },
  splashMark: { flexDirection: 'row', alignItems: 'flex-start' },
  splashSpark: { fontSize: 28, color: C.secondary, marginTop: 4, marginLeft: 4 },
  splashTagline: { fontSize: 20, fontWeight: '700', lineHeight: 26, color: C.ink, marginTop: 6 },
  splashCar: { fontSize: 74, marginTop: 30 },
  splashHint: { color: C.ink, fontSize: 13, fontWeight: '700', marginTop: 34, letterSpacing: 0.4 },
  homeIntro: { backgroundColor: C.y, borderRadius: 12, padding: 20, marginBottom: 14, borderBottomRightRadius: 34 },
  eyebrow: { color: C.blue, fontSize: 11, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8 },
  introText: { color: C.ink, fontSize: 15, lineHeight: 22, maxWidth: 340 },
  formTitle: { color: C.ink, fontSize: 18, fontWeight: '900', marginTop: 6, marginBottom: 2 },
  routeInputRow: { flexDirection: 'row', alignItems: 'center' },
  routeDot: { width: 11, height: 11, borderRadius: 6, marginHorizontal: 8 },
  routeInput: { flex: 1 },
  mapFrame: { height: 220, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#EADFC5', marginTop: 8 },
  authPad: { padding: 22, paddingBottom: 80, backgroundColor: C.background },
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
});

const styles = s;

export default { C, s, Btn, In, Stars, Card, Badge, ProgressBar, MatchExplanation, LabeledRow, DaySelector, Icon, TabBar, Header, StatCard, Loading, LabeledInput, GradientCard, Label: LabeledInput };
