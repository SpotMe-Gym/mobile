import type { ComponentType } from 'react';
import type { Href } from 'expo-router';
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
  titleKey: string;
  detailPath?: Href;
  gestureMode: WidgetGestureMode;
  Render: ComponentType<WidgetRenderProps>;
}
