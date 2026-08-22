/**
 * Design tokens, ported 1:1 from the CSS custom properties in the uploaded
 * shanutechxapp.html mockup's :root block. Kept as plain values (not
 * CSS vars, which React Native doesn't have) so every screen references
 * the same source of truth instead of hardcoding colors.
 */
export const colors = {
  bgBase: '#08070c',
  bgScreen: '#141218',
  bgScreen2: '#1a1720',
  glass: 'rgba(255,255,255,0.055)',
  glassStrong: 'rgba(255,255,255,0.10)',
  glassBorder: 'rgba(255,255,255,0.12)',
  onSurface: '#E6E0E9',
  onSurfaceVariant: '#CBC4D2',
  muted: '#948E9C',
  primary: '#CFBCFF',
  primaryDark: '#6750A4',
  primaryContainer: '#381E72',
  cyan: '#22D3EE',
  success: '#4ADE80',
  successStrong: '#22C55E',
  warning: '#E7C365',
  warningStrong: '#F59E0B',
  error: '#FFB4AB',
  errorStrong: '#EF4444',
  blue: '#60A5FA',
} as const;

export const radius = {
  lg: 22,
  md: 16,
  sm: 12,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  xxl: 28,
} as const;

export const fontFamily = {
  // These map to the Plus Jakarta Sans / Inter loaded in the mockup.
  // Loaded via expo-font in App.tsx — see lib/fonts.ts.
  head: 'PlusJakartaSans_700Bold',
  headSemibold: 'PlusJakartaSans_600SemiBold',
  headExtrabold: 'PlusJakartaSans_800ExtraBold',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.35,
    shadowRadius: 40,
    elevation: 8,
  },
  glow: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 10,
  },
} as const;

/** Status -> color mapping, matching the web dashboard's Badge component for visual consistency across platforms. */
export const statusColors: Record<string, { bg: string; text: string; dot: string }> = {
  running: { bg: 'rgba(74,222,128,0.15)', text: colors.success, dot: colors.successStrong },
  active: { bg: 'rgba(74,222,128,0.15)', text: colors.success, dot: colors.successStrong },
  paid: { bg: 'rgba(74,222,128,0.15)', text: colors.success, dot: colors.successStrong },
  manually_approved: { bg: 'rgba(74,222,128,0.15)', text: colors.success, dot: colors.successStrong },
  pending: { bg: 'rgba(231,195,101,0.15)', text: colors.warning, dot: colors.warningStrong },
  manual_review: { bg: 'rgba(231,195,101,0.15)', text: colors.warning, dot: colors.warningStrong },
  awaiting_payment: { bg: 'rgba(231,195,101,0.15)', text: colors.warning, dot: colors.warningStrong },
  building: { bg: 'rgba(96,165,250,0.15)', text: colors.blue, dot: colors.blue },
  open: { bg: 'rgba(96,165,250,0.15)', text: colors.blue, dot: colors.blue },
  failed: { bg: 'rgba(255,180,171,0.15)', text: colors.error, dot: colors.errorStrong },
  rejected: { bg: 'rgba(255,180,171,0.15)', text: colors.error, dot: colors.errorStrong },
  terminated: { bg: 'rgba(255,180,171,0.15)', text: colors.error, dot: colors.errorStrong },
  stopped: { bg: 'rgba(148,142,156,0.15)', text: colors.muted, dot: colors.muted },
  closed: { bg: 'rgba(148,142,156,0.15)', text: colors.muted, dot: colors.muted },
};

export function statusStyle(status: string | null | undefined) {
  if (!status) return { bg: colors.glass, text: colors.muted, dot: colors.muted };
  return statusColors[status] ?? { bg: colors.glass, text: colors.muted, dot: colors.muted };
}
