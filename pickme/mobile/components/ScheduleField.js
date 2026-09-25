import React, { useState } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { s } from '../ui';
import { formatDate, formatTime, today } from '../utils/dates';

export default function ScheduleField({ label, value, mode, onChange }) {
  const [open, setOpen] = useState(false);
  const parsed = mode === 'time'
    ? new Date(`2020-01-01T${value || '08:30'}:00`)
    : new Date(`${value || today()}T12:00:00`);
  const change = (_, date) => {
    setOpen(false);
    if (!date) return;
    onChange(mode === 'time' ? date.toTimeString().slice(0, 5) : date.toISOString().slice(0, 10));
  };

  return <View style={{ flex: 1 }}>
    <Text style={s.lbl}>{label}</Text>
    <TouchableOpacity style={s.scheduleField} onPress={() => setOpen(true)}>
      <Text style={s.scheduleIcon}>{mode === 'time' ? '◷' : '▣'}</Text>
      <Text style={s.scheduleValue}>{mode === 'time' ? formatTime(value) : formatDate(value)}</Text>
    </TouchableOpacity>
    {open && <DateTimePicker value={parsed} mode={mode} display={mode === 'date' ? 'calendar' : 'clock'} onChange={change} />}
  </View>;
}
