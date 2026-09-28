/**
 * PostFlow — multi-step wizard for posting a commute request.
 *
 * Steps:
 *   0 · Route      – existing RoutePicker (From / To / Map)
 *   1 · When       – One-time vs Recurring toggle + schedule fields
 *   2 · Preferences – role, seats, price, time flexibility, detour
 *   3 · Review     – summary before posting
 *
 * Props:
 *   form       object   – controlled form state from App
 *   setForm    fn       – update form state
 *   onSubmit   fn       – async fn(form) called on final "Post" tap
 *   onCancel   fn       – called when user cancels/backs out entirely
 */

import React, { useState } from 'react';
import {
  ScrollView, Text, TouchableOpacity, View, StyleSheet, Alert, Platform,
} from 'react-native';
import { C, s, Btn, In } from '../ui';
import RoutePicker from '../MapPick';
import ScheduleField from './ScheduleField';
import { formatDate, formatTime, today, plusDays } from '../utils/dates';

// ─── constants ───────────────────────────────────────────────────────────────

const DAYS_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_SHORT  = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const FLEX_OPTIONS = [
  { label: 'Exact', value: 0 },
  { label: '± 15 min', value: 15 },
  { label: '± 30 min', value: 30 },
];
const DETOUR_OPTIONS = [
  { label: 'Any', value: null },
  { label: '5 km', value: 5 },
  { label: '10 km', value: 10 },
  { label: '20 km', value: 20 },
];
const STEPS = ['Route', 'When', 'Preferences', 'Review'];
const SHARED_RIDE_CAPACITY = 4;

// ─── small shared pieces ──────────────────────────────────────────────────────

function StepHeader({ step, total, title, subtitle, onBack }) {
  return (
    <View style={ps.stepHeader}>
      {/* back arrow */}
      <TouchableOpacity onPress={onBack} style={ps.backBtn} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <Text style={ps.backArrow}>←</Text>
      </TouchableOpacity>

      {/* progress dots */}
      <View style={ps.dotsRow}>
        {Array.from({ length: total }).map((_, i) => (
          <View key={i} style={[ps.dot, i === step && ps.dotActive, i < step && ps.dotDone]} />
        ))}
      </View>

      <Text style={ps.stepLabel}>{STEPS[step]}</Text>
      <Text style={[s.h1, { marginBottom: 4 }]}>{title}</Text>
      {!!subtitle && <Text style={[s.mute, { marginBottom: 12 }]}>{subtitle}</Text>}
    </View>
  );
}

function SectionLabel({ children }) {
  return <Text style={ps.sectionLabel}>{children}</Text>;
}

function ChipRow({ options, value, onSelect }) {
  return (
    <View style={ps.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={String(opt.value)}
          onPress={() => onSelect(opt.value)}
          style={[ps.chip, value === opt.value && ps.chipActive]}
        >
          <Text style={[ps.chipText, value === opt.value && ps.chipTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function ReviewRow({ icon, label, value }) {
  return (
    <View style={ps.reviewRow}>
      <Text style={ps.reviewIcon}>{icon}</Text>
      <View style={{ flex: 1 }}>
        <Text style={ps.reviewLabel}>{label}</Text>
        <Text style={ps.reviewValue}>{value}</Text>
      </View>
    </View>
  );
}

function StepMode({ onChoose, onCancel }) {
  return (
    <View style={ps.stepBody}>
      <StepHeader step={0} total={2} title="What type of commute are you creating?" subtitle="Choose the option that fits your trip." onBack={onCancel} />
      <TouchableOpacity style={ps.modeCard} onPress={() => onChoose('own_vehicle')}>
        <Text style={ps.modeIcon}>🚘</Text>
        <Text style={ps.modeTitle}>I have a car</Text>
        <Text style={ps.modeHint}>Select your saved vehicle and offer passenger seats.</Text>
      </TouchableOpacity>
      <TouchableOpacity style={ps.modeCard} onPress={() => onChoose('hired_shared_ride')}>
        <Text style={ps.modeIcon}>👥</Text>
        <Text style={ps.modeTitle}>I don't have a car</Text>
        <Text style={ps.modeHint}>Request seats in a shared ride.</Text>
      </TouchableOpacity>
    </View>
  );
}

function StepVehicle({ form, setForm, savedVehicle, onManageVehicle, onNext, onBack }) {
  const hasVehicle = savedVehicle && savedVehicle.active !== false;
  const selected = hasVehicle && form.vehicleSnapshot?.make === savedVehicle.make
    && form.vehicleSnapshot?.model === savedVehicle.model;

  const selectVehicle = () => setForm(current => ({
    ...current,
    vehicleSnapshot: { ...savedVehicle },
    passengerCapacity: +savedVehicle.passengerCapacity || +savedVehicle.seats || 1,
    seats: String(+savedVehicle.passengerCapacity || +savedVehicle.seats || 1),
    role: 'offer',
    rideMode: 'own_vehicle',
  }));

  return (
    <View style={ps.stepBody}>
      <StepHeader step={1} total={2} title="Select car" subtitle="Choose your active vehicle." onBack={onBack} />
      {hasVehicle ? (
        <TouchableOpacity onPress={selectVehicle} style={[ps.vehicleCard, selected && ps.vehicleCardSelected]}>
          <Text style={ps.modeIcon}>🚘</Text>
          <View style={{ flex: 1 }}>
            <Text style={ps.modeTitle}>{savedVehicle.make} {savedVehicle.model}</Text>
            <Text style={ps.modeHint}>{savedVehicle.color} · {savedVehicle.type}</Text>
            <Text style={ps.modeHint}>{savedVehicle.passengerCapacity || savedVehicle.seats} passenger seats</Text>
          </View>
          <Text style={ps.vehicleCheck}>{selected ? '✓' : '○'}</Text>
        </TouchableOpacity>
      ) : (
        <View style={ps.vehicleEmpty}>
          <Text style={ps.modeTitle}>No active car saved</Text>
          <Text style={[ps.modeHint, { marginBottom: 12 }]}>Add a vehicle in Profile, then return here to select it.</Text>
          <Btn yellow t="Manage saved car" onPress={onManageVehicle} />
        </View>
      )}
      {savedVehicle?.active === false && <Text style={ps.fieldError}>This saved car is inactive. Activate it in Profile before publishing.</Text>}
      <Btn yellow t="Continue  →" disabled={!selected} onPress={onNext} style={{ marginTop: 16 }} />
    </View>
  );
}

// ─── steps ────────────────────────────────────────────────────────────────────

function StepRoute({ form, setForm, onNext, onCancel }) {
  const update = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const canNext = !!(form.origin && form.dest);

  return (
    <View style={ps.stepBody}>
      <StepHeader
        step={0} total={STEPS.length}
        title="Where are we going?"
        subtitle="Choose your pickup and destination."
        onBack={onCancel}
      />

      <RoutePicker
        o={form.origin}
        d={form.dest}
        setO={update('origin')}
        setD={update('dest')}
      />

      <Btn
        yellow
        t="Continue  →"
        onPress={() => canNext ? onNext() : Alert.alert('PickMe', 'Select both From and To locations first.')}
        style={{ marginTop: 16 }}
      />
    </View>
  );
}

function StepWhen({ form, setForm, onNext, onBack }) {
  const update = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const isOneTime = form.tripType === 'one_time';

  const toggleType = (type) => {
    if (type === 'one_time') {
      setForm((f) => ({
        ...f,
        tripType: 'one_time',
        // Ensure tripDate is set; preserve any previously chosen date
        tripDate: f.tripDate || today(),
        // Clear recurring-only fields so they don't pollute the one-time POST body
        days: [],
        startDate: null,
        endDate: null,
      }));
    } else {
      setForm((f) => ({
        ...f,
        tripType: 'recurring',
        // Restore sensible defaults if they were cleared when switching to one-time
        startDate: f.startDate || today(),
        endDate: f.endDate || plusDays(30),
        days: f.days?.length ? f.days : [0, 1, 2, 3, 4],
        // tripDate not used for recurring
        tripDate: null,
      }));
    }
  };

  const toggleDay = (i) => {
    const days = form.days || [];
    setForm((f) => ({
      ...f,
      days: days.includes(i) ? days.filter((d) => d !== i) : [...days, i],
    }));
  };

  const canNext = isOneTime
    ? !!form.tripDate && !!form.startTime && !!form.endTime
    : (form.days?.length > 0) && !!form.startDate && !!form.endDate
      && form.endDate >= form.startDate
      && !!form.startTime && !!form.endTime;

  return (
    <View style={ps.stepBody}>
      <StepHeader
        step={1} total={STEPS.length}
        title="When are you travelling?"
        subtitle="Choose one-time or a recurring schedule."
        onBack={onBack}
      />

      {/* Trip type toggle */}
      <View style={ps.typeToggle}>
        {['one_time', 'recurring'].map((type) => (
          <TouchableOpacity
            key={type}
            onPress={() => toggleType(type)}
            style={[ps.typeOption, form.tripType === type && ps.typeOptionActive]}
          >
            <Text style={ps.typeIcon}>{type === 'one_time' ? '📅' : '🔁'}</Text>
            <Text style={[ps.typeLabel, form.tripType === type && ps.typeLabelActive]}>
              {type === 'one_time' ? 'One time' : 'Recurring'}
            </Text>
            <Text style={[ps.typeDesc, form.tripType === type && ps.typeDescActive]}>
              {type === 'one_time' ? 'A specific date' : 'Repeated schedule'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── One-time fields ── */}
      {isOneTime && (
        <View style={ps.scheduleBlock}>
          <SectionLabel>Date</SectionLabel>
          <ScheduleField
            label="Travel date"
            value={form.tripDate || today()}
            mode="date"
            onChange={update('tripDate')}
          />
        </View>
      )}

      {/* ── Recurring fields ── */}
      {!isOneTime && (
        <View style={ps.scheduleBlock}>
          <SectionLabel>Date range</SectionLabel>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ScheduleField label="Starts" value={form.startDate || today()} mode="date" onChange={update('startDate')} />
            <ScheduleField label="Ends" value={form.endDate || plusDays(30)} mode="date" onChange={update('endDate')} />
          </View>

          <SectionLabel>Which days?</SectionLabel>
          <View style={ps.daysRow}>
            {DAYS_SHORT.map((d, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => toggleDay(i)}
                style={[ps.dayBtn, (form.days || []).includes(i) && ps.dayBtnActive]}
              >
                <Text style={[ps.dayBtnText, (form.days || []).includes(i) && ps.dayBtnTextActive]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          {(form.days || []).length === 0 && (
            <Text style={ps.fieldError}>Select at least one day.</Text>
          )}
        </View>
      )}

      {/* Times — shared for both types */}
      <View style={ps.scheduleBlock}>
        <SectionLabel>Departure &amp; arrival time</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ScheduleField label="Leave around" value={form.startTime || '08:30'} mode="time" onChange={update('startTime')} />
          <ScheduleField label="Arrive by" value={form.endTime || '09:30'} mode="time" onChange={update('endTime')} />
        </View>
      </View>

      <Btn
        yellow
        t="Continue  →"
        onPress={() => canNext
          ? onNext()
          : Alert.alert('PickMe', isOneTime
            ? 'Select a date and times.'
            : 'Select at least one day, a date range, and times.'
          )
        }
        style={{ marginTop: 8 }}
      />
    </View>
  );
}

function StepPreferences({ form, setForm, onNext, onBack }) {
  const update = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));
  const isCarOwner = form.rideMode === 'own_vehicle';
  const seatLimit = isCarOwner
    ? Math.max(1, +form.vehicleSnapshot?.passengerCapacity || +form.vehicleSnapshot?.seats || 1)
    : SHARED_RIDE_CAPACITY;
  const seatOptions = Array.from({ length: Math.min(seatLimit, 8) }, (_, index) => index + 1);

  return (
    <View style={ps.stepBody}>
      <StepHeader
        step={2} total={STEPS.length}
        title="Ride preferences"
        subtitle="A few details to help find the right match."
        onBack={onBack}
      />

      {/* Seats */}
      <SectionLabel>{isCarOwner ? 'Passenger capacity' : 'Seats intended, including you'}</SectionLabel>
      <View style={ps.seatsRow}>
        {seatOptions.map((n) => (
          <TouchableOpacity
            key={n}
            onPress={() => setForm((f) => ({ ...f, seats: String(n), passengerCapacity: isCarOwner ? n : SHARED_RIDE_CAPACITY, requestedSeats: isCarOwner ? undefined : n, otherCount: isCarOwner ? f.otherCount : Math.max(0, n - (+f.maleCount || 0) - (+f.femaleCount || 0)) }))}
            style={[ps.seatBtn, (form.seats === String(n) || (!form.seats && n === 1)) && ps.seatBtnActive]}
          >
            <Text style={[ps.seatBtnText, (form.seats === String(n) || (!form.seats && n === 1)) && ps.seatBtnTextActive]}>
              {n}
            </Text>
          </TouchableOpacity>
        ))}
        {isCarOwner && <In
          value={form.seats && !seatOptions.includes(+form.seats) ? form.seats : ''}
          onChangeText={(value) => setForm(f => ({ ...f, seats: value, passengerCapacity: +value || 1, requestedSeats: undefined }))}
          placeholder="Other"
          keyboardType="numeric"
          style={[ps.seatInput]}
        />}
      </View>

      {!isCarOwner && <Text style={ps.modeHint}>Shared ride capacity is assumed to be {SHARED_RIDE_CAPACITY}. Your requested party seats will be reserved.</Text>}

      {!isCarOwner && <>
        <SectionLabel>People in your party</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {[
            ['maleCount', 'Male'],
            ['femaleCount', 'Female'],
            ['otherCount', 'Other'],
          ].map(([key, label]) => (
            <View key={key} style={{ flex: 1 }}>
              <Text style={ps.genderLabel}>{label}</Text>
              <In value={String(form[key] ?? 0)} onChangeText={value => update(key)(value.replace(/\D/g, ''))} keyboardType="numeric" />
            </View>
          ))}
        </View>
        <Text style={ps.modeHint}>Counts must add up to {form.requestedSeats || form.seats} intended seats.</Text>
      </>}

      {/* Price — driver only */}
      {form.role === 'offer' && (
        <>
          <SectionLabel>Price per seat (Rs)</SectionLabel>
          <In
            value={form.price || ''}
            onChangeText={update('price')}
            placeholder="e.g. 300"
            keyboardType="numeric"
          />
        </>
      )}

      {/* Time flexibility */}
      <SectionLabel>Time flexibility</SectionLabel>
      <ChipRow
        options={FLEX_OPTIONS}
        value={form.timeFlexibility ?? 0}
        onSelect={update('timeFlexibility')}
      />

      {/* Max detour */}
      <SectionLabel>Maximum detour I can accept</SectionLabel>
      <ChipRow
        options={DETOUR_OPTIONS}
        value={form.maximumDetour ?? null}
        onSelect={update('maximumDetour')}
      />

      <Btn yellow t="Continue  →" onPress={() => {
        if (!isCarOwner) {
          const count = (+form.maleCount || 0) + (+form.femaleCount || 0) + (+form.otherCount || 0);
          if (count !== (+form.requestedSeats || +form.seats)) return Alert.alert('PickMe', 'Passenger counts must add up to the intended seats.');
        }
        onNext();
      }} style={{ marginTop: 8 }} />
    </View>
  );
}

function StepReview({ form, onSubmit, onBack, submitting }) {
  const isOneTime = form.tripType === 'one_time';
  const seats = +form.seats || 1;
  const flex = FLEX_OPTIONS.find((o) => o.value === (form.timeFlexibility ?? 0));
  const detour = DETOUR_OPTIONS.find((o) => o.value === (form.maximumDetour ?? null));
  const isSharedRide = form.rideMode === 'hired_shared_ride';

  const scheduleText = isOneTime
    ? formatDate(form.tripDate)
    : `${formatDate(form.startDate)} – ${formatDate(form.endDate)}`;

  const daysText = isOneTime
    // (getUTCDay()+6)%7 converts Sun=0 JS convention → Mon=0 server convention
    ? DAYS_LABELS[(new Date(`${form.tripDate}T12:00:00Z`).getUTCDay() + 6) % 7]
    : (form.days || []).map((d) => DAYS_LABELS[d]).join(', ') || '—';

  const timeText = `${formatTime(form.startTime)} → ${formatTime(form.endTime)}`;

  return (
    <View style={ps.stepBody}>
      <StepHeader
        step={3} total={STEPS.length}
        title="Review your request"
        subtitle="Everything look right? Post when ready."
        onBack={onBack}
      />

      <View style={ps.reviewCard}>
        <Text style={ps.reviewCardTitle}>
          {isOneTime ? '📅 One-time trip' : '🔁 Recurring commute'}
        </Text>

        <ReviewRow icon="🟢" label="From" value={form.origin?.name || '—'} />
        <ReviewRow icon="🔴" label="To"   value={form.dest?.name   || '—'} />

        <View style={ps.reviewDivider} />

        <ReviewRow icon="📅" label="Schedule" value={scheduleText} />
        {!isOneTime && <ReviewRow icon="📆" label="Days" value={daysText} />}
        <ReviewRow icon="⏰" label="Time" value={timeText} />
        <ReviewRow icon="⏱" label="Flexibility" value={flex?.label || 'Exact'} />

        <View style={ps.reviewDivider} />

        <ReviewRow icon="🚗" label="Ride type" value={isSharedRide ? 'Shared ride request' : 'Offering my car'} />
        {!isSharedRide && <ReviewRow icon="🚘" label="Saved car" value={`${form.vehicleSnapshot?.make || ''} ${form.vehicleSnapshot?.model || ''}`.trim() || '—'} />}
        <ReviewRow icon="💺" label={isSharedRide ? 'Total assumed capacity' : 'Passenger capacity'} value={String(form.passengerCapacity || seats)} />
        {isSharedRide && <ReviewRow icon="👥" label="Seats intended" value={String(form.requestedSeats || seats)} />}
        {isSharedRide && <ReviewRow icon="⚥" label="Party count" value={`Male ${form.maleCount || 0} · Female ${form.femaleCount || 0} · Other ${form.otherCount || 0}`} />}
        {!isSharedRide && (
          <ReviewRow icon="💰" label="Price" value={form.price ? `Rs. ${form.price}/seat` : 'Not set'} />
        )}
        <ReviewRow icon="📍" label="Max detour" value={detour?.label || 'Any'} />
      </View>

      <Btn
        yellow
        t={submitting ? 'Posting…' : 'Post Request  →'}
        disabled={submitting}
        onPress={onSubmit}
        style={{ marginTop: 8 }}
      />
    </View>
  );
}

// ─── main component ───────────────────────────────────────────────────────────

export default function PostFlow({ form, setForm, onSubmit, onCancel, vehicle, gender, onManageVehicle }) {
  const [step, setStep] = useState(0);
  const [stage, setStage] = useState('mode');
  const [submitting, setSubmitting] = useState(false);

  const chooseMode = (rideMode) => {
    const noCar = rideMode === 'hired_shared_ride';
    setForm(current => ({
      ...current,
      rideMode,
      role: noCar ? 'need' : 'offer',
      vehicleSnapshot: noCar ? null : vehicle || null,
      passengerCapacity: noCar ? SHARED_RIDE_CAPACITY : (+vehicle?.passengerCapacity || +vehicle?.seats || 1),
      seats: noCar ? '2' : String(+vehicle?.passengerCapacity || +vehicle?.seats || 1),
      requestedSeats: noCar ? 2 : undefined,
      maleCount: noCar && String(gender).toLowerCase() === 'male' ? 1 : 0,
      femaleCount: noCar && String(gender).toLowerCase() === 'female' ? 1 : 0,
      otherCount: noCar ? (['male', 'female'].includes(String(gender).toLowerCase()) ? 1 : 2) : 0,
    }));
    setStage(noCar ? 'wizard' : 'vehicle');
  };

  // When editing an existing commute, start at step 0 always
  const next = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
  const back = () => {
    if (step === 0) setStage(form.rideMode === 'own_vehicle' ? 'vehicle' : 'mode');
    else setStep((s) => s - 1);
  };

  const submit = async () => {
    setSubmitting(true);
    try {
      await onSubmit(form);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={ps.container}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {stage === 'mode' && <StepMode onChoose={chooseMode} onCancel={onCancel} />}
      {stage === 'vehicle' && <StepVehicle form={form} setForm={setForm} savedVehicle={vehicle} onManageVehicle={onManageVehicle} onNext={() => setStage('wizard')} onBack={() => setStage('mode')} />}
      {stage === 'wizard' && step === 0 && (
        <StepRoute form={form} setForm={setForm} onNext={next} onCancel={onCancel} />
      )}
      {stage === 'wizard' && step === 1 && (
        <StepWhen form={form} setForm={setForm} onNext={next} onBack={back} />
      )}
      {stage === 'wizard' && step === 2 && (
        <StepPreferences form={form} setForm={setForm} onNext={next} onBack={back} />
      )}
      {stage === 'wizard' && step === 3 && (
        <StepReview form={form} onSubmit={submit} onBack={back} submitting={submitting} />
      )}
    </ScrollView>
  );
}

// ─── styles ───────────────────────────────────────────────────────────────────

const ps = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 120,
    backgroundColor: C.background,
    flexGrow: 1,
  },
  stepBody: {
    flex: 1,
  },
  modeCard: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 20, alignItems: 'center', marginBottom: 12 },
  modeIcon: { fontSize: 32, marginBottom: 8 },
  modeTitle: { color: C.ink, fontWeight: '800', fontSize: 16 },
  modeHint: { color: C.mute, fontSize: 12, marginTop: 4 },
  vehicleCard: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderWidth: 1.5, borderColor: C.border, borderRadius: 12, padding: 16 },
  vehicleCardSelected: { borderColor: C.ink, backgroundColor: C.cardAlt },
  vehicleCheck: { color: C.primaryDark, fontSize: 24, fontWeight: '900' },
  vehicleEmpty: { padding: 16, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: C.border },

  // Header
  stepHeader: {
    marginBottom: 20,
  },
  backBtn: {
    marginBottom: 12,
    alignSelf: 'flex-start',
  },
  backArrow: {
    fontSize: 26,
    color: C.ink,
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.border,
  },
  dotActive: {
    width: 24,
    backgroundColor: C.ink,
  },
  dotDone: {
    backgroundColor: C.primary,
  },
  stepLabel: {
    color: C.blue,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  // Trip type toggle
  typeToggle: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  typeOption: {
    flex: 1,
    borderWidth: 2,
    borderColor: C.border,
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
  },
  typeOptionActive: {
    borderColor: C.ink,
    backgroundColor: C.primary,
  },
  typeIcon: {
    fontSize: 26,
    marginBottom: 6,
  },
  typeLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: C.ink,
    marginBottom: 2,
  },
  typeLabelActive: {
    color: C.ink,
  },
  typeDesc: {
    fontSize: 11,
    color: C.mute,
    textAlign: 'center',
  },
  typeDescActive: {
    color: C.ink,
  },

  // Days
  daysRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
    flexWrap: 'wrap',
  },
  dayBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayBtnActive: {
    backgroundColor: C.primary,
    borderColor: C.ink,
  },
  dayBtnText: {
    fontWeight: '700',
    fontSize: 14,
    color: C.mute,
  },
  dayBtnTextActive: {
    color: C.ink,
  },

  // Schedule block
  scheduleBlock: {
    marginBottom: 12,
  },
  sectionLabel: {
    color: C.ink,
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 16,
    marginBottom: 6,
  },
  fieldError: {
    color: C.red,
    fontSize: 12,
    marginTop: 4,
  },
  genderLabel: { color: C.mute, fontSize: 11, fontWeight: '700' },

  // Chips
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
  },
  chipActive: {
    backgroundColor: C.primary,
    borderColor: C.ink,
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    color: C.mute,
  },
  chipTextActive: {
    color: C.ink,
    fontWeight: '800',
  },

  // Seats
  seatsRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 4,
  },
  seatBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: C.border,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  seatBtnActive: {
    backgroundColor: C.primary,
    borderColor: C.ink,
  },
  seatBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.mute,
  },
  seatBtnTextActive: {
    color: C.ink,
  },
  seatInput: {
    flex: 1,
    minWidth: 60,
  },

  // Review card
  reviewCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: C.border,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
  },
  reviewCardTitle: {
    fontSize: 16,
    fontWeight: '900',
    color: C.ink,
    marginBottom: 16,
  },
  reviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 8,
  },
  reviewIcon: {
    fontSize: 18,
    width: 24,
    textAlign: 'center',
    marginTop: 1,
  },
  reviewLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: C.mute,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  reviewValue: {
    fontSize: 15,
    fontWeight: '600',
    color: C.ink,
    marginTop: 1,
  },
  reviewDivider: {
    height: 1,
    backgroundColor: C.border,
    marginVertical: 8,
  },
});
