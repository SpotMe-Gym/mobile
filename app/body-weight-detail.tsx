import { View, Text, ScrollView, Pressable, Alert, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useState } from 'react';
import Animated, { useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { ScreenHeader } from '../components/ScreenHeader';
import { Card } from '../components/ui/Card';
import { ExpandableCardLayoutWithContext, useExpandableCardContext } from '../components/ExpandableCardLayout';
import { useTranslation } from 'react-i18next';
import { useUserStore } from '../store/userStore';
import { WeightChart } from '../components/body-weight/WeightChart';
import { AddWeightModal } from '../components/body-weight/AddWeightModal';
import { TrendingUp, TrendingDown, Minus, Plus, Trash2, Sparkles } from 'lucide-react-native';
import { useUnitConverter } from '../hooks/useUnitConverter';
import { useRouter } from 'expo-router';

// Preview content - matches the home card appearance including the Gauge Fix
function WeightCardPreview() {
  const { weightHistory } = useUserStore();
  const { cardDimensions } = useExpandableCardContext();
  const { currentWeight, convertWeight } = useUnitConverter();
  const { t } = useTranslation();

  return (
    <View className="flex-1 w-full items-center justify-center">
      <View style={{ width: cardDimensions.cardWidth, height: cardDimensions.cardHeight }}>
        <Card className="h-full bg-transparent border-none" title={t('dashboard.bodyWeight')}>
          <View className="flex-row items-baseline mt-2">
            <Text className="text-5xl font-bold text-white">{currentWeight.formatted}</Text>
            <Text className="text-zinc-500 text-xl ml-2">{currentWeight.unit}</Text>
          </View>
          <View className="flex-row items-center mt-4">
            {(() => {
              const history = weightHistory || [];
              const latestVal = currentWeight.value;
              const prevEntry = history.length > 1 ? history[history.length - 2] : null;
              const prevVal = prevEntry ? convertWeight(prevEntry.weight).value : latestVal;

              const diff = latestVal - prevVal;
              const isGain = diff > 0;

              if (history.length < 2 || diff === 0) {
                return (
                  <>
                    <Minus size={16} color="#71717a" />
                    <Text className="text-zinc-500 ml-1 text-sm font-medium">{t('dashboard.noChange')}</Text>
                  </>
                );
              }

              return (
                <>
                  {isGain ? <TrendingUp size={16} color="#ef4444" /> : <TrendingDown size={16} color="#22c55e" />}
                  <Text className={`${isGain ? 'text-red-500' : 'text-green-500'} ml-1 text-sm font-medium`}>
                    {diff > 0 ? '+' : ''}{diff.toFixed(1)} {currentWeight.unit} {t('dashboard.sinceLast')}
                  </Text>
                </>
              );
            })()}
          </View>
        </Card>
      </View>
    </View>
  );
}

// Detail content
function WeightDetailContent() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { handleClose } = useExpandableCardContext();
  const { weightHistory, addWeightEntry, removeWeightEntry } = useUserStore();
  const { currentWeight, convertWeight, toStorageWeight } = useUnitConverter();
  const [modalVisible, setModalVisible] = useState(false);
  const { t } = useTranslation();

  // Calculate trends
  const history = weightHistory || [];
  const latestVal = currentWeight.value;
  const prevEntry = history.length > 1 ? history[history.length - 2] : null;
  const prevVal = prevEntry ? convertWeight(prevEntry.weight).value : latestVal;

  const diff = latestVal - prevVal;
  const isGain = diff > 0;

  const chartData = history.map(h => ({
    ...h,
    weight: convertWeight(h.weight).value
  }));

  const handleDelete = (id?: string) => {
    if (!id) return;
    Alert.alert(
      "Delete Entry",
      "Are you sure you want to delete this weight entry?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Delete", style: "destructive", onPress: () => removeWeightEntry(id) }
      ]
    );
  };

  return (
    <View className="flex-1">
      {/* Drag handle */}
      <View className="items-center pt-2 pb-1">
        <View className="w-10 h-1 bg-zinc-600 rounded-full" />
      </View>

      <View className="px-4 flex-row justify-between items-center">
        <ScreenHeader
          title="Body Weight"
          onBack={handleClose}
          rightAction={
            <TouchableOpacity onPress={() => router.push('/chat')} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Sparkles size={24} color="#3b82f6" />
            </TouchableOpacity>
          }
        />
        {/* Add Entry Button */}
        <Pressable
          className="h-10 w-10 bg-blue-600 rounded-full items-center justify-center -mb-2"
          onPress={() => setModalVisible(true)}
        >
          <Plus size={24} color="white" />
        </Pressable>
      </View>

      <ScrollView
        className="flex-1 px-4"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
      >
        {/* Current Stat Header */}
        <View className="items-center py-6">
          <View className="flex-row items-baseline">
            <Text className="text-6xl text-white font-bold tracking-tighter">{currentWeight.formatted}</Text>
            <Text className="text-zinc-500 font-medium text-2xl ml-2">{currentWeight.unit}</Text>
          </View>

          {/* Trend Indicator */}
          {diff !== 0 && (
            <View className={`flex-row items-center mt-2 px-3 py-1 rounded-full ${isGain ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
              {isGain ? <TrendingUp size={16} color="#ef4444" /> : <TrendingDown size={16} color="#22c55e" />}
              <Text className={`ml-2 font-bold ${isGain ? 'text-red-400' : 'text-green-400'}`}>
                {Math.abs(diff).toFixed(1)} {currentWeight.unit} {t('dashboard.sinceLast')}
              </Text>
            </View>
          )}
          {diff === 0 && (
            <Text className="text-zinc-500 mt-2">{t('dashboard.noChange')}</Text>
          )}
        </View>

        {/* Chart */}
        <View className="mb-6">
          <Text className="text-white text-lg font-bold mb-3">Trend</Text>
          <WeightChart data={chartData} />
        </View>

        {/* History List */}
        <View>
          <Text className="text-white text-lg font-bold mb-3">History</Text>
          <View className="bg-zinc-900 rounded-3xl overflow-hidden border border-zinc-800">
            {history.slice().reverse().map((entry, i) => {
              const dw = convertWeight(entry.weight);
              return (
                <View
                  key={entry.id || `${entry.date}-${i}`}
                  className={`flex-row items-center justify-between p-4 ${i !== history.length - 1 ? 'border-b border-zinc-800' : ''}`}
                >
                  <View>
                    <Text className="text-zinc-400">{new Date(entry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                  <View className="flex-row items-center gap-4">
                    <Text className="text-white font-bold text-lg">{dw.formatted} <Text className="text-xs font-normal text-zinc-600">{dw.unit}</Text></Text>
                    {entry.id && (
                      <Pressable onPress={() => handleDelete(entry.id)} hitSlop={10}>
                        <Trash2 size={18} color="#ef4444" />
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
            {history.length === 0 && (
              <View className="p-6 items-center">
                <Text className="text-zinc-600">No history yet</Text>
              </View>
            )}
          </View>
        </View>

      </ScrollView>

      <AddWeightModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        onSave={(w, d) => addWeightEntry(toStorageWeight(w), d)}
        currentWeight={currentWeight.formatted}
      />
    </View>
  );
}

export default function WeightDetail() {
  return (
    <ExpandableCardLayoutWithContext
      previewContent={<WeightCardPreview />}
      backgroundColor="#18181b"
    >
      <WeightDetailContent />
    </ExpandableCardLayoutWithContext>
  );
}