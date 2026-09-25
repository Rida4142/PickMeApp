import React from 'react';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { C, s, Btn } from '../ui';
import { CarIllustration, PlantIllustration } from '../components/Illustrations';

export default function OnboardingScreen({ page, setPage, done }) {
  const { width } = useWindowDimensions();
  const slides = [
    { eyebrow: 'GOING SOMEWHERE?', title: 'Find your people.', copy: 'Share the same route, split the fare, and make every commute lighter.', accent: 'Travel together.' },
    { eyebrow: 'SAVE MONEY', title: 'Travel greener.', copy: 'Meet people nearby who are already going your way.', accent: 'Better rides, together.' },
    { eyebrow: 'CHALO', title: "Let's get started!", copy: 'Tell us where you are headed and we will help you find the right ride.', accent: 'Islamabad  →  Rawalpindi' },
  ];
  const slide = slides[page];
  return <SafeAreaView style={[s.fill, s.paper]}>
    <View style={s.onboardTop}><Text style={s.onboardBrand}>PickMe</Text><TouchableOpacity onPress={done}><Text style={s.skip}>Skip</Text></TouchableOpacity></View>
    <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled"><View style={[s.onboardBody, { width: '100%', maxWidth: 760, alignSelf: 'center', paddingHorizontal: width >= 700 ? 44 : 24 }]}><Text style={s.onboardEyebrow}>{slide.eyebrow}</Text><Text style={s.onboardTitle}>{slide.title}</Text><Text style={s.onboardCopy}>{slide.copy}</Text><View style={s.onboardArt}><Text style={s.onboardArtSpark}>✦</Text>{page === 1 ? <PlantIllustration /> : <CarIllustration />}<Text style={s.onboardRoad}>〰〰〰〰〰</Text><View style={s.signpost}><Text style={s.signText}>{slide.accent}</Text></View></View></View>
    <View style={s.onboardBottom}><View style={s.dots}>{slides.map((_, index) => <View key={index} style={[s.dot, index === page && s.dotActive]} />)}</View><Btn yellow t={page === slides.length - 1 ? 'Get Started  →' : 'Continue  →'} onPress={() => page === slides.length - 1 ? done() : setPage(page + 1)} /><Text style={s.onboardLogin} onPress={done}>Already have an account? <Text style={{ fontWeight: '800', color: C.blue }}>Log in</Text></Text></View>
    </ScrollView>
  </SafeAreaView>;
}
