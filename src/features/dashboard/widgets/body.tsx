import { BodyCardContent } from '@/features/body/components/BodyCardContent';
import type { WidgetDefinition, WidgetRenderProps } from '@/features/dashboard/widgets/types';

function BodyRender({ size }: WidgetRenderProps) {
  return <BodyCardContent size={size} />;
}

export const bodyWidget: WidgetDefinition = {
  id: 'body',
  kind: 'card',
  category: 'health',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'half',
  unique: true,
  defaultOnHome: true,
  titleKey: 'dashboard.body',
  detailPath: '/body',
  gestureMode: 'wrapper',
  Render: BodyRender,
};
