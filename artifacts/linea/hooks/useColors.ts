import colors from '@/constants/colors';

/** Linea is dark-first: one charcoal palette for every scheme. */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
