import { View, Text, ScrollView, Dimensions, TouchableOpacity, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Card } from '../ui/Card';
import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { CalorieGauge } from './CalorieGauge';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 32; // Full width inside the px-4 parent

interface MacroCarouselProps {
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  targets?: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
  micros?: { [key: string]: number }; // Placeholder for now
  showGauge?: boolean; // Whether to show the gauge (false when shown separately)
}

export function MacroCarousel({
  totals,
  targets = { calories: 2800, protein: 180, carbs: 300, fat: 80 },
  showGauge = true
}: MacroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  const handleScroll = (event: any) => {
    const slideSize = event.nativeEvent.layoutMeasurement.width;
    const index = event.nativeEvent.contentOffset.x / slideSize;
    const roundIndex = Math.round(index);
    if (roundIndex !== activeIndex) {
      setActiveIndex(roundIndex);
    }
  };

  const toggleExpand = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded(!expanded);
  };

  const microsData = [
    { label: "Vitamin C", val: "45%" },
    { label: "Iron", val: "20%" },
    { label: "Calcium", val: "15%" },
    { label: "Sodium", val: "1200mg" },
    { label: "Potassium", val: "3500mg" },
    { label: "Vitamin A", val: "60%" },
    { label: "Vitamin D", val: "30%" },
    { label: "Magnesium", val: "40%" },
    { label: "Zinc", val: "10%" },
  ];

  const displayedMicros = expanded ? microsData : microsData.slice(0, 4);

  // Calculate percentages
  const pPct = Math.min((totals.protein / targets.protein) * 100, 100);
  const cPct = Math.min((totals.carbs / targets.carbs) * 100, 100);
  const fPct = Math.min((totals.fat / targets.fat) * 100, 100);

  return (
    <View className="mb-6">
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {/* Slide 1: Macros */}
        <View style={{ width: CARD_WIDTH }}>
          <Card className={`bg-zinc-900 border border-zinc-800 p-4 ${showGauge ? 'h-auto' : 'h-auto'} justify-between mr-1`}>
            <View>
              <Text className="text-white text-xl font-bold mb-2">Daily Summary</Text>

              {/* Segmented Semicircle Chart with target markers */}
              {showGauge && (
                <CalorieGauge
                  totals={totals}
                  targets={targets}
                  size="large"
                />
              )}

              {/* Macros Row */}
              <View className={`flex-row gap-2 ${showGauge ? 'mt-4 mb-2' : 'mt-2 mb-2'}`}>
                {/* Protein */}
                <View className="flex-1 bg-blue-900/20 p-2 rounded-xl items-center border border-blue-900/30">
                  <Text className="text-blue-400 font-bold text-lg">{Math.round(totals.protein)}g</Text>
                  <Text className="text-blue-200/50 text-[10px] font-medium uppercase">Protein</Text>
                  <View className="w-full h-1 bg-blue-900/30 rounded-full mt-1.5 overflow-hidden">
                    <View className="h-full bg-blue-500 rounded-full" style={{ width: `${pPct}%` }} />
                  </View>
                </View>

                {/* Carbs */}
                <View className="flex-1 bg-orange-900/20 p-2 rounded-xl items-center border border-orange-900/30">
                  <Text className="text-orange-400 font-bold text-lg">{Math.round(totals.carbs)}g</Text>
                  <Text className="text-orange-200/50 text-[10px] font-medium uppercase">Carbs</Text>
                  <View className="w-full h-1 bg-orange-900/30 rounded-full mt-1.5 overflow-hidden">
                    <View className="h-full bg-orange-500 rounded-full" style={{ width: `${cPct}%` }} />
                  </View>
                </View>

                {/* Fat */}
                <View className="flex-1 bg-yellow-900/20 p-2 rounded-xl items-center border border-yellow-900/30">
                  <Text className="text-yellow-400 font-bold text-lg">{Math.round(totals.fat)}g</Text>
                  <Text className="text-yellow-200/50 text-[10px] font-medium uppercase">Fat</Text>
                  <View className="w-full h-1 bg-yellow-900/30 rounded-full mt-1.5 overflow-hidden">
                    <View className="h-full bg-yellow-500 rounded-full" style={{ width: `${fPct}%` }} />
                  </View>
                </View>
              </View>
            </View>
          </Card>
        </View>

        {/* Slide 2: Micros */}
        <View style={{ width: CARD_WIDTH }}>
          <Card className={`bg-zinc-900 border border-zinc-800 p-5 ${expanded ? 'min-h-80' : 'h-80'}`}>
            <View className="flex-row justify-between items-center mb-4">
              <Text className="text-white text-lg font-bold">Micronutrients</Text>
              <TouchableOpacity onPress={toggleExpand} className="p-2 bg-zinc-800 rounded-full h-8 w-8 items-center justify-center">
                <View pointerEvents="none">
                  {expanded ? <ChevronUp size={18} color="white" /> : <ChevronDown size={18} color="white" />}
                </View>
              </TouchableOpacity>
            </View>

            <View className="flex-wrap flex-row gap-2">
              {displayedMicros.map((m, i) => (
                <View key={i} className="bg-zinc-800/50 border border-zinc-700/50 px-3 py-2 rounded-xl mb-1 flex-row items-center gap-2">
                  <Text className="text-zinc-400 text-xs font-medium">{m.label}</Text>
                  <Text className="text-white font-bold text-sm">{m.val}</Text>
                </View>
              ))}
            </View>

            {!expanded && (
              <Text className="text-zinc-600 text-xs mt-auto opacity-50 text-center py-2">Tap arrow to view all</Text>
            )}
          </Card>
        </View>
      </ScrollView>

      {/* Indicators */}
      <View className="flex-row justify-center mt-2 gap-2">
        {[0, 1].map(i => (
          <View
            key={i}
            className={`h-1.5 rounded-full ${i === activeIndex ? 'w-6 bg-white' : 'w-1.5 bg-zinc-700'}`}
          />
        ))}
      </View>
    </View>
  );
}
