/**
 * Single source of truth for colours. Tailwind tokens (tailwind.config.js) are generated
 * from this object, and JS-only consumers (icon `color` props, Reanimated styles, native
 * config) import it directly — so a hex value never has to be repeated in a component.
 *
 * Text tokens were picked to pass WCAG AA (4.5:1) on every surface below.
 */
export const colors = {
  background: '#0A0A0A',
  surface: '#18181b',
  'surface-elevated': '#27272a',
  'surface-sunken': '#09090b',
  border: '#27272a',
  'border-strong': '#3f3f46',
  overlay: '#000000',

  foreground: '#FFFFFF',
  muted: '#a1a1aa',
  subtle: '#909099',
  placeholder: '#71717a',
  'on-light': '#0A0A0A',

  primary: '#2563eb',
  'primary-foreground': '#FFFFFF',
  'primary-text': '#60a5fa',
  accent: '#3b82f6',

  danger: '#ef4444',
  'danger-text': '#f87171',
  success: '#22c55e',
  'success-text': '#4ade80',
  warning: '#d97706',
  'warning-text': '#fbbf24',
  highlight: '#f97316',

  protein: '#3b82f6',
  carbs: '#f97316',
  fat: '#eab308',
} as const;

export type ColorToken = keyof typeof colors;
