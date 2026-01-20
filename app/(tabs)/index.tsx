import { View, Text, ScrollView, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { TrendingUp, Flame, Play, Plus } from 'lucide-react-native';
import { Link, useRouter } from 'expo-router';

const { width } = Dimensions.get('window');

import { useUserStore } from '@/store/userStore';
import { useNutritionStore } from '@/store/nutritionStore';
import { TouchableOpacity } from 'react-native';

import { useTranslation } from 'react-i18next';

export default function Dashboard() {
  const router = useRouter();
  const { name, weight } = useUserStore();
  const { getDailyTotals } = useNutritionStore();
  const { t } = useTranslation();

  const today = new Date().toISOString().split('T')[0];
  const nutrition = getDailyTotals(today);

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <ScrollView className="flex-1 px-4 pt-2" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="mb-6 flex-row justify-between items-center">
          <View>
            <Text className="text-textSecondary text-sm font-medium">{t('common.monday')}, {t('common.jan')} 19</Text>
            <Text className="text-white text-3xl font-bold">{t('common.hello')}, {name || 'User'}</Text>
          </View>
          <View className="h-10 w-10 bg-zinc-800 rounded-full items-center justify-center border border-zinc-700">
            <Text className="text-white font-bold">{name ? name[0].toUpperCase() : 'U'}</Text>
          </View>
        </View>

        {/* Bento Grid */}
        <View className="flex-row flex-wrap justify-between gap-y-4">

          {/* Main Stats Card (Full Width) */}
          <Card className="w-full bg-zinc-900 border border-zinc-800" title={t('dashboard.bodyWeight')}>
            <View className="flex-row items-baseline mt-2">
              <Text className="text-5xl font-bold text-white">{weight || '--'}</Text>
              <Text className="text-zinc-500 text-xl ml-2">{t('dashboard.kg')}</Text>
            </View>
            <View className="flex-row items-center mt-4">
              <TrendingUp size={16} color="#22c55e" />
              <Text className="text-green-500 ml-1 text-sm font-medium">-0.4 {t('dashboard.kg')} {t('dashboard.thisWeek')}</Text>
            </View>
          </Card>

          {/* Active Workout (Half Width) */}
          <Card
            className="w-[48%] h-44 justify-between bg-blue-600 border-none"
            title={t('dashboard.todaysPlan')}
          >
            <View>
              <Text className="text-white/80 font-medium">Push Day A</Text>
              <Text className="text-white/60 text-xs mt-1">45 min • 6 Exercises</Text>
            </View>
            <Button
              label={t('dashboard.start')}
              variant="ghost"
              className="bg-white/20 mt-2"
              onPress={() => router.push('/workouts')}
            />
            <View className="absolute right-2 bottom-2 opacity-20">
              <Play size={64} color="white" />
            </View>
          </Card>

          {/* Calories (Half Width) */}
          <TouchableOpacity
            className="w-[48%] h-44"
            onPress={() => router.push('/nutrition-modal')}
          >
            <Card className="h-full justify-between" title={t('dashboard.nutrition')}>
              <View className="items-center justify-center flex-1">
                <Flame size={32} color="#f97316" />
                {/* We need to fetch this from the store inside the component, let's update the component body first */}
                <Text className="text-white font-bold text-2xl mt-2">{nutrition.calories}</Text>
                <Text className="text-zinc-500 text-xs">/ 2,800 kcal</Text>
              </View>
            </Card>
          </TouchableOpacity>

          {/* Quick Actions (Full Width or Row) */}
          <View className="w-full flex-row gap-3">
            <Button
              label={t('dashboard.logMeal')}
              className="flex-1 bg-zinc-800"
              variant="secondary"
              onPress={() => router.push('/nutrition')}
            />
            <Button
              label={t('dashboard.addWeight')}
              className="flex-1 bg-zinc-800"
              variant="secondary"
            />
          </View>

          {/* Recent Activity */}
          <Card className="w-full mt-2" title={t('dashboard.recentActivity')}>
            {/* Mock Items */}
            {[1, 2, 3].map((_, i) => (
              <View key={i} className="flex-row justify-between items-center py-3 border-b border-zinc-800 last:border-0">
                <View className="flex-row items-center">
                  <View className="h-8 w-8 rounded-full bg-zinc-800 items-center justify-center mr-3">
                    <Play size={14} color="white" />
                  </View>
                  <View>
                    <Text className="text-white font-medium">Pull Day</Text>
                    <Text className="text-zinc-500 text-xs">Yesterday</Text>
                  </View>
                </View>
                <Text className="text-zinc-400 text-sm">{t('dashboard.completed')}</Text>
              </View>
            ))}
          </Card>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
