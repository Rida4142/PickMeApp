import React from 'react';
import { Text, View } from 'react-native';
import { s } from '../ui';

export default function SeatOccupancy({ occupancy }) {
  if (!occupancy) return null;
  return <View style={s.occupancyBox}>
    <Text style={s.profileValue}>Next occurrence: {occupancy.date}</Text>
    <View style={s.seatGrid}>{occupancy.seats.map((seat) => <View key={seat.number} style={[s.seat, seat.status === 'occupied' ? s.seatOccupied : s.seatOpen]}>
      <Text style={s.seatNumber}>S{seat.number}</Text>
      <Text style={s.seatStatus}>{seat.status.toUpperCase()}</Text>
    </View>)}</View>
    <Text style={s.profileValue}>Open: {occupancy.availableSeats} · Occupied: {occupancy.occupiedSeats}</Text>
  </View>;
}
