export const radii = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
  card: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 14,
    borderBottomLeftRadius: 14,
    borderBottomRightRadius: 20
  },
  cardLarge: {
    borderTopLeftRadius: 36,
    borderTopRightRadius: 18,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 28
  },
  button: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 10,
    borderBottomLeftRadius: 10,
    borderBottomRightRadius: 18
  },
  input: {
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0
  }
} as const;
