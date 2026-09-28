import React, { useEffect, useState } from 'react';
import {
  Alert, Image, Linking, Platform, SafeAreaView, ScrollView,
  Switch, Text, TouchableOpacity, View, useWindowDimensions,
} from 'react-native';
import { Picker } from '@react-native-picker/picker';
import * as ImagePicker from 'expo-image-picker';
import { api, session } from '../api';
import { C, s, Btn, In, Stars } from '../ui';
import { DoodleSparkles, RouteDoodle } from '../components/Illustrations';
import ProfilePreferences from '../components/ProfilePreferences';
import SeatOccupancy from '../components/SeatOccupancy';
import { getCurrentGeneralLocation } from '../utils/location';
import ScheduleField from '../components/ScheduleField';
import { formatDate, formatTime, today, plusDays } from '../utils/dates';

// ─── shared helpers ───────────────────────────────────────────────────────────

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const SAVED_LOCATION_TYPES = ['Home', 'University', 'Work', 'Other'];

const say = (message) => Platform.OS === 'web' ? window.alert(message) : Alert.alert('PickMe', message);
const hav = (a, b) => { const r = (x) => x * Math.PI / 180; const k = Math.sin(r(b.lat - a.lat) / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(r(b.lng - a.lng) / 2) ** 2; return 12742 * Math.asin(Math.sqrt(k)); };
const wa = (phone, text) => phone ? Linking.openURL(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`) : say('This user has not shared their phone number.');

// Consistent occurrence status → display
const OCC_STATUS = {
  active:    { label: 'Active',       bg: C.mint,    color: '#166534' },
  full:      { label: 'Fully Booked', bg: '#FEF9C3', color: '#854D0E' },
  cancelled: { label: 'Cancelled',    bg: '#FFE1D9', color: C.red     },
  completed: { label: 'Completed',    bg: C.lav,     color: C.blue    },
};

function StatusChip({ status }) {
  const cfg = OCC_STATUS[status] || OCC_STATUS.active;
  return (
    <View style={{ backgroundColor: cfg.bg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignSelf: 'flex-start' }}>
      <Text style={{ color: cfg.color, fontWeight: '800', fontSize: 11 }}>{cfg.label}</Text>
    </View>
  );
}

// ─── Guest placeholder ────────────────────────────────────────────────────────

export const Guest = ({ go }) => (
  <View style={s.card}>
    <Text style={s.name}>Log in to continue</Text>
    <Btn t="Log in / Sign up" onPress={() => go('auth')} />
  </View>
);

// ─── DetailScreen ─────────────────────────────────────────────────────────────
//  • Recurring commutes: date picker so the user picks which date to join.
//  • One-time commutes: date is fixed (tripDate).
//  • Sends requestedDate + seatNumber to POST /api/requests.

export function DetailScreen({ commute, back, need }) {
  const isOneTime = (commute.tripType || 'recurring') === 'one_time';

  const defaultDate = isOneTime
    ? (commute.tripDate || commute.startDate)
    : (commute.startDate && commute.startDate >= today() ? commute.startDate : today());

  const [requestedDate, setRequestedDate] = useState(defaultDate);
  const [profile, setProfile]             = useState(null);
  const [sent, setSent]                   = useState(false);
  const [occurrences, setOccurrences]     = useState([]);
  const [loadingOcc, setLoadingOcc]       = useState(false);
  const [selectedSeatNumber, setSelectedSeatNumber] = useState(null);

  useEffect(() => {
    api(`/api/users/${commute.user._id}`).then(setProfile).catch(() => {});
  }, [commute.user._id]);

  // Load occurrences so the user sees which dates are open
  useEffect(() => {
    setLoadingOcc(true);
    const from = isOneTime ? (commute.tripDate || commute.startDate) : today();
    const to   = isOneTime ? from : (commute.endDate || plusDays(30));
    api(`/api/occurrences?commuteId=${commute._id}&from=${from}&to=${to}`)
      .then(setOccurrences)
      .catch(() => {})
      .finally(() => setLoadingOcc(false));
  }, [commute._id, isOneTime, commute.tripDate, commute.startDate, commute.endDate]);

  const selectedOcc = occurrences.find(o => o.date === requestedDate);
  useEffect(() => { setSelectedSeatNumber(null); }, [requestedDate]);
  const myPendingSeat = selectedOcc?.mySelectedSeat || null;
  const seatCapacity = Math.max(0, +selectedOcc?.passengerCapacity || +commute.passengerCapacity || +commute.seats || 0);
  const bookedSeatNumbers = new Set(selectedOcc?.bookedSeatNumbers || []);
  const selectedSeatNumbers = new Set(selectedOcc?.selectedSeatNumbers || []);
  if (selectedOcc && !selectedOcc.bookedSeatNumbers) {
    const confirmedCount = Number(selectedOcc.confirmedSeats);
    const availableCount = Number(selectedOcc.availableSeats);
    const inferredCount = Number.isFinite(confirmedCount)
      ? confirmedCount
      : Number.isFinite(availableCount) ? seatCapacity - availableCount : 0;
    const bookedCount = Math.max(0, Math.min(seatCapacity, inferredCount));
    for (let number = 1; number <= bookedCount; number += 1) bookedSeatNumbers.add(number);
  }
  if (selectedOcc && !selectedOcc.selectedSeatNumbers) {
    const heldCount = Math.max(0, Math.min(seatCapacity - bookedSeatNumbers.size, +selectedOcc.selectedSeats || 0));
    for (let number = 1; number <= seatCapacity && selectedSeatNumbers.size < heldCount; number += 1) {
      if (!bookedSeatNumbers.has(number)) selectedSeatNumbers.add(number);
    }
  }
  const seatOptions = selectedOcc?.seats?.length
    ? selectedOcc.seats
    : Array.from({ length: seatCapacity }, (_, index) => {
      const number = index + 1;
      return { number, status: bookedSeatNumbers.has(number) ? 'booked' : selectedSeatNumbers.has(number) ? 'selected' : 'available' };
    });
  const availableSeatCount = selectedOcc?.availableSeats ?? Math.max(0, seatCapacity - (+selectedOcc?.confirmedSeats || 0) - (+selectedOcc?.selectedSeats || selectedSeatNumbers.size));
  const seatSelection = selectedOcc ? (
    <View style={s.card}>
      <Text style={s.lbl}>Choose a passenger seat</Text>
      <Text style={s.mute}>{availableSeatCount} available · {selectedOcc.confirmedSeats || 0} booked · {selectedOcc.selectedSeats || selectedSeatNumbers.size} selected</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
        {seatOptions.map(seat => {
          const isChosen = selectedSeatNumber === seat.number;
          const isMine = myPendingSeat === seat.number;
          const unavailable = seat.status !== 'available' && !isMine;
          return (
            <TouchableOpacity
              key={seat.number}
              disabled={unavailable || !!myPendingSeat}
              onPress={() => setSelectedSeatNumber(seat.number)}
              accessibilityLabel={`Seat ${seat.number}, ${isMine ? 'selected by you' : seat.status}`}
              style={{ width: 62, minHeight: 54, borderRadius: 8, borderWidth: 1.5, borderColor: isChosen || isMine ? C.ink : C.border, backgroundColor: isChosen ? C.primary : isMine ? C.lav : seat.status === 'booked' ? '#E9E6DE' : seat.status === 'selected' ? C.lav : C.card, alignItems: 'center', justifyContent: 'center', opacity: unavailable ? 0.7 : 1 }}
            >
              <Text style={{ fontWeight: '800', color: C.ink }}>Seat {seat.number}</Text>
              <Text style={{ fontSize: 9, color: C.mute }}>{isMine ? 'Selected' : seat.status === 'booked' ? 'Booked' : seat.status === 'selected' ? 'Selected' : seat.status === 'available' ? 'Available' : seat.status}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
      {myPendingSeat && <Text style={[s.mute, { marginTop: 8 }]}>Seat {myPendingSeat} selected · waiting for driver confirmation.</Text>}
    </View>
  ) : null;

  const join = () => {
    if (!need()) return;
    if (!requestedDate) return say('Pick a date first.');
    if (selectedOcc && selectedOcc.status === 'cancelled')  return say('That date has been cancelled by the driver.');
    if (selectedOcc && selectedOcc.status === 'full')        return say('No seats left on that date.');
    if (selectedOcc && selectedOcc.status === 'completed')   return say('That ride has already completed.');
    if (myPendingSeat) return say(`Seat ${myPendingSeat} is already selected and waiting for confirmation.`);
    if (!selectedSeatNumber) return say('Select an available seat first.');

    api('/api/requests', { commuteId: commute._id, requestedDate, seatNumber: selectedSeatNumber })
      .then(async created => {
        if (+created.seatNumber !== selectedSeatNumber) {
          if (created._id) await api(`/api/requests/${created._id}`, { status: 'cancelled' }, 'PATCH').catch(() => {});
          throw new Error('The running server does not support seat selection yet. Restart the updated server and try again.');
        }
        setSent(true);
        say(`Seat ${selectedSeatNumber} selected. It is booked after the driver confirms. You can also WhatsApp them.`);
      })
      .catch(err => say(err.message));
  };

  const message = `Hi ${commute.user.name || 'rider'}! I found you on PickMe. Are you still going ${commute.origin.name} → ${commute.dest.name} around ${commute.startTime}?`;
  const report  = () => need() && api('/api/report', { userId: commute.user._id, reason: 'Reported from ride details' }).then(() => say('Reported. Thanks!')).catch(err => say(err.message));
  const block   = () => need() && api('/api/block', { userId: commute.user._id }).then(() => { say('Blocked.'); back(); }).catch(err => say(err.message));

  return (
    <SafeAreaView style={s.fill}>
      <ScrollView contentContainerStyle={s.pad}>
        <TouchableOpacity onPress={back} style={s.backLink}><Text style={s.backLinkText}>←  Available rides</Text></TouchableOpacity>
        <Text style={s.h2}>Ride Details</Text>

        {/* ── Driver + route card ── */}
        <View style={s.card}>
          <View style={s.detailTopRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{commute.user.name || 'PickMe rider'}{commute.user.verified ? '  ✓' : ''}</Text>
              <Text style={s.rideRating}>★ {commute.user.avg || 'New'} <Text style={s.mute}>· {commute.user.count} ratings</Text></Text>
            </View>
            {commute.score != null && commute.score > 0 && (
              <View style={s.matchBadge}><Text style={s.matchBadgeText}>{commute.score}%</Text><Text style={s.matchBadgeCaption}>match</Text></View>
            )}
          </View>
          <View style={s.detailDeparture}><Text style={s.detailDepartureTime}>{commute.startTime}</Text><Text style={s.mute}>Departure · until {commute.endTime}</Text></View>
          <View style={s.detailStop}><View style={s.detailOriginPin} /><View style={{ flex: 1 }}><Text style={s.detailStopLabel}>FROM</Text><Text style={s.rideRouteName}>{commute.origin.name}</Text></View></View>
          <RouteDoodle style={s.detailRouteDoodle} />
          <View style={s.detailStop}><View style={s.detailDestinationPin} /><View style={{ flex: 1 }}><Text style={s.detailStopLabel}>TO</Text><Text style={s.rideRouteName}>{commute.dest.name}</Text></View></View>
          <View style={s.detailFacts}>
            <Text style={s.detailFact}>{commute.seats} seats</Text>
            <Text style={s.detailFact}>Rs. {commute.price} / seat</Text>
            {commute.timeFlexibility > 0 && <Text style={s.detailFact}>±{commute.timeFlexibility} min flexible</Text>}
          </View>
          <Text style={s.detailSchedule}>
            {isOneTime
              ? `One-time · ${formatDate(commute.tripDate || commute.startDate)}`
              : `${formatDate(commute.startDate)} → ${formatDate(commute.endDate)} · ${(commute.days || []).map(d => DAY_NAMES[d]).join(', ')}`}
          </Text>
        </View>

        {/* ── Date selection (recurring only) ── */}
        {!isOneTime && (
          <View style={s.card}>
            <Text style={s.lbl}>Which date do you want to join?</Text>

            <ScheduleField
              label="Travel date"
              value={requestedDate}
              mode="date"
              onChange={setRequestedDate}
            />

            {selectedOcc ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 }}>
                <StatusChip status={selectedOcc.status} />
                {selectedOcc.status === 'active' && (
                  <Text style={[s.mute, { fontSize: 12 }]}>
                    {selectedOcc.availableSeats} of {selectedOcc.passengerCapacity} seat{selectedOcc.passengerCapacity !== 1 ? 's' : ''} available
                  </Text>
                )}
              </View>
            ) : !loadingOcc && requestedDate ? (
              <Text style={[s.mute, { fontSize: 12, marginTop: 6 }]}>
                No ride scheduled on {formatDate(requestedDate)} — the driver may not have set that date up yet.
              </Text>
            ) : null}

            {/* Upcoming open dates as quick-tap chips */}
            {occurrences.filter(o => o.status === 'active' && o.date >= today()).length > 0 && (
              <>
                <Text style={[s.lbl, { marginTop: 12 }]}>Open dates</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {occurrences
                    .filter(o => o.status === 'active' && o.date >= today())
                    .slice(0, 10)
                    .map(o => (
                      <TouchableOpacity
                        key={o._id}
                        onPress={() => setRequestedDate(o.date)}
                        style={{
                          paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
                          backgroundColor: requestedDate === o.date ? C.primary : '#fff',
                          borderWidth: 1.5,
                          borderColor: requestedDate === o.date ? C.ink : C.border,
                        }}
                      >
                        <Text style={{ fontWeight: '700', fontSize: 12, color: C.ink }}>
                          {DAY_NAMES[(new Date(`${o.date}T00:00:00Z`).getUTCDay() + 6) % 7]}, {formatDate(o.date)}
                        </Text>
                        <Text style={{ fontSize: 10, color: C.mute, marginTop: 1 }}>
                          {o.availableSeats} seat{o.availableSeats !== 1 ? 's' : ''} left
                        </Text>
                      </TouchableOpacity>
                    ))
                  }
                </View>
              </>
            )}
          </View>
        )}

        {seatSelection}

        {sent && <View style={s.successBanner}><DoodleSparkles style={s.successSparkle} /><View style={{ flex: 1 }}><Text style={s.successTitle}>Request sent</Text><Text style={s.successCopy}>You’re one step closer to sharing this route.</Text><RouteDoodle style={s.successBannerRoute} /></View></View>}

        <Btn
          yellow
          t={sent ? `Seat ${selectedSeatNumber} selected ✓` : myPendingSeat ? `Seat ${myPendingSeat} selected · Awaiting driver` : `Request Seat${selectedSeatNumber ? ` ${selectedSeatNumber}` : ''}${requestedDate ? ` · ${formatDate(requestedDate)}` : ''}  →`}
          onPress={join}
          disabled={sent || !!myPendingSeat}
        />
        {!!commute.user.phone && <Btn dark t="Chat on WhatsApp  →" onPress={() => wa(commute.user.phone, message)} />}

        <Text style={s.lbl}>Reviews</Text>
        {profile && profile.reviews.length === 0 && <Text style={s.mute}>No reviews yet.</Text>}
        {profile && profile.reviews.map((review, i) => (
          <View key={i} style={s.card}>
            <Stars v={review.stars} />
            <Text>{review.comment || '—'}</Text>
            <Text style={s.mute}>by {review.from || 'rider'}</Text>
          </View>
        ))}

        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <Btn style={{ flex: 1, backgroundColor: C.lav }} t="Report" onPress={report} />
          <Btn style={{ flex: 1, backgroundColor: C.red }} t="Block"  onPress={block}  />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── RequestsScreen ───────────────────────────────────────────────────────────
//  • accept returns { request, booking } — handled
//  • Shows requestedDate and seat on every incoming / outgoing card

export function RequestsScreen() {
  const [data, setData]         = useState({ incoming: [], outgoing: [] });
  const [tripForm, setTripForm] = useState(null);
  const [matches, setMatches]   = useState([]);

  const load = () =>
    api('/api/requests').then(setData).catch(err => say(err.message));

  useEffect(() => {
    load();
    api('/api/commutes/mine')
      .then(commutes => commutes[0] && api('/api/match', commutes[0]))
      .then(result   => result && setMatches(result.slice(0, 3)))
      .catch(() => {});
  }, []);

  const act = (id, status) =>
    api(`/api/requests/${id}`, { status }, 'PATCH')
      // accept returns { request, booking }, others return the request directly
      .then(res => { load(); return res; })
      .catch(err => say(err.message));

  // Keep completion prompts scoped to the ride date as well as the commute.
  const accepted = {};
  data.incoming
    .filter(r => r.status === 'accepted' && r.commuteId)
    .forEach(r => {
      const date = r.requestedDate || new Date().toISOString().slice(0, 10);
      const key = `${r.commuteId._id}:${date}`;
      if (!accepted[key]) accepted[key] = { commute: r.commuteId, date, count: 0 };
      accepted[key].count += 1;
    });

  const finish = () =>
    api('/api/trips', {
      commuteId:   tripForm.commute._id,
      distanceKm:  tripForm.km,
      fare:        tripForm.fare,
      tripDate:    tripForm.date,
    })
      .then(trip => { setTripForm(null); say(`Trip recorded! Each person pays Rs. ${trip.perPerson}.`); load(); })
      .catch(err => say(err.message));

  return (
    <>
      <Text style={s.h2}>Requests &amp; Matches</Text>

      {/* ── Top matches ── */}
      {matches.length > 0 && (
        <>
          <Text style={s.sectionTitle}>Best matches for your commute</Text>
          {matches.map(m => (
            <View key={m._id} style={s.matchCard}>
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{m.user.name}</Text>
                <Text style={s.mute}>★ {m.user.avg || 'New'} · {m.startTime} · {m.origin.name} → {m.dest.name}</Text>
                <Text style={s.matchReason}>Going your way · {m.explanation?.daysOverlap}</Text>
              </View>
              <Text style={s.matchScore}>{m.score}%</Text>
            </View>
          ))}
        </>
      )}

      {/* ── Incoming requests ── */}
      <Text style={s.lbl}>People who want to join you</Text>
      {data.incoming.length === 0 && <Text style={s.mute}>None yet.</Text>}
      {data.incoming.map(req => (
        <View key={req._id} style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={s.name}>{req.fromUser?.name}</Text>
            {req.requestedDate && (
              <View style={{ backgroundColor: C.lav, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: C.blue, fontWeight: '700', fontSize: 11 }}>
                  {DAY_NAMES[(new Date(`${req.requestedDate}T00:00:00Z`).getUTCDay() + 6) % 7]}, {formatDate(req.requestedDate)}
                </Text>
              </View>
            )}
          </View>
          <Text style={s.mute}>
            {req.commuteId?.origin?.name} → {req.commuteId?.dest?.name} · {req.status}
          </Text>
          {req.seatNumber && <Text style={{ fontWeight: '700', color: req.status === 'accepted' ? C.success : C.primaryDark, marginTop: 4 }}>Seat {req.seatNumber} · {req.status === 'accepted' ? 'Booked' : req.status === 'pending' ? 'Selected · awaiting confirmation' : req.status}</Text>}
          {req.status === 'pending' && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <Btn style={{ flex: 1 }} yellow t="Accept" onPress={() => act(req._id, 'accepted')} />
              <Btn style={{ flex: 1, backgroundColor: C.red }} t="Reject" onPress={() => act(req._id, 'rejected')} />
            </View>
          )}
          {req.status === 'accepted' && (
            <Btn dark t="WhatsApp rider" onPress={() => wa(req.fromUser?.phone, 'Hi! Your PickMe request is accepted.')} />
          )}
        </View>
      ))}

      {/* ── Complete trip prompt for accepted riders ── */}
      {Object.values(accepted).map(({ commute, date, count }) => (
        <View key={`${commute._id}:${date}`} style={[s.card, { backgroundColor: C.mint }]}>
          <Text style={s.name}>Ride complete with {count} rider{count !== 1 ? 's' : ''}?</Text>
          {tripForm && tripForm.commute._id === commute._id && tripForm.date === date ? (
            <>
              <Text style={s.lbl}>Distance (km)</Text>
              <In keyboardType="numeric" value={String(tripForm.km)} onChangeText={v => setTripForm({ ...tripForm, km: v })} />
              <Text style={s.lbl}>Total fare (Rs)</Text>
              <In keyboardType="numeric" value={tripForm.fare} onChangeText={v => setTripForm({ ...tripForm, fare: v })} placeholder="e.g. 1200" />
              {!!tripForm.fare && (
                <Text style={s.mute}>Split {count + 1} ways: Rs. {Math.round(+tripForm.fare / (count + 1))} each</Text>
              )}
              <Btn t="Save trip & split cost" onPress={finish} />
            </>
          ) : (
            <Btn yellow t="Complete trip & split cost" onPress={() => setTripForm({
              commute,
              date,
              km:   Math.round(hav(commute.origin, commute.dest) * 1.3),
              fare: '',
            })} />
          )}
        </View>
      ))}

      {/* ── Outgoing requests ── */}
      <Text style={s.lbl}>Requests you sent</Text>
      {data.outgoing.length === 0 && <Text style={s.mute}>None yet.</Text>}
      {data.outgoing.map(req => (
        <View key={req._id} style={s.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Text style={s.name}>{req.toUser?.name}</Text>
            {req.requestedDate && (
              <View style={{ backgroundColor: C.lav, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ color: C.blue, fontWeight: '700', fontSize: 11 }}>
                  {DAY_NAMES[(new Date(`${req.requestedDate}T00:00:00Z`).getUTCDay() + 6) % 7]}, {formatDate(req.requestedDate)}
                </Text>
              </View>
            )}
          </View>
          <Text style={s.mute}>{req.commuteId?.origin?.name} → {req.commuteId?.dest?.name}</Text>
          <Text style={{ fontWeight: '700', marginTop: 4 }}>{req.status.toUpperCase()}</Text>
          {req.seatNumber && <Text style={{ fontWeight: '700', color: req.status === 'accepted' ? C.success : C.primaryDark, marginTop: 4 }}>Seat {req.seatNumber} · {req.status === 'accepted' ? 'Booked' : req.status === 'pending' ? 'Selected · awaiting confirmation' : req.status}</Text>}
          {req.status === 'pending' && (
            <Text
              onPress={() => act(req._id, 'cancelled').then(load)}
              style={[s.profileDanger, { marginTop: 6 }]}
            >
              Cancel request
            </Text>
          )}
        </View>
      ))}
    </>
  );
}

// ─── TripsScreen ──────────────────────────────────────────────────────────────
//  • Loads real occurrences from GET /api/occurrences for each active commute
//  • Per-date status chips (active/full/cancelled/completed)
//  • Driver can cancel / restore a single date, or cancel all future dates
//  • focusTripId highlights a trip (e.g. from a cancellation notification)

export function TripsScreen({ me, focusTripId }) {
  const [trips, setTrips]             = useState([]);
  const [commutes, setCommutes]       = useState([]);
  const [occurrenceMap, setOccurrenceMap] = useState({}); // commuteId → occurrence[]

  const load = () => {
    api('/api/trips/mine')
      .then(items => setTrips((items || []).map(item => item._doc ? { ...item._doc, rated: item.rated || [] } : item)))
      .catch(err => say(err.message));
    api('/api/commutes/mine')
      .then(async cs => {
        setCommutes(cs || []);
        const entries = await Promise.all(
          (cs || [])
            .filter(c => c.active)
            .map(async c => {
              const from = today();
              const to   = c.endDate || plusDays(30);
              const occs = await api(`/api/occurrences?commuteId=${c._id}&from=${from}&to=${to}`).catch(() => []);
              return [c._id, occs];
            })
        );
        setOccurrenceMap(Object.fromEntries(entries));
      })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const rate = (tripId, toUser, stars) =>
    api('/api/ratings', { tripId, toUser, stars }).then(load).catch(err => say(err.message));

  const cancelOccurrence = (occId, commuteId) => {
    Alert.alert(
      'Cancel this date?',
      'All pending and confirmed bookings for this date will be cancelled.',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Cancel ride',
          style: 'destructive',
          onPress: () =>
            api(`/api/occurrences/${occId}`, { status: 'cancelled', reason: 'Cancelled by driver' }, 'PATCH')
              .then(updated => {
                const cancelled = { ...updated, availableSeats: 0, selectedSeats: 0, seats: Array.from({ length: updated.passengerCapacity }, (_, index) => ({ number: index + 1, status: 'cancelled' })) };
                setOccurrenceMap(prev => ({
                  ...prev,
                  [commuteId]: (prev[commuteId] || []).map(o =>
                    o._id === occId ? cancelled : o
                  ),
                }));
              })
              .catch(err => say(err.message)),
        },
      ]
    );
  };

  const restoreOccurrence = (occId, commuteId) =>
    api(`/api/occurrences/${occId}`, { status: 'active' }, 'PATCH')
      .then(updated => {
        const booked = new Set(updated.bookedSeatNumbers || []);
        const selected = new Set(updated.selectedSeatNumbers || []);
        const restored = {
          ...updated,
          availableSeats: Math.max(0, updated.passengerCapacity - updated.confirmedSeats - selected.size),
          seats: Array.from({ length: updated.passengerCapacity }, (_, index) => ({
            number: index + 1,
            status: booked.has(index + 1) ? 'booked' : selected.has(index + 1) ? 'selected' : 'available',
          })),
        };
        setOccurrenceMap(prev => ({
          ...prev,
          [commuteId]: (prev[commuteId] || []).map(o =>
            o._id === occId ? restored : o
          ),
        }));
      })
      .catch(err => say(err.message));

  const cancelFutureOccurrences = commute => {
    Alert.alert(
      'Cancel future dates?',
      'All remaining dates and their pending or confirmed seats will be cancelled.',
      [
        { text: 'Keep dates', style: 'cancel' },
        {
          text: 'Cancel future dates',
          style: 'destructive',
          onPress: () => api(`/api/commutes/${commute._id}/cancel-future`, {}, 'POST')
            .then(() => {
              setCommutes(prev => prev.map(item => item._id === commute._id ? { ...item, cancelledFromDate: today() } : item));
              setOccurrenceMap(prev => ({
                ...prev,
                [commute._id]: (prev[commute._id] || []).map(o => o.date >= today()
                  ? { ...o, status: 'cancelled', availableSeats: 0, confirmedSeats: 0, selectedSeats: 0, bookedSeatNumbers: [], selectedSeatNumbers: [] }
                  : o
                ),
              }));
            })
            .catch(err => say(err.message)),
        },
      ]
    );
  };

  const activeCommutes    = commutes.filter(c => c.active);
  const recurringCommutes = activeCommutes.filter(c => (c.tripType || 'recurring') === 'recurring');
  const oneTimeCommutes   = activeCommutes.filter(c => c.tripType === 'one_time');

  return (
    <>
      <Text style={s.h2}>Trips &amp; Ratings</Text>

      {/* ── Recurring commutes with live occurrence list ── */}
      {recurringCommutes.length > 0 && (
        <>
          <Text style={s.lbl}>Recurring commutes</Text>
          {recurringCommutes.map(c => {
            const occs         = occurrenceMap[c._id] || [];
            const upcoming     = occs.filter(o => o.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
            const nextActive   = upcoming.find(o => o.status === 'active' || o.status === 'full');
            const dayLabels    = (c.days || []).map(d => DAY_NAMES[d]).join(', ');

            return (
              <View key={c._id} style={[s.card, { borderLeftWidth: 4, borderLeftColor: C.blue }]}>
                <Text style={s.name}>{c.origin?.name} → {c.dest?.name}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
                  <View style={{ backgroundColor: C.lav, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: C.blue, fontWeight: '700', fontSize: 12 }}>🔁 {dayLabels}</Text>
                  </View>
                  <View style={{ backgroundColor: C.lav, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: C.blue, fontWeight: '700', fontSize: 12 }}>⏰ {formatTime(c.startTime)}</Text>
                  </View>
                  <View style={{ backgroundColor: C.lav, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                    <Text style={{ color: C.blue, fontWeight: '700', fontSize: 12 }}>
                      📅 {formatDate(c.startDate)} – {formatDate(c.endDate)}
                    </Text>
                  </View>
                </View>

                {nextActive ? (
                  <View style={{ backgroundColor: C.mint, borderRadius: 10, padding: 10, marginTop: 10 }}>
                    <Text style={{ color: C.ink, fontWeight: '800', fontSize: 13 }}>
                      Next ride · {DAY_NAMES[(new Date(`${nextActive.date}T00:00:00Z`).getUTCDay() + 6) % 7]}, {formatDate(nextActive.date)}
                    </Text>
                    <Text style={{ color: C.ink, fontSize: 12, marginTop: 2 }}>
                      {nextActive.availableSeats} seat{nextActive.availableSeats !== 1 ? 's' : ''} available · departs {formatTime(c.startTime)}
                    </Text>
                  </View>
                ) : (
                  <Text style={[s.mute, { marginTop: 8, fontSize: 12 }]}>No upcoming open dates.</Text>
                )}

                {upcoming.length > 0 && (
                  <>
                    <Text style={[s.lbl, { marginTop: 12 }]}>Upcoming dates</Text>
                    {upcoming.slice(0, 7).map(o => (
                      <View key={o._id} style={{
                        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                        paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border,
                      }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '700', color: C.ink, fontSize: 13 }}>
                            {DAY_NAMES[(new Date(`${o.date}T00:00:00Z`).getUTCDay() + 6) % 7]}, {formatDate(o.date)}
                          </Text>
                          <Text style={[s.mute, { fontSize: 11, marginTop: 1 }]}>
                            {o.confirmedSeats}/{o.passengerCapacity} booked
                          </Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                          <StatusChip status={o.status} />
                          {String(o.userId) === String(me?._id) && (
                            o.status === 'cancelled' && !c.cancelledFromDate ? (
                              <TouchableOpacity onPress={() => restoreOccurrence(o._id, c._id)}>
                                <Text style={{ color: C.blue, fontWeight: '700', fontSize: 12 }}>Restore</Text>
                              </TouchableOpacity>
                            ) : (o.status === 'active' || o.status === 'full') ? (
                              <TouchableOpacity onPress={() => cancelOccurrence(o._id, c._id)}>
                                <Text style={{ color: C.red, fontWeight: '700', fontSize: 12 }}>Cancel date</Text>
                              </TouchableOpacity>
                            ) : null
                          )}
                        </View>
                      </View>
                    ))}
                  </>
                )}

                {!c.cancelledFromDate && c.endDate >= today() && (
                  <TouchableOpacity onPress={() => cancelFutureOccurrences(c)} style={{ marginTop: 12, alignSelf: 'flex-start' }}>
                    <Text style={s.profileDanger}>Cancel all future dates</Text>
                  </TouchableOpacity>
                )}

                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6, marginTop: 10 }}>
                  <Text style={{ fontSize: 14 }}>ℹ️</Text>
                  <Text style={{ color: C.mute, fontSize: 12, flex: 1, lineHeight: 17 }}>
                    Your carpool partner is matched fresh each date — you may ride with different people on different days.
                  </Text>
                </View>
              </View>
            );
          })}
        </>
      )}

      {/* ── One-time commutes ── */}
      {oneTimeCommutes.length > 0 && (
        <>
          <Text style={s.lbl}>Upcoming one-time trips</Text>
          {oneTimeCommutes.map(c => {
            const isPast = c.tripDate && c.tripDate < today();
            const occ    = (occurrenceMap[c._id] || [])[0];
            return (
              <View key={c._id} style={[s.card, { borderLeftWidth: 4, borderLeftColor: isPast ? C.mute : C.primary }]}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={s.name}>{c.origin?.name} → {c.dest?.name}</Text>
                  {occ ? <StatusChip status={occ.status} /> : (
                    <View style={{ backgroundColor: isPast ? C.border : C.primary, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 }}>
                      <Text style={{ color: C.ink, fontWeight: '800', fontSize: 11 }}>{isPast ? 'Past' : '📅 One-time'}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ fontWeight: '700', fontSize: 15, marginTop: 6, color: isPast ? C.mute : C.ink }}>
                  {formatDate(c.tripDate)} · {formatTime(c.startTime)}
                </Text>
                <Text style={s.mute}>
                  {c.role === 'offer' ? 'Offering a ride' : 'Looking for a ride'} · {c.seats || 1} seat{(c.seats || 1) !== 1 ? 's' : ''}
                </Text>
                {occ && String(occ.userId) === String(me?._id) && occ.status !== 'cancelled' && occ.status !== 'completed' && (
                  <TouchableOpacity onPress={() => cancelOccurrence(occ._id, c._id)} style={{ marginTop: 8 }}>
                    <Text style={s.profileDanger}>Cancel this trip</Text>
                  </TouchableOpacity>
                )}
              </View>
            );
          })}
        </>
      )}

      {/* ── Empty state (no active commutes) ── */}
      {activeCommutes.length === 0 && (
        <View style={[s.card, { alignItems: 'center', paddingVertical: 24 }]}>
          <Text style={{ fontSize: 36, marginBottom: 8 }}>🚗</Text>
          <Text style={s.name}>No active commutes yet</Text>
          <Text style={[s.mute, { textAlign: 'center', marginTop: 4 }]}>
            Post a trip from the + tab and your schedule will appear here.
          </Text>
        </View>
      )}

      {/* ── Completed trips with ratings ── */}
      <Text style={s.lbl}>Completed trips</Text>
      {trips.length === 0 && (
        <View style={s.emptyState}>
          <RouteDoodle style={s.emptyRouteDoodle} />
          <Text style={s.name}>Your next shared journey starts here.</Text>
          <Text style={[s.mute, { marginTop: 5 }]}>Completed trips and ratings will appear on this route.</Text>
        </View>
      )}
      {trips.map(trip => {
        const people = [trip.driverId, ...(trip.riders || [])].filter(
          person => person && String(person._id) !== String(me?._id)
        );
        const rated = trip.rated || [];
        const tripDayName = trip.tripDate
          ? DAY_NAMES[(new Date(`${trip.tripDate}T00:00:00Z`).getUTCDay() + 6) % 7]
          : null;

        return (
          <View key={trip._id} style={[s.card, String(trip._id) === String(focusTripId) && { borderColor: C.red, borderWidth: 2 }]}>
            <View style={s.tripRouteRow}>
              <Text style={s.tripRouteText} numberOfLines={1}>{trip.origin?.name || 'Unknown pickup'}</Text>
              <Text style={s.tripRouteArrow}>→</Text>
              <Text style={s.tripRouteText} numberOfLines={1}>{trip.dest?.name || 'Unknown destination'}</Text>
            </View>
            <Text style={s.mute}>
              {tripDayName ? `${tripDayName}, ` : ''}
              {trip.tripDate ? formatDate(trip.tripDate) : (trip.createdAt ? new Date(trip.createdAt).toDateString() : 'Recent trip')}
              {' · '}{trip.distanceKm || 0} km
            </Text>
            <Text style={s.tripFare}>Rs. {trip.perPerson || 0} each</Text>
            {people.map(person => (
              <View key={person._id} style={s.tripRiderRow}>
                <Text style={s.tripRiderName}>{person.name || 'Participant'}</Text>
                {rated.includes(String(person._id))
                  ? <Text style={s.mute}>Rated ✓</Text>
                  : <Stars v={0} set={stars => rate(trip._id, person._id, stars)} />}
              </View>
            ))}
          </View>
        );
      })}
    </>
  );
}

// ─── ProfileScreen ────────────────────────────────────────────────────────────
//  • Commute list loads /api/occurrences per commute (next 14 days) instead of
//    /api/commutes/:id/occupancy, with per-date StatusChip
//  • Profile photo, saved-location editing and privacy preferences kept

export function ProfileScreen({ me, logout, go, setForm, setMe, notice }) {
  const { width }  = useWindowDimensions();
  const userId     = me?._id || me?.id;

  const [commutes,      setCommutes]      = useState([]);
  const [locations,     setLocations]     = useState([]);
  const [buddies,       setBuddies]       = useState([]);
  const [occurrenceMap, setOccurrenceMap] = useState({}); // commuteId → occurrence[]
  const [profile,       setProfile]       = useState(null);
  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState('');

  const [editingProfile, setEditingProfile] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState(false);
  const [saving,         setSaving]         = useState(false);
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationError,  setLocationError]  = useState('');
  const [savedLocationDraft, setSavedLocationDraft] = useState(null);
  const [savedLocationQuery, setSavedLocationQuery] = useState('');
  const [savedLocationOptions, setSavedLocationOptions] = useState([]);
  const [savedLocationError, setSavedLocationError] = useState('');
  const [savedLocationSaving, setSavedLocationSaving] = useState(false);
  const [profilePhotoSaving, setProfilePhotoSaving] = useState(false);
  const [profilePhotoError, setProfilePhotoError] = useState('');
  const [profileDraft, setProfileDraft] = useState({ name: '', email: '', phone: '', gender: '', city: '', currentLocation: null });
  const [vehicleDraft, setVehicleDraft] = useState({ make: '', model: '', type: '', color: '', passengerCapacity: '', active: true });

  const user    = profile?.user || me;
  const vehicle = user?.vehicle;

  const load = async () => {
    setLoading(true); setError('');
    try {
      if (!userId) throw new Error('Your session does not contain a user ID. Please log in again.');
      const [userData, commuteData] = await Promise.all([
        api(`/api/users/${userId}`),
        api('/api/commutes/mine'),
      ]);
      setProfile(userData);
      setCommutes(commuteData || []);

      const [locationData, buddyData] = await Promise.all([
        api('/api/locations').catch(() => []),
        api('/api/buddies').catch(() => []),
      ]);
      setLocations(locationData || []);
      setBuddies(buddyData || []);

      // Load occurrences for each active commute (next 14 days)
      const occEntries = await Promise.all(
        (commuteData || [])
          .filter(c => c.active)
          .map(async c => {
            const from = today();
            const to   = c.endDate ? [c.endDate, plusDays(14)].sort()[0] : plusDays(14);
            const occs = await api(`/api/occurrences?commuteId=${c._id}&from=${from}&to=${to}`).catch(() => []);
            return [c._id, occs];
          })
      );
      setOccurrenceMap(Object.fromEntries(occEntries));
    } catch (err) {
      console.error('Profile load failed', err);
      if (err.message === 'Not found') { await logout(); return; }
      setError(err.message || 'Unable to load your profile. Try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [userId]);

  const startProfileEdit = () => {
    const gender = user.gender ? String(user.gender).charAt(0).toUpperCase() + String(user.gender).slice(1).toLowerCase() : '';
    setProfileDraft({ name: user.name || '', email: user.email || '', phone: user.phone || '', gender, city: user.city || '', currentLocation: null });
    setEditingProfile(true); setError('');
  };
  const startVehicleEdit = () => {
    setVehicleDraft({ make: vehicle?.make || '', model: vehicle?.model || '', type: vehicle?.type || '', color: vehicle?.color || '', passengerCapacity: String(vehicle?.passengerCapacity || vehicle?.seats || ''), active: vehicle?.active !== false });
    setEditingVehicle(true); setError('');
  };
  const setProfileField = (k, v) => setProfileDraft(p => ({ ...p, [k]: v }));
  const setVehicleField = (k, v) => setVehicleDraft(p => ({ ...p, [k]: v }));
  const syncProfileUpdate = async (updatedUser) => {
    setProfile((current) => ({ ...current, user: updatedUser })); setMe(updatedUser);
    const saved = await session.load(); if (saved?.t) await session.save(saved.t, updatedUser);
  };

  const chooseLocation = async () => {
    setLocationStatus('loading'); setLocationError('');
    try {
      const loc = await getCurrentGeneralLocation();
      setProfileDraft(p => ({ ...p, city: loc.publicLabel, currentLocation: loc }));
      setLocationStatus('ready');
    } catch (err) {
      setLocationStatus('error');
      setLocationError(err.message || 'Unable to get your current location.');
    }
  };

  const saveProfile = async () => {
    if (!profileDraft.name.trim())  return setError('Name is required.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(profileDraft.email.trim())) return setError('Enter a valid email address.');
    if (!profileDraft.gender)       return setError('Gender is required.');
    setSaving(true); setError('');
    try {
      const updated  = await api(`/api/users/${userId}`, { name: profileDraft.name.trim(), email: profileDraft.email.trim(), phone: profileDraft.phone.trim(), gender: profileDraft.gender, city: profileDraft.city.trim(), currentLocation: profileDraft.currentLocation || undefined }, 'PUT');
      const nextUser = { ...user, ...updated, name: profileDraft.name.trim(), email: profileDraft.email.trim(), phone: updated.phone || profileDraft.phone.trim(), gender: profileDraft.gender, city: profileDraft.city.trim() };
      setProfile(p => ({ ...p, user: nextUser }));
      setMe(nextUser);
      const saved = await session.load(); if (saved?.t) await session.save(saved.t, nextUser);
      setEditingProfile(false);
    } catch (err) { setError(err.message || 'Unable to save profile.'); }
    finally { setSaving(false); }
  };

  const saveVehicle = async () => {
    const cap = Number(vehicleDraft.passengerCapacity);
    if (!vehicleDraft.make.trim() || !vehicleDraft.model.trim() || !vehicleDraft.type.trim() || !vehicleDraft.color.trim()) return setError('Complete all vehicle fields.');
    if (!Number.isInteger(cap) || cap < 1) return setError('Passenger capacity must be a whole number greater than zero.');
    setSaving(true); setError('');
    try {
      const result = await api(`/api/users/${userId}/vehicle`, { ...vehicleDraft, passengerCapacity: cap }, 'PUT');
      const updatedUser = { ...user, vehicle: result.vehicle };
      setProfile(p => ({ ...p, user: updatedUser }));
      setMe(updatedUser);
      const saved = await session.load(); if (saved?.t) await session.save(saved.t, updatedUser);
      setEditingVehicle(false);
    } catch (err) { setError(err.message || 'Unable to save vehicle.'); }
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

  // Seat occupancy for the vehicle card: next upcoming occurrence of the first commute
  const firstOcc = commutes.length
    ? (occurrenceMap[commutes[0]._id] || []).filter(o => o.date >= today()).sort((a, b) => a.date.localeCompare(b.date))[0]
    : null;
  const primaryOccupancy = firstOcc ? {
    date: firstOcc.date,
    passengerCapacity: firstOcc.passengerCapacity,
    occupiedSeats: firstOcc.confirmedSeats,
    selectedSeats: firstOcc.selectedSeats || 0,
    availableSeats: firstOcc.availableSeats,
    seats: firstOcc.seats || [],
  } : null;

  return <View style={[s.profileContainer, { maxWidth: width >= 700 ? 780 : 780 }]}>
    <View style={s.profileHeader}><View style={s.profileAvatar}>{user.profileImage ? <Image source={{ uri: user.profileImage }} style={s.profileAvatarImage} /> : <Text style={s.profileAvatarText}>{initials}</Text>}</View><View style={s.profileIdentity}><Text style={s.h2}>{user.name || 'Name not available'}</Text><Text style={s.mute}>{user.email || 'Email not available'}</Text><Text style={s.mute}>{user.phone || 'Phone not available'}</Text></View><TouchableOpacity onPress={startProfileEdit}><Text style={s.profileLink}>Edit profile</Text></TouchableOpacity></View>
    <View style={{ flexDirection: 'row', gap: 16, marginTop: 8 }}><TouchableOpacity onPress={chooseProfilePhoto} disabled={profilePhotoSaving}><Text style={s.profileLink}>{profilePhotoSaving ? 'Saving photo…' : user.profileImage ? 'Change photo' : 'Add photo'}</Text></TouchableOpacity>{!!user.profileImage&&<TouchableOpacity onPress={confirmRemoveProfilePhoto} disabled={profilePhotoSaving}><Text style={s.profileDanger}>Remove photo</Text></TouchableOpacity>}</View>
    {!!profilePhotoError&&<Text style={s.authError}>{profilePhotoError}</Text>}
    <ProfilePreferences userId={userId} user={user} onSaved={syncProfileUpdate} />
    {!!notice && <View style={s.successBanner}><DoodleSparkles style={s.successSparkle} /><View style={{ flex: 1 }}><Text style={s.successTitle}>{notice}</Text><Text style={s.successCopy}>Your commute is ready for the PickMe community.</Text><RouteDoodle style={s.successBannerRoute} /></View></View>}
    {!!error && <Text style={s.authError}>{error}</Text>}

    {/* ── Personal info ── */}
    {editingProfile ? <View style={s.card}><Text style={s.sectionTitle}>Personal information</Text><Text style={s.authLabel}>Full Name *</Text><In value={profileDraft.name} onChangeText={(value) => setProfileField('name', value)} /><Text style={s.authLabel}>Email *</Text><In value={profileDraft.email} autoCapitalize="none" keyboardType="email-address" onChangeText={(value) => setProfileField('email', value)} /><Text style={s.authLabel}>Phone Number</Text><In value={profileDraft.phone} keyboardType="phone-pad" onChangeText={(value) => setProfileField('phone', value)} /><Text style={s.authLabel}>Gender *</Text><View style={s.selectWrap}><Picker selectedValue={profileDraft.gender} onValueChange={(value) => setProfileField('gender', value)} style={s.genderPicker}><Picker.Item label="Select gender" value="" /><Picker.Item label="Female" value="Female" /><Picker.Item label="Male" value="Male" /><Picker.Item label="Non-binary" value="Non-binary" /><Picker.Item label="Prefer not to say" value="Prefer not to say" /></Picker></View><Text style={s.authLabel}>Current/general location</Text><In value={profileDraft.city} editable={false} placeholder="Location not available" /><TouchableOpacity onPress={chooseLocation} disabled={locationStatus === 'loading'}><Text style={s.profileLink}>{locationStatus === 'loading' ? 'Getting current location...' : 'Use my current location'}</Text></TouchableOpacity>{!!locationError && <Text style={s.authError}>{locationError}</Text>}<View style={s.profileButtonRow}><Btn small outline t="Cancel" onPress={() => setEditingProfile(false)} /><Btn small yellow t={saving ? 'Saving...' : 'Save profile'} disabled={saving} onPress={saveProfile} /></View></View> : <View style={s.card}><Text style={s.sectionTitle}>Personal information</Text><Text style={s.profileValueLabel}>Gender</Text><Text style={s.profileValue}>{user.gender || 'Gender not available'}</Text><Text style={s.profileValueLabel}>Current/general location</Text><Text style={s.profileValue}>{user.city || 'Location not available'}</Text></View>}

    {/* ── Rating ── */}
    <View style={s.card}><Text style={s.sectionTitle}>Rating</Text>{rating.count > 0 ? <View style={s.ratingRow}><Text style={s.ratingNumber}>★ {rating.average}</Text><Text style={s.mute}>{rating.count} ratings</Text></View> : <Text style={s.mute}>No ratings yet</Text>}{profile?.reviews?.slice(0, 3).map((review, index) => <View key={index} style={s.reviewRow}><Text style={s.name}>{review.from || 'PickMe user'} · {review.stars}/5</Text>{review.comment && <Text style={s.mute}>{review.comment}</Text>}</View>)}</View>

    {/* ── Vehicle ── */}
    <View style={s.card}><View style={s.sectionHeaderRow}><Text style={s.sectionTitle}>Vehicle</Text><TouchableOpacity onPress={startVehicleEdit}><Text style={s.profileLink}>{vehicle ? 'Edit vehicle' : 'Add vehicle'}</Text></TouchableOpacity></View>{editingVehicle ? <><Text style={s.authLabel}>Make</Text><In value={vehicleDraft.make} onChangeText={(value) => setVehicleField('make', value)} /><Text style={s.authLabel}>Model</Text><In value={vehicleDraft.model} onChangeText={(value) => setVehicleField('model', value)} /><Text style={s.authLabel}>Type</Text><In value={vehicleDraft.type} onChangeText={(value) => setVehicleField('type', value)} /><Text style={s.authLabel}>Color</Text><In value={vehicleDraft.color} onChangeText={(value) => setVehicleField('color', value)} /><Text style={s.authLabel}>Passengers (driver excluded)</Text><In keyboardType="numeric" value={vehicleDraft.passengerCapacity} onChangeText={(value) => setVehicleField('passengerCapacity', value)} /><View style={s.switchRow}><Text style={s.profileValue}>Vehicle active</Text><Switch value={vehicleDraft.active} onValueChange={(value) => setVehicleField('active', value)} /></View><View style={s.profileButtonRow}><Btn small outline t="Cancel" onPress={() => setEditingVehicle(false)} /><Btn small yellow t={saving ? 'Saving...' : 'Save vehicle'} disabled={saving} onPress={saveVehicle} /></View></> : vehicle ? <><Text style={s.profileVehicleTitle}>{vehicle.make || ''} {vehicle.model || ''}</Text><Text style={s.profileValue}>{vehicle.type || 'Type not available'} · {vehicle.color || 'Color not available'}</Text><Text style={s.profileValue}>{vehicle.passengerCapacity || vehicle.seats || 0} passengers (driver excluded) · {vehicle.active === false ? 'Inactive' : 'Active'}</Text></> : <Text style={s.mute}>No vehicle added</Text>}</View>
    {vehicle && <SeatOccupancy occupancy={primaryOccupancy} />}

    {/* ── Saved locations ── */}
    <View style={s.card}><View style={s.sectionHeaderRow}><Text style={s.sectionTitle}>Saved locations</Text><TouchableOpacity onPress={() => editSavedLocation()} disabled={savedLocationSaving}><Text style={s.profileLink}>Add location</Text></TouchableOpacity></View>
      {savedLocationDraft&&<View><Text style={s.lbl}>{savedLocationDraft._id?'Edit saved location':'Add saved location'}</Text><Text style={s.authLabel}>Label</Text><In placeholder="Home, Work, etc." value={savedLocationDraft.label} onChangeText={(value)=>setSavedLocationDraft((current)=>({...current,label:value}))}/><Text style={s.authLabel}>Address or landmark</Text><In placeholder="Search an address or landmark" value={savedLocationQuery} onChangeText={(value)=>{setSavedLocationQuery(value);setSavedLocationDraft((current)=>({...current,name:value,lat:null,lng:null}));setSavedLocationOptions([])}}/><Btn small outline t="Search locations" disabled={savedLocationSaving} onPress={searchSavedLocation}/>{savedLocationOptions.map((option,index)=><TouchableOpacity key={`${option.lat}-${option.lng}-${index}`} style={s.locationSuggestion} onPress={()=>{setSavedLocationDraft((current)=>({...current,name:option.name,lat:option.lat,lng:option.lng}));setSavedLocationQuery(option.name);setSavedLocationOptions([]);setSavedLocationError('')}}><Text style={s.locationSuggestionText}>{option.name}</Text></TouchableOpacity>)}<Text style={s.authLabel}>Type</Text><View style={s.selectWrap}><Picker selectedValue={savedLocationDraft.type||'Other'} onValueChange={(value)=>setSavedLocationDraft((current)=>({...current,type:value}))} style={s.genderPicker}>{SAVED_LOCATION_TYPES.map(type=><Picker.Item key={type} label={type} value={type}/>)}</Picker></View>{!!savedLocationDraft.name&&savedLocationDraft.lat!=null&&<Text style={s.mute}>Coordinates selected: {Number(savedLocationDraft.lat).toFixed(4)}, {Number(savedLocationDraft.lng).toFixed(4)}</Text>}<View style={s.profileButtonRow}><Btn small outline t="Cancel" disabled={savedLocationSaving} onPress={()=>{setSavedLocationDraft(null);setSavedLocationOptions([]);setSavedLocationError('')}}/><Btn small yellow t={savedLocationSaving?'Saving…':'Save location'} disabled={savedLocationSaving} onPress={saveSavedLocation}/></View></View>}
      {!!savedLocationError&&<Text style={s.authError}>{savedLocationError}</Text>}
      {locations.length===0?<View style={s.savedLocationEmpty}><Text style={s.savedLocationEmptyIcon}>⌖</Text><Text style={s.mute}>Save Home, University, or Work to add familiar stops faster.</Text></View>:locations.map((location)=><View key={location._id} style={s.listRow}><View style={{flex:1}}><Text style={s.name}>{location.label||'Saved location'}</Text><Text style={s.mute}>{location.name||'General location'}</Text></View><TouchableOpacity onPress={()=>editSavedLocation(location)} disabled={savedLocationSaving}><Text style={s.profileLink}>Edit</Text></TouchableOpacity><TouchableOpacity onPress={()=>confirmRemoveSavedLocation(location)} disabled={savedLocationSaving}><Text style={s.profileDanger}>Delete</Text></TouchableOpacity></View>)}
    </View>

    {/* ── Buddies ── */}
    <View style={s.card}><Text style={s.sectionTitle}>Buddies</Text>{buddies.length === 0 ? <Text style={s.mute}>No buddies yet</Text> : buddies.map((entry) => <View key={entry._id} style={s.buddyRow}><View style={s.buddyAvatar}>{entry.buddy?.profileImage ? <Image source={{ uri: entry.buddy.profileImage }} style={s.buddyImage} /> : <Text style={s.buddyInitial}>{(entry.buddy?.name || 'P')[0].toUpperCase()}</Text>}</View><View><Text style={s.name}>{entry.buddy?.name || 'PickMe user'}</Text><Text style={s.mute}>{entry.buddy?.city || 'Location not available'}</Text></View></View>)}</View>

    {/* ── My commutes with occurrence-level status ── */}
    <Text style={s.sectionTitle}>My commutes</Text>
    {commutes.length === 0 && <Text style={s.mute}>Nothing posted yet — use the + tab.</Text>}
    {commutes.map(commute => {
      const isOneTime = (commute.tripType || 'recurring') === 'one_time';
      const occs      = occurrenceMap[commute._id] || [];
      const upcoming  = occs.filter(o => o.date >= today()).sort((a, b) => a.date.localeCompare(b.date));
      const nextOcc   = upcoming[0];

      return (
        <View key={commute._id} style={s.card}>
          <Text style={{ fontWeight: '700' }}>{commute.origin.name} → {commute.dest.name}</Text>
          <Text style={s.mute}>
            {isOneTime
              ? `📅 One-time · ${formatDate(commute.tripDate || commute.startDate)}`
              : `🔁 ${formatTime(commute.startTime)}–${formatTime(commute.endTime)} · ${commute.days.map(d => DAYS[d]).join('')}`
            } · {commute.role} · {commute.paused ? 'Paused' : 'Active'}
          </Text>

          {nextOcc && (
            <View style={s.occupancyBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={s.mute}>
                  Next: {DAY_NAMES[(new Date(`${nextOcc.date}T00:00:00Z`).getUTCDay() + 6) % 7]}, {formatDate(nextOcc.date)}
                </Text>
                <StatusChip status={nextOcc.status} />
              </View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 }}>
                <Text style={s.profileValue}>{nextOcc.confirmedSeats}/{nextOcc.passengerCapacity} booked</Text>
                <Text style={s.profileValue}>{nextOcc.availableSeats} seat{nextOcc.availableSeats !== 1 ? 's' : ''} open</Text>
              </View>
            </View>
          )}

          <View style={s.profileActionRow}>
            <Text
              onPress={() => {
                setForm({
                  ...commute,
                  seats:           String(commute.seats || commute.passengerCapacity || 1),
                  price:           String(commute.price || 0),
                  timeFlexibility: commute.timeFlexibility ?? 0,
                  maximumDetour:   commute.maximumDetour ?? null,
                  tripType:        commute.tripType || 'recurring',
                  tripDate:        commute.tripDate || commute.startDate || '',
                });
                go('post');
              }}
              style={s.profileLink}
            >
              Edit
            </Text>
            <Text onPress={() => api(`/api/commutes/${commute._id}`, { paused: !commute.paused }, 'PATCH').then(load)} style={s.profileLink}>{commute.paused ? 'Resume' : 'Pause'}</Text>
            <Text onPress={() => api(`/api/commutes/${commute._id}`, null, 'DELETE').then(load)} style={s.profileDanger}>Delete</Text>
          </View>
        </View>
      );
    })}

    <View style={s.profileLogout}><Btn red t="Log out" onPress={logout} /></View>
  </View>;
}