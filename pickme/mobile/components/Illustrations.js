import React from 'react';
import { View, Text } from 'react-native';
import { s } from '../ui';

export function CarIllustration({ style }) {
  return <View style={[s.carScene, style]}>
    <View style={s.carShadow} />
    <View style={s.carBody}>
      <View style={s.carRoof} />
      <View style={s.carWindowFront} />
      <View style={s.carWindowBack} />
      <View style={s.carBumper} />
      <View style={s.carHeadlight} />
      <View style={s.carStripe} />
    </View>
    <View style={[s.carWheel, s.carWheelFront]}><View style={s.carHub} /></View>
    <View style={[s.carWheel, s.carWheelBack]}><View style={s.carHub} /></View>
    <View style={s.carMirror} />
    <Text style={s.carSpark}>✦</Text>
  </View>;
}

export function PlantIllustration() {
  return <View style={s.plantScene}>
    <Text style={s.plantSun}>☼</Text>
    <View style={s.plantStem} />
    <View style={[s.leaf, { transform: [{ rotate: '-35deg' }], left: 38, top: 72 }]} />
    <View style={[s.leaf, { transform: [{ rotate: '35deg' }], right: 38, top: 94 }]} />
    <View style={s.plantPot} />
  </View>;
}
