export const colors = {
  primary: '#E24D1C',
  primaryFg: '#ffffff',
  bg: '#ffffff',
  card: '#F7F8FC',
  border: '#E5E7EB',
  text: '#1F2937',
  mut: '#6B7280',
  success: '#16a34a',
  warning: '#f59e0b',
  danger:  '#dc2626',
};

export const spacing = (n: number) => n * 4;

export const radii = {
  sm: 6,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
};

export const shadow = {
  card: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
};

export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
};

export const theme = { colors, spacing, radii, shadow, breakpoints };
export type Theme = typeof theme;
export default theme;
