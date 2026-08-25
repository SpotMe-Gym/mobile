import { useRouter } from 'expo-router';
import { TodaysPlanCardContent } from '../../workouts/TodaysPlanCardContent';
import { useTodaysWorkouts } from '../../../hooks/useTodaysWorkouts';
import type { WidgetDefinition, WidgetRenderProps } from '../types';

function TodaysPlanRender({
  size,
  width,
  isEditing,
  onEnterEdit,
  onOpenDetail,
  onPressIn,
  onPressOut,
}: WidgetRenderProps) {
  const router = useRouter();
  const { workouts, isHydrated } = useTodaysWorkouts();

  return (
    <TodaysPlanCardContent
      workouts={workouts}
      isHydrated={isHydrated}
      pageWidth={Math.max(width - 2, 0)}
      size={size}
      style={{ flex: 1 }}
      interactionsDisabled={isEditing}
      onOpen={onOpenDetail}
      onPressIn={isEditing ? undefined : onPressIn}
      onPressOut={isEditing ? undefined : onPressOut}
      onLongPress={onEnterEdit}
      onAction={() => router.push('/workouts')}
    />
  );
}

export const todaysPlanWidget: WidgetDefinition = {
  id: 'todaysPlan',
  kind: 'card',
  category: 'training',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'half',
  unique: true,
  defaultOnHome: true,
  titleKey: 'dashboard.todaysPlan',
  detailPath: '/workouts/today',
  gestureMode: 'inner',
  Render: TodaysPlanRender,
};
