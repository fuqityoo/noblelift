import React from 'react';
import { View, Text, Image, StyleSheet, ViewStyle } from 'react-native';
import { getAvatarUrl } from '../lib/api';

type AvatarProps = {
  avatarUrl?: string | null;
  fullName?: string | null;
  size?: number;
  style?: ViewStyle;
};

export default function Avatar({ avatarUrl, fullName, size = 40, style }: AvatarProps) {
  const url = getAvatarUrl(avatarUrl ?? undefined);
  const initials = (fullName ?? '')
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .toUpperCase()
    .slice(0, 2) || '?';

  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.img, { width: size, height: size, borderRadius: size / 2 }, style]}
        accessibilityLabel={fullName ?? 'Avatar'}
      />
    );
  }
  return (
    <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }, style]}>
      <Text style={[styles.initials, { fontSize: size * 0.4 }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  img: { backgroundColor: '#e5e7eb' },
  fallback: { backgroundColor: '#9ca3af', alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '600' },
});
