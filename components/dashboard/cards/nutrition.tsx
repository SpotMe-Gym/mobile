import { NutritionCardContent } from '../../nutrition/NutritionCardContent';
import type { WidgetDefinition, WidgetRenderProps } from '../types';

function NutritionRender({ size }: WidgetRenderProps) {
  return <NutritionCardContent size={size} />;
}

export const nutritionWidget: WidgetDefinition = {
  id: 'nutrition',
  kind: 'card',
  category: 'nutrition',
  sizes: ['full', 'half', 'compact'],
  defaultSize: 'half',
  unique: true,
  defaultOnHome: true,
  titleKey: 'dashboard.nutrition',
  detailPath: '/nutrition/detail',
  gestureMode: 'wrapper',
  Render: NutritionRender,
};
