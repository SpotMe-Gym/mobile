import { useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useBodyStore } from '@/features/body/bodyStore';
import { useWeightStore } from '@/features/body-weight/weightStore';
import { useUserStore } from '@/features/profile/userStore';
import { avatarGenerator } from '@/features/body/avatar/avatarGenerator';
import { solveMorphs } from '@/features/body/avatar/solveMorphs';
import { applyMorphs } from '@/features/body/avatar/applyMorphs';
import {
  buildVertexColors,
  segmentHighlights,
  zoneHighlights,
  type HighlightMode,
} from '@/features/body/avatar/zoneColors';
import { buildSnapshots, measurementDeltas, segmentDeltas, type CompareTo } from '@/features/body/snapshots';
import { reportError } from '@/shared/lib/reporting';
import type { AvatarModel } from '@/features/body/avatar/types';
import type { AvatarGender } from '@/features/body/types';

/** Loads (and caches) the base body for a gender from the configured generator. */
export function useAvatarModel(gender: AvatarGender) {
  const [state, setState] = useState<{ gender: AvatarGender; model: AvatarModel | null; failed: boolean }>({
    gender,
    model: null,
    failed: false,
  });
  // Derived reset when the gender changes (no setState in an effect body).
  if (state.gender !== gender) setState({ gender, model: null, failed: false });

  useEffect(() => {
    let alive = true;
    avatarGenerator
      .load({ gender })
      .then((model) => {
        if (alive) setState({ gender, model, failed: false });
      })
      .catch((error: unknown) => {
        reportError(error, { context: 'useAvatarModel' });
        if (alive) setState({ gender, model: null, failed: true });
      });
    return () => {
      alive = false;
    };
  }, [gender]);

  return state.gender === gender ? state : { gender, model: null, failed: false };
}

/** Everything the Body screen needs: snapshots, deltas and the morphed, coloured mesh. */
export function useBodyAvatar(compare: CompareTo, mode: HighlightMode) {
  const { gender, heightCm, goal } = useUserStore(
    useShallow((s) => ({ gender: s.gender, heightCm: s.heightCm, goal: s.goal ?? 'maintain' })),
  );
  const weights = useWeightStore((s) => s.entries);
  const measurements = useBodyStore((s) => s.measurements);
  const biaReports = useBodyStore((s) => s.biaReports);

  const snapshots = useMemo(
    () => buildSnapshots({ gender, heightCm, weights, measurements, biaReports }, compare),
    [gender, heightCm, weights, measurements, biaReports, compare],
  );
  const { current, baseline } = snapshots;
  const { model, failed } = useAvatarModel(current.gender);

  const deltas = useMemo(() => measurementDeltas(current, baseline), [current, baseline]);
  const solution = useMemo(() => (model ? solveMorphs(model.calibration, current) : null), [model, current]);
  const positions = useMemo(
    () => (model && solution ? applyMorphs(model, solution) : null),
    [model, solution],
  );
  const colors = useMemo(
    () =>
      model
        ? buildVertexColors(
            model,
            zoneHighlights(deltas, mode, goal),
            segmentHighlights(segmentDeltas(current, baseline)),
          )
        : null,
    [model, deltas, mode, goal, current, baseline],
  );

  return { model, failed, current, baseline, deltas, solution, positions, colors, goal };
}
