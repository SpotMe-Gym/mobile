import type { ComponentType } from 'react';
import type { TranslationKey } from '../../i18n/keys';
import type { ExpandableRoute } from '../../hooks/useExpandableNavigation';
import type { WidgetSize } from './widgetSizes';

export type WidgetKind = 'card' | 'action';
export type WidgetCategory = 'health' | 'training' | 'nutrition' | 'general';
export type WidgetGestureMode = 'wrapper' | 'inner';

export interface WidgetRenderProps {
  size: WidgetSize;
  width: number;
  height: number;
  isEditing: boolean;
  onEnterEdit: () => void;
  onOpenDetail: () => void;
  onPressIn: () => void;
  onPressOut: () => void;
}

export interface WidgetDefinition {
  id: string;
  kind: WidgetKind;
  category: WidgetCategory;
  sizes: WidgetSize[];
  defaultSize: WidgetSize;
  unique: boolean;
  defaultOnHome?: boolean;
  titleKey: TranslationKey;
  detailPath?: ExpandableRoute;
  gestureMode: WidgetGestureMode;
  Render: ComponentType<WidgetRenderProps>;
}
