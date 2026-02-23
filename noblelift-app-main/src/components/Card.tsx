import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { colors, spacing, radii } from '../ui/theme';

type Props = {
  children: React.ReactNode;
  style?: ViewStyle;
};

export default function Card({ children, style }: Props) {
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#fff',
    borderRadius: radii.md,
    padding: spacing(3),
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing(3),
  },
});
