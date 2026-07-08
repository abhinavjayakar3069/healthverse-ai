// Design tokens. Picked deliberately for a health app: sage/green reads as
// vitality and calm without the generic "medical blue" cliche, warm coral
// is used sparingly for anything urgent so it doesn't cry wolf.
export const colors = {
  background: '#F7F6F2',      // soft warm off-white, not stark white
  surface: '#FFFFFF',
  surfaceAlt: '#EEF2ED',       // faint sage-tinted card background
  ink: '#1B1B1F',              // near-black text
  inkMuted: '#6B7280',
  primary: '#2D6A4F',          // deep sage green - brand color
  primaryLight: '#74C69D',
  primarySoft: '#D8ECE2',      // for chip/badge backgrounds
  accentCoral: '#E76F51',      // used only for high-risk / urgent states
  accentAmber: '#E9A23B',      // moderate-risk state
  border: '#E4E1D8',
  white: '#FFFFFF',
};

export const risk = {
  Low: colors.primary,
  Moderate: colors.accentAmber,
  High: colors.accentCoral,
};

export const spacing = {
  xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48,
};

export const radius = {
  sm: 8, md: 14, lg: 20, pill: 999,
};

export const type = {
  display: { fontSize: 34, fontWeight: '700', letterSpacing: -0.5, color: colors.ink },
  h1: { fontSize: 24, fontWeight: '700', color: colors.ink },
  h2: { fontSize: 18, fontWeight: '600', color: colors.ink },
  body: { fontSize: 15, fontWeight: '400', color: colors.ink, lineHeight: 21 },
  caption: { fontSize: 13, fontWeight: '500', color: colors.inkMuted },
  label: { fontSize: 12, fontWeight: '600', color: colors.inkMuted, letterSpacing: 0.4 },
};

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
};
