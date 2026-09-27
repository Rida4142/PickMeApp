import React, { useEffect, useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import { api } from '../api';
import { C, s, Btn } from '../ui';
import { DoodleSparkles } from '../components/Illustrations';

const typeAliases = { request: 'BOOKING_REQUEST', accepted: 'BOOKING_ACCEPTED', rejected: 'BOOKING_REJECTED', cancelled: 'BOOKING_CANCELLED' };
const titles = {
  BOOKING_REQUEST: 'Ride request',
  BOOKING_ACCEPTED: 'Request accepted',
  BOOKING_REJECTED: 'Request declined',
  BOOKING_CANCELLED: 'Ride cancelled',
  COMMUTE_CHANGED: 'Commute changed',
  URGENT_CANCELLATION: 'Urgent cancellation',
};
const typeMarks = {
  BOOKING_REQUEST: ['+', '#E8E2FF', C.blue],
  BOOKING_ACCEPTED: ['✓', '#DDF2E8', '#318B68'],
  BOOKING_REJECTED: ['×', '#FFF0EC', C.accent],
  BOOKING_CANCELLED: ['↶', '#FFF3D4', '#B47700'],
  URGENT_CANCELLATION: ['!', '#FFE0DD', C.red],
  COMMUTE_CHANGED: ['↔', '#E8E2FF', C.blue],
};

export default function InboxScreen({ onOpen }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = async () => {
    setLoading(true); setError('');
    try {
      const notifications = await api('/api/notifications');
      if (!Array.isArray(notifications)) throw new Error('Unable to load your inbox.');
      setItems(notifications);
    }
    catch (loadError) { setError(loadError.message || 'Unable to load your inbox.'); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);
  const markAllRead = async () => {
    setError('');
    try { await api('/api/notifications/read', {}, 'PATCH'); setItems((current) => current.map((item) => ({ ...item, read: true }))); }
    catch (readError) { setError(readError.message || 'Unable to mark notifications as read.'); }
  };
  const openItem = async (item) => {
    if (!item.read) {
      try { await api(`/api/notifications/${item._id}/read`, {}, 'PATCH'); setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, read: true } : entry)); }
      catch (readError) { setError(readError.message || 'Unable to mark this notification as read.'); }
    }
    onOpen(item);
  };
  const unreadCount = items.filter((item) => !item.read).length;
  if (loading) return <View style={s.profileContainer}><Text style={s.h2}>Inbox</Text><Text style={s.mute}>Loading notifications…</Text></View>;
  return <View style={s.profileContainer}>
    <View style={s.sectionHeaderRow}><Text style={s.h2}>Inbox</Text>{unreadCount > 0 && <Btn small outline t="Mark all read" onPress={markAllRead} />}</View>
    {!!error && <View><Text style={s.authError}>{error}</Text><Btn small outline t="Retry" onPress={load} /></View>}
    {items.length === 0 && !error ? <View style={s.emptyState}><DoodleSparkles style={s.emptyInboxDoodle} /><Text style={s.name}>Your inbox is clear.</Text><Text style={[s.mute, { marginTop: 5, textAlign: 'center' }]}>Ride requests and updates will appear here.</Text></View> : items.map((item) => {
      const type = typeAliases[item.type] || item.type;
      const urgent = type === 'URGENT_CANCELLATION';
      const [mark, markBackground, markColor] = typeMarks[type] || ['•', '#FFF1B8', C.ink];
      const date = item.data?.requestedDate || item.data?.tripDate || item.data?.startDate || item.scheduledFor;
      const endDate = item.data?.endDate;
      return <TouchableOpacity key={item._id} onPress={() => openItem(item)} activeOpacity={0.82} style={[s.card, { borderLeftWidth: urgent ? 5 : 3, borderLeftColor: urgent ? C.red : item.read ? C.borderDark : C.primaryDark, backgroundColor: urgent ? '#FFF0EE' : item.read ? C.card : '#FFFBEA' }]}>
        <View style={s.notificationRow}><View style={[s.notificationIcon, { backgroundColor: markBackground }]}><Text style={[s.notificationIconText, { color: markColor }]}>{mark}</Text></View><View style={s.notificationBody}><View style={s.sectionHeaderRow}><Text style={[s.name, urgent && { color: C.red, flexShrink: 1 }]}>{titles[type] || 'PickMe notification'}</Text>{!item.read && <Text style={s.unreadBadge}>Unread</Text>}</View>
          <Text style={[s.mute, { marginTop: 4 }]}>{item.message || 'Open to view details.'}</Text>
          {!!date && <Text style={[s.mute, { marginTop: 4 }]}>{endDate ? `${date} – ${endDate}` : new Date(date).toLocaleString()}</Text>}
          {urgent && <Text style={[s.profileDanger, { marginTop: 5 }]}>URGENT</Text>}
        </View></View>
      </TouchableOpacity>;
    })}
  </View>;
}

export function RequestNotificationTarget({ requestId, bookingId }) {
  const [target, setTarget] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        if (requestId) {
          const result = await api('/api/requests');
          const request = [...(result.incoming || []), ...(result.outgoing || [])].find((item) => String(item._id) === String(requestId));
          if (request) { if (mounted) setTarget({ kind: 'request', value: request }); return; }
        }
        if (bookingId) {
          const bookings = await api('/api/bookings/mine');
          const booking = bookings.find((item) => String(item._id) === String(bookingId));
          if (booking && mounted) setTarget({ kind: 'booking', value: booking });
        }
      } catch { if (mounted) setTarget(null); }
      finally { if (mounted) setLoading(false); }
    };
    load();
    return () => { mounted = false; };
  }, [requestId, bookingId]);
  if (loading) return <Text style={s.mute}>Loading related request…</Text>;
  if (!target) return <Text style={s.mute}>The related ride is no longer available.</Text>;
  const { kind, value } = target;
  if (kind === 'booking') return <View style={[s.card, { borderColor: C.blue, borderWidth: 1 }]}>
    <Text style={s.sectionTitle}>Related booking · {value.status}</Text>
    <Text style={s.mute}>{value.commuteId?.origin?.name || 'Pickup'} → {value.commuteId?.dest?.name || 'Destination'}</Text>
    {!!(value.requestedDate || value.requestedDay !== undefined) && <Text style={s.mute}>{value.requestedDate || `Weekday ${value.requestedDay}`}</Text>}
  </View>;
  return <View style={[s.card, { borderColor: C.blue, borderWidth: 1 }]}>
    <Text style={s.sectionTitle}>Related request · {value.status}</Text>
    <Text style={s.name}>{value.fromUser?.name || value.toUser?.name || 'PickMe rider'}</Text>
    <Text style={s.mute}>{value.commuteId?.origin?.name || 'Pickup'} → {value.commuteId?.dest?.name || 'Destination'}</Text>
    {!!value.requestedDate && <Text style={s.mute}>{value.requestedDate}</Text>}
  </View>;
}
