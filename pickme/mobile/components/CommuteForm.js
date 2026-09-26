import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { C, s, In } from '../ui';
import RoutePicker from '../MapPick';
import ScheduleField from './ScheduleField';

const DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function ChoiceChip({ children, selected, onPress, style }) {
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const animation = Animated.spring(scale, { toValue: selected ? 1.05 : 1, speed: 28, bounciness: 3, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [scale, selected]);
  return <Animated.View style={{ transform: [{ scale }] }}><TouchableOpacity activeOpacity={0.86} onPress={onPress} style={style}>{children}</TouchableOpacity></Animated.View>;
}

export default function CommuteForm({ form, setForm, post }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  return <View>
    <Text style={s.formTitle}>{post ? 'Plan your recurring commute' : 'Choose your route'}</Text>
    <RoutePicker o={form.origin} d={form.dest} setO={(value) => update('origin', value)} setD={(value) => update('dest', value)} />
    {post && <>
      <Text style={s.lbl}>Days you travel</Text>
      <View style={{ flexDirection: 'row', gap: 6 }}>{DAYS.map((day, index) => { const selected = form.days.includes(index); return <ChoiceChip key={index} selected={selected} onPress={() => update('days', selected ? form.days.filter((item) => item !== index) : [...form.days, index])} style={[s.day, selected && { backgroundColor: C.y, borderColor: C.primaryDark }]}><Text style={{ fontWeight: '700', color: C.ink }}>{day}</Text></ChoiceChip>; })}</View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <ScheduleField label="Departure" value={form.startTime} mode="time" onChange={(value) => update('startTime', value)} />
        <ScheduleField label="Return" value={form.endTime} mode="time" onChange={(value) => update('endTime', value)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <ScheduleField label="Starts" value={form.startDate} mode="date" onChange={(value) => update('startDate', value)} />
        <ScheduleField label="Ends" value={form.endDate} mode="date" onChange={(value) => update('endDate', value)} />
      </View>
      <Text style={s.lbl}>Ride type</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{[['need', 'Need a ride'], ['offer', 'Offer a ride'], ['either', 'Either']].map(([key, label]) => { const selected = form.role === key; return <ChoiceChip key={key} selected={selected} onPress={() => update('role', key)} style={[s.chip, selected && { backgroundColor: C.y, borderColor: C.primaryDark }]}><Text style={{ color: C.ink, fontWeight: selected ? '800' : '600' }}>{label}</Text></ChoiceChip>; })}</View>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <View style={{ flex: 1 }}><Text style={s.lbl}>Seats</Text><In value={form.seats} onChangeText={(value) => update('seats', value)} keyboardType="numeric" /></View>
        <View style={{ flex: 1 }}><Text style={s.lbl}>Rs / seat</Text><In value={form.price} onChangeText={(value) => update('price', value)} keyboardType="numeric" /></View>
      </View>
    </>}
  </View>;
}
