/**
 * Home catalog. Cards live in `cards/`, short buttons in `quick-actions/`.
 * Add a file there and append it here.
 */
import {
  bodyWeightWidget,
  todaysPlanWidget,
  nutritionWidget,
  recentActivityWidget,
} from './cards';
import { logMealAction, addWeightAction } from './quick-actions';
import type { WidgetDefinition, WidgetCategory } from './types';

export type { WidgetDefinition, WidgetRenderProps, WidgetCategory, WidgetGestureMode, WidgetKind } from './types';

export const WIDGETS: WidgetDefinition[] = [
  bodyWeightWidget,
  todaysPlanWidget,
  nutritionWidget,
  logMealAction,
  addWeightAction,
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

export const CATEGORY_TITLE_KEYS: Record<WidgetCategory, string> = {
  health: 'dashboard.editCategoryHealth',
  training: 'dashboard.editCategoryTraining',
  nutrition: 'dashboard.editCategoryNutrition',
  general: 'dashboard.editCategoryGeneral',
};

export const DEFAULT_HOME_WIDGETS = WIDGETS
  .filter(w => w.defaultOnHome)
  .map(w => ({ id: w.id, size: w.defaultSize }));
