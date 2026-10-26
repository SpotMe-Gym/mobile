import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { toDayKey, msUntilNextDay, type DayKey } from '@/shared/utils/date';

/**
 * Today's local day key, kept current across midnight and app resumes — an app left
 * open overnight must not keep logging to yesterday.
 */
export function useToday(): DayKey {
  const [today, setToday] = useState(toDayKey);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        setToday(toDayKey());
        schedule();
      }, msUntilNextDay() + 1000);
    };
    schedule();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') setToday(toDayKey());
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return today;
}
