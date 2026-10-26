import { BodyWeightCardContent } from '@/features/body-weight/components/BodyWeightCardContent';
import type { WidgetDefinition, WidgetRenderProps } from '@/features/dashboard/widgets/types';

function BodyWeightRender({ size }: WidgetRenderProps) {
  return <BodyWeightCardContent size={size} />;
}

export const bodyWeightWidget: WidgetDefinition = {
  id: 'bodyWeight',
  kind: 'card',
  category: 'health',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'full',
  unique: true,
  defaultOnHome: true,
  titleKey: 'dashboard.bodyWeight',
  detailPath: '/body-weight',
  gestureMode: 'wrapper',
  Render: BodyWeightRender,
};
