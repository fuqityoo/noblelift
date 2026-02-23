import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, KeyboardAvoidingView, Platform, SafeAreaView, ScrollView, ActivityIndicator, Pressable } from 'react-native';
import { colors, spacing, radii } from '../ui/theme';
import { auth } from '../store/auth';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [touched, setTouched] = useState(false);

  const validEmail = EMAIL_RE.test(email.trim());
  const isValid    = validEmail;

  const onSubmit = async () => {
    setTouched(true);
    if (!isValid || loading) return;
    setErr(null);
    setLoading(true);
    try {
      await auth.login(email.trim(), pass);
    } catch (e: any) {
      const msg = typeof e?.message === 'string' && /unauthorized|401/.test(e.message) ? 'Неверный email или пароль' :
                  typeof e?.message === 'string' && /NetworkError|Failed to fetch|CORS/i.test(e.message) ? 'Сервер недоступен или блокируется CORS' :
                  'Ошибка авторизации';
      setErr(msg);
    } finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.header}><Text style={styles.title}>Вход</Text></View>
          <View style={styles.card}>
            <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor={colors.mut} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            {touched && !validEmail && <Text style={styles.hint}>Введите корректный email</Text>}
            <TextInput style={styles.input} placeholder="Пароль" placeholderTextColor={colors.mut} value={pass} onChangeText={setPass} secureTextEntry />
            {touched && <Text style={styles.hint}>Минимум 8 символов: буквы и цифры</Text>}

            {!!err && <Text style={styles.error}>{err}</Text>}

            <Pressable onPress={onSubmit} disabled={loading || !isValid} style={({ pressed }) => [
              styles.button, (loading || !isValid) && { opacity: 0.5 }, pressed && isValid && !loading && { opacity: 0.85 }
            ]}>
              {loading ? <ActivityIndicator /> : <Text style={styles.buttonText}>Войти</Text>}
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  wrap: { flexGrow: 1, padding: spacing(3), justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: spacing(6) },
  title: { fontSize: 32, fontWeight: '700', color: colors.text },
  card: { alignSelf: 'center', width: '100%', maxWidth: 420 },
  input: { borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#fff', borderRadius: radii.md, paddingHorizontal: spacing(2), paddingVertical: spacing(1.5), marginBottom: spacing(2), color: colors.text },
  hint: { color: '#6B7280', marginTop: -8, marginBottom: spacing(2) },
  error: { color: '#DC2626', marginBottom: spacing(2) },
  button: { height: 48, borderRadius: radii.md, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ee8f74', marginTop: spacing(1) },
  buttonText: { color: '#fff', fontWeight: '700' },
});
