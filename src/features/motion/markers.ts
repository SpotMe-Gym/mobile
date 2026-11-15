import type { TranslationKey } from '@/i18n/keys';
import { colors } from '@/theme/colors';

/** What Motion Lab can do with a video. */
export type MotionMode = 'execution' | 'machine';

export interface MarkerDef {
  key: 'handle' | 'load' | 'pivot';
  label: TranslationKey;
  hint: TranslationKey;
  color: string;
  optional?: boolean;
}

const HANDLE: MarkerDef = {
  key: 'handle',
  label: 'motion.markerHandle',
  hint: 'motion.markerHandleHint',
  color: colors['primary-text'],
};

/** The points to mark on the first frame, in the order the tracker gets them. */
export const MARKERS: Record<MotionMode, MarkerDef[]> = {
  execution: [HANDLE],
  machine: [
    HANDLE,
    { key: 'load', label: 'motion.markerLoad', hint: 'motion.markerLoadHint', color: colors.highlight },
    {
      key: 'pivot',
      label: 'motion.markerPivot',
      hint: 'motion.markerPivotHint',
      color: colors['success-text'],
      optional: true,
    },
  ],
};
