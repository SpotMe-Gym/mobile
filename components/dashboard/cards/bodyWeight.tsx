import { BodyWeightCardContent } from '../../body-weight/BodyWeightCardContent';
import type { WidgetDefinition, WidgetRenderProps } from '../types';

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
