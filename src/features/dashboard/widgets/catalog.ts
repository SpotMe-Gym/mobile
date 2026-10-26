/**
 * Home catalog. Each widget lives in its own file in this folder (quick actions share
 * `quickActions.tsx`). Add a file and append it here.
 */
import {
  bodyWeightWidget,
  bodyWidget,
  todaysPlanWidget,
  nutritionWidget,
  recentActivityWidget,
} from '@/features/dashboard/widgets';
import { logMealAction, addWeightAction } from '@/features/dashboard/widgets/quickActions';
import type { WidgetDefinition, WidgetCategory } from '@/features/dashboard/widgets/types';
import type { TranslationKey } from '@/i18n/keys';

export type { WidgetDefinition, WidgetRenderProps, WidgetCategory, WidgetGestureMode, WidgetKind } from '@/features/dashboard/widgets/types';

export const WIDGETS: WidgetDefinition[] = [
  bodyWeightWidget,
  todaysPlanWidget,
  nutritionWidget,
  logMealAction,
  addWeightAction,
  bodyWidget,
  recentActivityWidget,
];

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = Object.fromEntries(
  WIDGETS.map(widget => [widget.id, widget]),
);

export function isRegisteredWidgetId(id: string): boolean {
  return id in WIDGET_REGISTRY;
}

export const WIDGET_CATALOG = WIDGETS;

export const CATEGORY_ORDER: WidgetCategory[] = ['health', 'training', 'nutrition', 'general'];

export const CATEGORY_TITLE_KEYS: Record<WidgetCategory, TranslationKey> = {
  health: 'dashboard.editCategoryHealth',
  training: 'dashboard.editCategoryTraining',
  nutrition: 'dashboard.editCategoryNutrition',
  general: 'dashboard.editCategoryGeneral',
};

export const DEFAULT_HOME_WIDGETS = WIDGETS
  .filter(w => w.defaultOnHome)
  .map(w => ({ id: w.id, size: w.defaultSize }));
