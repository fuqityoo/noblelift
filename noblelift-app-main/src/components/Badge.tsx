import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

type Tone = 'slate' | 'blue' | 'amber';

const TONE_STYLES: Record<Tone, { bg: string; color: string }> = {
  blue: { bg: 'rgba(59,130,246,0.12)', color: '#1D4ED8' },
  amber: { bg: 'rgba(245,158,11,0.14)', color: '#B45309' },
  slate: { bg: 'rgba(148,163,184,0.18)', color: '#334155' },
};

type Props = { label: string; tone?: Tone };

export default function Badge({ label, tone = 'slate' }: Props) {
  const { bg, color } = TONE_STYLES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  text: { fontSize: 12 },
});
