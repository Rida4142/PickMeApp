import React, { useState } from 'react';
import { SafeAreaView, ScrollView, Text, TouchableOpacity, View } from 'react-native';
import { C, s, Btn, In } from '../ui';
import { api } from '../api';

export default function AuthScreen({ onDone, back, say }) {
  const [registering, setRegistering] = useState(false);
  const [values, setValues] = useState({ name: '', phone: '', email: '', cnic: '', password: '', gender: '', city: '' });
  const [error, setError] = useState('');
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));
  const submit = () => api(registering ? '/api/register' : '/api/login', values).then((result) => onDone(result.token, result.user)).catch((err) => setError(err.message));

  return <SafeAreaView style={s.fill}><ScrollView contentContainerStyle={s.authPad}><View style={s.authBrand}><Text style={s.authLogo}>PickMe</Text><Text style={s.authDot}>✦</Text></View><Text onPress={back} style={s.backButton}>←</Text><Text style={s.h1}>{registering ? 'Create your account' : 'Welcome back'}</Text><Text style={s.mute}>{registering ? "Let's get you on the road!" : 'Log in to find your people and share the journey.'}</Text>
    {!registering && <><TouchableOpacity style={s.socialButton} onPress={() => say('Google sign-in is not connected in this prototype.')}><Text style={s.socialIcon}>G</Text><Text style={s.socialText}>Continue with Google</Text></TouchableOpacity><TouchableOpacity style={s.socialButton} onPress={() => say('Apple sign-in is not connected in this prototype.')}><Text style={s.socialIcon}>●</Text><Text style={s.socialText}>Continue with Apple</Text></TouchableOpacity><View style={s.authDivider}><View style={s.dividerLine} /><Text style={s.orText}>or</Text><View style={s.dividerLine} /></View></>}
    {registering && <In placeholder="Full name" value={values.name} onChangeText={set('name')} />}<In placeholder="Phone (03001234567)" keyboardType="phone-pad" value={values.phone} onChangeText={set('phone')} />
    {registering && <><In placeholder="Email" autoCapitalize="none" value={values.email} onChangeText={set('email')} /><In placeholder="City / area" value={values.city} onChangeText={set('city')} /><In placeholder="Gender (optional)" value={values.gender} onChangeText={set('gender')} /><In placeholder="CNIC (13 digits)" keyboardType="numeric" value={values.cnic} onChangeText={set('cnic')} /></>}
    <In placeholder="Password" secureTextEntry value={values.password} onChangeText={set('password')} />{!!error && <Text style={{ color: C.red }}>{error}</Text>}<Btn yellow t={registering ? 'Sign Up' : 'Log In'} onPress={submit} /><Text onPress={() => { setRegistering(!registering); setError(''); }} style={{ textAlign: 'center', marginTop: 16, color: C.blue }}>{registering ? 'Already have an account? Log in' : 'New here? Sign up'}</Text>
  </ScrollView></SafeAreaView>;
}
