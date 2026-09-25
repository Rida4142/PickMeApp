import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, Text, TouchableOpacity, View, useWindowDimensions } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import { C, s, Btn, In } from '../ui';
import { api } from '../api';
import { getCurrentGeneralLocation } from '../utils/location';

const initialValues = { name: '', email: '', phone: '', gender: '', cnic: '', city: '', password: '' };
const genders = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

const Field = ({ label, required, error, children }) => <View style={s.authField}>
  <Text style={s.authLabel}>{label}{required && <Text style={s.required}> *</Text>}</Text>
  {children}
  {!!error && <Text style={s.authError}>{error}</Text>}
</View>;

export default function AuthScreen({ onDone, back, say }) {
  const [registering, setRegistering] = useState(false);
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [locationStatus, setLocationStatus] = useState('idle');
  const [locationError, setLocationError] = useState('');
  const { width } = useWindowDimensions();
  const set = (key) => (value) => {
    setValues((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: '' }));
  };
  const requestCurrentLocation = async () => {
    setLocationStatus('loading');
    setLocationError('');
    setErrors((current) => ({ ...current, city: '' }));
    try {
      const location = await getCurrentGeneralLocation();
      set('city')(location.publicLabel);
      setLocationStatus('ready');
    } catch (error) {
      const message = error.code === 1 ? 'Location permission was denied. Allow access in your device or browser settings, then try again.' : error.message || 'We could not access your current location. Please try again.';
      setLocationStatus('error');
      setLocationError(message);
    }
  };
  useEffect(() => {
    if (registering) requestCurrentLocation();
  }, [registering]);
  const validate = () => {
    const next = {};
    const phone = values.phone.replace(/\D/g, '');
    const cnic = values.cnic.replace(/\D/g, '');
    if (registering) {
      if (!values.name.trim()) next.name = 'Enter your full name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) next.email = 'Enter a valid email address.';
      if (!/^(03\d{9}|92\d{10})$/.test(phone)) next.phone = 'Enter a valid phone number, such as 03001234567.';
      if (!values.gender) next.gender = 'Select your gender.';
      if (!/^\d{13}$/.test(cnic)) next.cnic = 'CNIC must contain 13 digits.';
      if (!values.city.trim()) next.city = 'Enter your city, area, or general location.';
      if (values.password.length < 6) next.password = 'Password must be at least 6 characters.';
    } else {
      if (!/^(03\d{9}|92\d{10})$/.test(phone)) next.phone = 'Enter the phone number used for your account.';
      if (!values.password) next.password = 'Enter your password.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };
  const submit = () => {
    if (!validate()) return;
    api(registering ? '/api/register' : '/api/login', values)
      .then((result) => onDone(result.token, result.user))
      .catch((err) => setErrors({ form: err.message }));
  };
  const toggleMode = () => { setRegistering((current) => !current); setValues(initialValues); setErrors({}); setLocationStatus('idle'); setLocationError(''); };

  return <SafeAreaView style={s.fill}><KeyboardAvoidingView style={s.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView contentContainerStyle={[s.authPad, { flexGrow: 1 }]} keyboardShouldPersistTaps="handled"><View style={[s.authPanel, { maxWidth: width >= 700 ? 560 : 560 }]}><View style={s.authBrand}><Text style={s.authLogo}>PickMe</Text><Text style={s.authDot}>✦</Text></View>{back && <Text onPress={back} style={s.backButton}>←</Text>}<Text style={s.h1}>{registering ? 'Create your account' : 'Welcome back'}</Text><Text style={s.mute}>{registering ? "Let's get you on the road!" : 'Log in to find your people and share the journey.'}</Text>
    {!registering && <><TouchableOpacity style={s.socialButton} onPress={() => say('Google sign-in is not connected in this prototype.')}><Text style={s.socialIcon}>G</Text><Text style={s.socialText}>Continue with Google</Text></TouchableOpacity><TouchableOpacity style={s.socialButton} onPress={() => say('Apple sign-in is not connected in this prototype.')}><Text style={s.socialIcon}>●</Text><Text style={s.socialText}>Continue with Apple</Text></TouchableOpacity><View style={s.authDivider}><View style={s.dividerLine} /><Text style={s.orText}>or</Text><View style={s.dividerLine} /></View></>}
    {registering && <Field label="Full Name" required error={errors.name}><In placeholder="Your full name" value={values.name} onChangeText={set('name')} /></Field>}
    {registering && <Field label="Email" required error={errors.email}><In placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" value={values.email} onChangeText={set('email')} /></Field>}
    <Field label="Phone Number" required error={errors.phone}><In placeholder="03001234567" keyboardType="phone-pad" value={values.phone} onChangeText={set('phone')} /></Field>
    {registering && <Field label="Gender" required error={errors.gender}><View style={s.selectWrap}><Picker selectedValue={values.gender} onValueChange={set('gender')} style={s.genderPicker}><Picker.Item label="Select gender" value="" />{genders.map((gender) => <Picker.Item key={gender} label={gender} value={gender} />)}</Picker></View></Field>}
    {registering && <Field label="CNIC" required error={errors.cnic}><In placeholder="13-digit CNIC" keyboardType="numeric" value={values.cnic} onChangeText={set('cnic')} /></Field>}
    {registering && <Field label="Current Location" required error={errors.city}><View style={s.locationControl}><In placeholder={locationStatus === 'loading' ? 'Getting your current location...' : 'Current general location'} value={values.city} editable={false} /><TouchableOpacity onPress={requestCurrentLocation} disabled={locationStatus === 'loading'}><Text style={s.locationRetry}>{locationStatus === 'loading' ? 'Requesting location...' : 'Use my current location'}</Text></TouchableOpacity>{!!locationError && <Text style={s.authError}>{locationError}</Text>}</View></Field>}
    <Field label="Password" required error={errors.password}><In placeholder={registering ? 'At least 6 characters' : 'Your password'} secureTextEntry value={values.password} onChangeText={set('password')} /></Field>
    {!!errors.form && <Text style={s.authFormError}>{errors.form}</Text>}<Btn yellow t={registering ? 'Sign Up' : 'Log In'} onPress={submit} /><Text onPress={toggleMode} style={s.authModeToggle}>{registering ? 'Already have an account? Log in' : 'New here? Sign up'}</Text>
  </View></ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
