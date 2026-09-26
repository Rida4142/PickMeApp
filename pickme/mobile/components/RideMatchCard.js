import React, { useEffect, useRef } from 'react';
import { Animated, Text, TouchableOpacity, View } from 'react-native';
import { C, s } from '../ui';

export default function RideMatchCard({ commute, index, onPress }) {
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const animation = Animated.timing(entrance, { toValue: 1, duration: 260, delay: index * 70, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [entrance, index]);
  const name = commute.user?.name || 'PickMe rider';
  return <Animated.View style={{ opacity: entrance, transform: [{ translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
    <TouchableOpacity activeOpacity={0.82} style={s.rideCard} onPress={onPress}>
      <View style={s.rideCardTop}>
        <View style={s.rideAvatar}><Text style={s.rideAvatarText}>{name.slice(0, 1).toUpperCase()}</Text></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.name} numberOfLines={1}>{name}{commute.user?.verified ? '  ✓' : ''}</Text>
          <Text style={s.rideRating}>★ {commute.user?.avg || 'New'} <Text style={s.mute}>({commute.user?.count || 0} ratings)</Text></Text>
        </View>
        <View style={s.matchBadge}><Text style={s.matchBadgeText}>{commute.score}%</Text><Text style={s.matchBadgeCaption}>match</Text></View>
      </View>
      <View style={s.rideRoute}>
        <View style={s.rideRouteTrack}><View style={s.rideRouteDot} /><View style={s.rideRouteStem} /><Text style={s.routeDirectionMark}>↘</Text><View style={[s.rideRouteDot, s.rideRouteDotEnd]} /></View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={s.rideRouteName} numberOfLines={1}>{commute.origin.name}</Text>
          <Text style={[s.rideRouteName, { marginTop: 8 }]} numberOfLines={1}>{commute.dest.name}</Text>
        </View>
        <View style={s.rideTime}><Text style={s.rideTimeText}>{commute.startTime}</Text><Text style={s.rideTimeCaption}>departure</Text></View>
      </View>
      <View style={s.rideCardFooter}>
        <Text style={s.rideMeta}>{commute.seats} seats · {commute.role === 'offer' ? 'Offering a ride' : 'Needs a ride'}</Text>
        <Text style={s.ridePrice}>Rs. {commute.price}<Text style={s.ridePriceUnit}> / seat</Text></Text>
      </View>
    </TouchableOpacity>
  </Animated.View>;
}