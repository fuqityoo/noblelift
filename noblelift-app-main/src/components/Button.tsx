import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle, StyleProp } from 'react-native';
import { colors, radii, spacing } from '../ui/theme';

type Props = {
  title: string;
  onPress: () => void | Promise<void>;
  kind?: 'primary' | 'ghost';
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export default function Button({ title, onPress, kind='primary', style, disabled=false }: Props) {
  const bg = kind === 'primary' ? colors.primary : '#fff';
  const fg = kind === 'primary' ? colors.primaryFg : colors.text;
  const borderColor = kind === 'primary' ? colors.primary : colors.border;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: bg, borderColor },
        disabled && styles.disabled,
        pressed && !disabled && { opacity: 0.85 },
        style,
      ]}
    >
      <Text style={[styles.text, { color: fg }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: spacing(3.5),
    paddingHorizontal: spacing(5),
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
    borderWidth: 1,
  },
  text: { fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
