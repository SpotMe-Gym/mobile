import { useState } from 'react';
import { View, Text, TextInput, FlatList, Image, ActivityIndicator, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { searchFood, FoodProduct } from '../../services/foodService';
import { Search, Scan } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';

export default function Nutrition() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const products = await searchFood(query);
    setResults(products);
    setLoading(false);
  };

  const handleScan = () => {
    alert("QR Scanner Mock: Functionality to be implemented with expo-camera.");
  };

  const renderItem = ({ item }: { item: FoodProduct }) => (
    <Card className="mb-3 bg-zinc-900 border border-zinc-800">
      <View className="flex-row items-center">
        {item.image_url ? (
          <Image
            source={{ uri: item.image_url }}
            className="w-16 h-16 rounded-lg bg-zinc-800"
            resizeMode="cover"
          />
        ) : (
          <View className="w-16 h-16 rounded-lg bg-zinc-800 items-center justify-center">
            <Text className="text-zinc-600 text-xs">No Img</Text>
          </View>
        )}
        <View className="flex-1 ml-4">
          <Text className="text-white font-bold text-base" numberOfLines={1}>{item.product_name}</Text>
          <Text className="text-zinc-400 text-sm">{item.brands}</Text>
          <View className="flex-row mt-1 gap-3">
            <Text className="text-orange-400 text-xs font-medium">{Math.round(item.nutriments["energy-kcal_100g"] || 0)} kcal</Text>
            <Text className="text-blue-400 text-xs font-medium">P: {Math.round(item.nutriments.proteins_100g || 0)}g</Text>
          </View>
        </View>
        <TouchableOpacity className="p-2 bg-blue-600 rounded-full">
          <Text className="text-white text-xs font-bold">+</Text>
        </TouchableOpacity>
      </View>
    </Card>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="p-4 flex-1">
        <Text className="text-3xl font-bold text-white mb-6">Nutrition</Text>

        {/* Search Bar */}
        <View className="flex-row gap-2 mb-6">
          <View className="flex-1 flex-row items-center bg-zinc-900 rounded-xl px-4 border border-zinc-800 h-12">
            <Search size={20} color="#A1A1AA" />
            <TextInput
              className="flex-1 ml-3 text-white h-full"
              placeholder="Search food (e.g. Chicken)..."
              placeholderTextColor="#52525B"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
          <TouchableOpacity
            className="w-12 h-12 bg-zinc-800 rounded-xl items-center justify-center border border-zinc-700"
            onPress={handleScan}
          >
            <Scan size={20} color="white" />
          </TouchableOpacity>
        </View>

        {/* Results */}
        {loading ? (
          <ActivityIndicator color="#3b82f6" size="large" className="mt-10" />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(item) => item.code + Math.random()} // fallback key
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View className="items-center mt-10">
                <Text className="text-zinc-600">Search for products or scan a barcode</Text>
              </View>
            }
          />
        )}
      </View>
    </SafeAreaView>
  );
}
