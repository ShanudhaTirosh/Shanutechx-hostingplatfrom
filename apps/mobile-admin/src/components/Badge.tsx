import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { statusStyle, fontFamily } from '@/theme/tokens';

export function Badge({ status }: { status: string | null | undefined }) {
  if (!status) return null;
  const { bg, text, dot } = statusStyle(status);
  return (
    <View style={[styles.wrapper, { backgroundColor: bg }]}>
      <View style={[styles.dot, { backgroundColor: dot }]} />
      <Text style={[styles.label, { color: text }]}>{status.replace(/_/g, ' ')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
});
