import React, { useEffect, useRef, useState } from 'react';
import { Animated, View, Text } from 'react-native';
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

export function RouteDoodle({ style, repeat = false }) {
  const progress = useRef(new Animated.Value(0)).current;
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const travel = Animated.timing(progress, { toValue: 1, duration: 1300, useNativeDriver: true });
    const animation = repeat ? Animated.loop(Animated.sequence([travel, Animated.timing(progress, { toValue: 0, duration: 250, useNativeDriver: true })])) : travel;
    animation.start();
    return () => animation.stop();
  }, [progress, repeat]);
  return <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={[s.routeDoodle, style]}>
    <View style={s.routeDoodleCurve} />
    <View style={s.routeDoodleTrack} />
    <View style={s.routeDoodleStart} />
    <View style={s.routeDoodleEnd} />
    <Text style={s.routeDoodleSparkLeft}>✦</Text>
    <Text style={s.routeDoodleSparkRight}>✧</Text>
    <Animated.View style={[s.routeCarMover, { transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, width - 120)] }) }] }]}>
      <View style={s.routeCarScale}><CarIllustration style={s.routeCarScene} /></View>
    </Animated.View>
  </View>;
}

export function DoodleSparkles({ style }) {
  const scale = useRef(new Animated.Value(0.75)).current;
  useEffect(() => {
    Animated.spring(scale, { toValue: 1, speed: 18, bounciness: 7, useNativeDriver: true }).start();
  }, [scale]);
  return <Animated.View style={[s.sparkleBurst, { transform: [{ scale }] }, style]}>
    <Text style={s.sparkleMain}>✦</Text>
    <Text style={s.sparkleSmall}>✧</Text>
    <Text style={s.sparkleDot}>•</Text>
  </Animated.View>;
}
