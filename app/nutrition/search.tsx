import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Text, TextInput, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, History, PenLine, ScanBarcode, Search, WifiOff } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Icon } from '@/components/ui/Icon';
import { EmptyState } from '@/components/ui/EmptyState';
import { FoodRow } from '@/components/food/FoodRow';
import { BarcodeScanner } from '@/components/food/BarcodeScanner';
import { useFoodSearch, usePrimeProduct } from '@/hooks/useFood';
import { useApiErrorMessage } from '@/hooks/useApiErrorMessage';
import { useToday } from '@/hooks/useToday';
import {
  isMealType,
  useDayEntries,
  useFoodHistory,
  type FoodRef,
  type MealType,
} from '@/store/nutritionStore';
import { colors } from '@/theme/colors';
import { formatNumber } from '@/utils/number';
import { mealForTime } from '@/utils/portion';

type Row =
  | { type: 'header'; key: string; title: string; icon: 'history' | 'search' }
  | { type: 'food'; key: string; food: FoodRef }
  | { type: 'status'; key: string; kind: 'loading' | 'error'; message?: string };

export default function NutritionSearch() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t, i18n } = useTranslation();
  const params = useLocalSearchParams<{ meal?: string }>();
  const meal: MealType = isMealType(params.meal) ? params.meal : mealForTime();
  const mealName = t(`meals.${meal}`);

  const history = useFoodHistory();
  const [query, setQuery] = useState('');
  const [submitted, setSubmitted] = useState('');
  const [scanning, setScanning] = useState(false);
  const remote = useFoodSearch(submitted);
  const remoteError = useApiErrorMessage(remote.error);
  const primeProduct = usePrimeProduct();

  const today = useToday();
  const loggedInMeal = useDayEntries(today).filter((e) => e.meal === meal);
  const loggedKcal = loggedInMeal.reduce((a, e) => a + e.macros.kcal, 0);

  // History: this meal's foods first, then most recent. Filtered live while typing — no
  // network needed, which matters in a gym basement.
  const localMatches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(history)
      .filter((f) => !q || f.name.toLowerCase().includes(q) || f.brand?.toLowerCase().includes(q))
      .sort((a, b) => {
        const am = a.meals.includes(meal) ? 1 : 0;
        const bm = b.meals.includes(meal) ? 1 : 0;
        return am !== bm ? bm - am : b.lastUsed.localeCompare(a.lastUsed);
      })
      .slice(0, q ? 20 : 12);
  }, [history, query, meal]);

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    if (localMatches.length > 0) {
      out.push({
        type: 'header',
        key: 'h-local',
        title: query.trim() ? t('food.fromHistory') : t('food.suggestedHistory'),
        icon: 'history',
      });
      localMatches.forEach((f) => out.push({ type: 'food', key: `l-${f.code}`, food: f }));
    }
    if (submitted.trim().length >= 2 && submitted === query) {
      const seen = new Set(localMatches.map((f) => f.code));
      const results = (remote.data ?? []).filter((f) => !seen.has(f.code));
      out.push({ type: 'header', key: 'h-remote', title: t('food.databaseResults'), icon: 'search' });
      if (remote.isFetching && results.length === 0)
        out.push({ type: 'status', key: 's-loading', kind: 'loading' });
      else if (remote.isError)
        out.push({ type: 'status', key: 's-error', kind: 'error', message: remoteError ?? undefined });
      else if (results.length === 0)
        out.push({ type: 'status', key: 's-empty', kind: 'error', message: t('food.noResultsFound') });
      results.forEach((f) => out.push({ type: 'food', key: `r-${f.code}`, food: f }));
    }
    return out;
  }, [localMatches, submitted, query, remote.data, remote.isFetching, remote.isError, remoteError, t]);

  const openFood = useCallback(
    (food: FoodRef) => {
      primeProduct(food);
      router.push({ pathname: '/nutrition/product/[code]', params: { code: food.code, meal } });
    },
    [primeProduct, router, meal],
  );

  const handleScanned = (code: string) => {
    setScanning(false);
    router.push({ pathname: '/nutrition/product/[code]', params: { code, meal } });
  };

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="flex-1 px-4 pt-2">
        <View className="mb-4 flex-row items-center">
          <IconButton
            icon={ChevronLeft}
            iconSize={24}
            accessibilityLabel={t('common.back')}
            onPress={() => router.back()}
            className="mr-4"
          />
          <View className="flex-1">
            <Text accessibilityRole="header" className="text-3xl font-bold text-foreground">
              {t('food.addFood')}
            </Text>
            <Text className="text-sm font-medium text-primary-text">
              {t('food.toMeal', { meal: mealName })}
            </Text>
          </View>
        </View>

        <View className="mb-3 flex-row gap-2">
          <View className="h-12 flex-1 flex-row items-center rounded-xl border border-border bg-surface px-4">
            <Icon icon={Search} size={20} color={colors.muted} />
            <TextInput
              className="ml-3 h-full flex-1 text-base text-foreground"
              placeholder={t('food.searchMealFoods', { meal: mealName })}
              placeholderTextColor={colors.placeholder}
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={() => setSubmitted(query.trim())}
              returnKeyType="search"
              autoCorrect={false}
              accessibilityLabel={t('food.searchFood')}
              accessibilityHint={t('food.searchHint')}
            />
          </View>
          <IconButton
            icon={ScanBarcode}
            variant="outline"
            accessibilityLabel={t('food.scanBarcode')}
            onPress={() => setScanning(true)}
          />
        </View>

        <Button
          variant="ghost"
          size="sm"
          label={t('food.quickAddCta')}
          icon={<Icon icon={PenLine} size={16} color={colors['primary-text']} />}
          textClassName="text-primary-text"
          className="mb-2 self-start"
          onPress={() =>
            router.push({ pathname: '/nutrition/quick-add', params: { meal, name: query.trim() } })
          }
        />

        <FlashList
          data={rows}
          keyExtractor={(r) => r.key}
          getItemType={(r) => r.type}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={{ paddingBottom: insets.bottom + 96 }}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return (
                <View className="mb-3 ml-1 mt-2 flex-row items-center">
                  <Icon icon={item.icon === 'history' ? History : Search} size={14} color={colors.muted} />
                  <Text
                    accessibilityRole="header"
                    className="ml-2 text-xs font-medium uppercase tracking-wider text-muted"
                  >
                    {item.title}
                  </Text>
                </View>
              );
            }
            if (item.type === 'status') {
              return item.kind === 'loading' ? (
                <View className="items-center py-8">
                  <ActivityIndicator color={colors.accent} />
                </View>
              ) : (
                <View
                  className="mb-3 flex-row items-center rounded-2xl border border-border bg-surface p-4"
                  accessibilityLiveRegion="polite"
                >
                  <Icon icon={WifiOff} size={18} color={colors.subtle} />
                  <Text className="ml-3 flex-1 text-subtle">{item.message}</Text>
                  {remote.isError && (
                    <Button
                      size="sm"
                      variant="secondary"
                      label={t('common.tryAgain')}
                      onPress={() => void remote.refetch()}
                    />
                  )}
                </View>
              );
            }
            return <FoodRow food={item.food} onPress={openFood} />;
          }}
          ListEmptyComponent={
            <EmptyState
              icon={query.trim() ? Search : History}
              title={query.trim() ? t('food.pressSearch') : t('food.suggestions')}
              message={
                query.trim() ? t('food.pressSearchMessage') : t('food.suggestionsMessage', { meal: mealName })
              }
            />
          }
        />
      </View>

      {loggedInMeal.length > 0 && (
        <View
          className="absolute bottom-0 left-0 right-0 flex-row items-center justify-between border-t border-border bg-surface px-4 pt-3"
          style={{ paddingBottom: Math.max(insets.bottom, 12) }}
          accessibilityLiveRegion="polite"
        >
          <Text className="flex-1 text-sm text-muted">
            {t('food.mealSoFar', {
              meal: mealName,
              count: loggedInMeal.length,
              kcal: formatNumber(loggedKcal, i18n.language, 0),
            })}
          </Text>
          <Button label={t('common.done')} variant="white" size="sm" onPress={() => router.back()} />
        </View>
      )}

      <BarcodeScanner visible={scanning} onClose={() => setScanning(false)} onScanned={handleScanned} />
    </SafeAreaView>
  );
}
