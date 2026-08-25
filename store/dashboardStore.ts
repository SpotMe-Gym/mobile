import { create } from 'zustand';
import { persist, createJSONStorage, StateStorage } from 'zustand/middleware';
import { createMMKV } from 'react-native-mmkv';
import type { WidgetSize } from '../components/dashboard/widgetSizes';
import { DEFAULT_HOME_WIDGETS, isRegisteredWidgetId } from '../components/dashboard/catalog';

export type WidgetId = string;

export interface DashboardWidget {
  id: WidgetId;
  size: WidgetSize;
}

export const DEFAULT_WIDGETS: DashboardWidget[] = DEFAULT_HOME_WIDGETS;

const dashboardStorage = createMMKV({ id: 'dashboard-storage' });

const mmkvStorage: StateStorage = {
  setItem: (name, value) => {
    dashboardStorage.set(name, value);
  },
  getItem: (name) => {
    const value = dashboardStorage.getString(name);
    return value ?? null;
  },
  removeItem: (name) => {
    dashboardStorage.remove(name);
  },
};

interface DashboardState {
  widgets: DashboardWidget[];
  setWidgetSize: (id: WidgetId, size: WidgetSize) => void;
  removeWidget: (id: WidgetId) => void;
  addWidget: (id: WidgetId, size: WidgetSize) => void;
  reorderWidgets: (fromId: WidgetId, toId: WidgetId) => void;
}

function isWidgetSize(value: unknown): value is WidgetSize {
  return value === 'full' || value === 'half' || value === 'compact';
}

function sanitizeWidgets(widgets: unknown): DashboardWidget[] {
  if (!Array.isArray(widgets)) return DEFAULT_WIDGETS;
  const cleaned = widgets.filter(
    (w): w is DashboardWidget =>
      !!w && typeof w.id === 'string' && isRegisteredWidgetId(w.id) && isWidgetSize(w.size),
  );
  return cleaned.length > 0 ? cleaned : DEFAULT_WIDGETS;
}

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      widgets: DEFAULT_WIDGETS,

      setWidgetSize: (id, size) =>
        set(state => ({
          widgets: state.widgets.map(w => (w.id === id ? { ...w, size } : w)),
        })),

      removeWidget: (id) =>
        set(state => ({
          widgets: state.widgets.filter(w => w.id !== id),
        })),

      addWidget: (id, size) => {
        if (get().widgets.some(w => w.id === id)) return;
        if (!isRegisteredWidgetId(id)) return;
        set(state => ({
          widgets: [...state.widgets, { id, size }],
        }));
      },

      reorderWidgets: (fromId, toId) => {
        if (fromId === toId) return;
        set(state => {
          const widgets = [...state.widgets];
          const from = widgets.findIndex(w => w.id === fromId);
          const to = widgets.findIndex(w => w.id === toId);
          if (from < 0 || to < 0) return state;
          const [item] = widgets.splice(from, 1);
          widgets.splice(to, 0, item);
          return { widgets };
        });
      },
    }),
    {
      name: 'dashboard-storage',
      storage: createJSONStorage(() => mmkvStorage),
      version: 3,
      migrate: (persistedState: unknown, version: number) => {
        const state = (persistedState ?? {}) as { widgets?: unknown };
        let raw: unknown[] = Array.isArray(state.widgets) ? state.widgets : [];

        // Split before sanitize — `quickActions` is no longer a registered id.
        if (version < 3) {
          const next: unknown[] = [];
          for (const widget of raw) {
            if (widget && typeof widget === 'object' && 'id' in widget && (widget as { id: string }).id === 'quickActions') {
              const size = (widget as { size?: WidgetSize }).size;
              const actionSize = size === 'full' ? 'half' : size ?? 'half';
              next.push({ id: 'logMeal', size: actionSize });
              next.push({ id: 'addWeight', size: actionSize });
            } else {
              next.push(widget);
            }
          }
          raw = next;
        }

        let widgets = sanitizeWidgets(raw);

        if (version < 2) {
          for (const extra of DEFAULT_WIDGETS) {
            if (!widgets.some(w => w.id === extra.id)) {
              widgets = [...widgets, extra];
            }
          }
        }

        return { widgets };
      },
    }
  )
);
