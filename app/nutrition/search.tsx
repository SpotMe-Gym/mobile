import { useState, useEffect, useMemo } from 'react';
import { View, Text, TextInput, FlatList, Image, ActivityIndicator, TouchableOpacity, Alert, Modal, Keyboard } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { searchFood, getFoodByBarcode, FoodProduct } from '../../services/foodService';
import { Search, Scan, X, ChevronLeft, MapPin, History, Sparkles } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useNutritionStore, HistoryItem } from '../../store/nutritionStore';

// Helper to map HistoryItem to FoodProduct shape for consistent rendering
const historyToProduct = (item: HistoryItem): FoodProduct => ({
  code: item.id,
  product_name: item.name,
  brands: item.brand || '',
  image_url: item.image_url || '',
  nutriments: {
    "energy-kcal_100g": item.calories,
    proteins_100g: item.protein,
    carbohydrates_100g: item.carbs,
    fat_100g: item.fat,
  }
});

export default function NutritionSearch() {
  const router = useRouter();
  const { meal } = useLocalSearchParams<{ meal: string }>(); // e.g. "Breakfast"
  const { knownFoods } = useNutritionStore();

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string | undefined>(undefined);

  const [permission, requestPermission] = useCameraPermissions();

  // Get Smart Suggestions (Local history)
  const suggestions = useMemo(() => {
    const allHistory = Object.values(knownFoods);
    // Sort by: 1. Matching meal context, 2. Recently used
    return allHistory.sort((a, b) => {
      const aMatch = meal && a.tags.includes(meal) ? 1 : 0;
      const bMatch = meal && b.tags.includes(meal) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return new Date(b.lastUsed).getTime() - new Date(a.lastUsed).getTime();
    }).slice(0, 10).map(historyToProduct);
  }, [knownFoods, meal]);

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;

        let location = await Location.getCurrentPositionAsync({});
        let reverseGeocoded = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude
        });

        if (reverseGeocoded.length > 0) {
          const address = reverseGeocoded[0];
          setCountryCode(address.isoCountryCode?.toLowerCase());
          setLocationName(address.city || address.region || address.country);
        }
      } catch (error) {
        console.log("Error getting location", error);
      }
    })();
  }, []);

  // Initialize results with suggestions when query is empty
  useEffect(() => {
    if (!query.trim()) {
      setResults(suggestions);
    }
  }, [query, suggestions]);

  const handleSearch = async () => {
    if (!query.trim()) {
      setResults(suggestions);
      return;
    }
    setLoading(true);
    Keyboard.dismiss();

    // 1. Local Search
    const lowerQuery = query.toLowerCase();
    const localMatches = Object.values(knownFoods)
      .filter(item => item.name.toLowerCase().includes(lowerQuery) || (item.brand && item.brand.toLowerCase().includes(lowerQuery)))
      .map(historyToProduct);

    // 2. API Search
    const apiMatches = await searchFood(query, countryCode);

    // Merge (Local first, then API, avoiding duplicates by code)
    const combined = [...localMatches];
    const seenCodes = new Set(localMatches.map(p => p.code));

    apiMatches.forEach(p => {
      if (!seenCodes.has(p.code)) {
        combined.push(p);
      }
    });

    setResults(combined);
    setLoading(false);
  };

  const handleScanToggle = async () => {
    try {
      if (!permission) return;
      if (!permission.granted) {
        const result = await requestPermission();
        if (!result.granted) {
          Alert.alert("Permission Required", "Camera access is needed to scan barcodes.");
          return;
        }
      }
      setIsScanning(true);
      setScanned(false);
    } catch (err) {
      console.error("Camera permission error:", err);
      Alert.alert("Error", "Could not request camera permissions.");
    }
  };

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    setIsScanning(false);
    setLoading(true);

    // Check local first
    if (knownFoods[data]) {
      setResults([historyToProduct(knownFoods[data])]);
      setLoading(false);
      return;
    }

    // API
    const product = await getFoodByBarcode(data);
    setLoading(false);

    if (product) {
      setResults([product]);
    } else {
      Alert.alert("Not Found", "Product not found in database.");
    }
  };

  const navigateToProduct = (item: FoodProduct) => {
    // Pass essential data via params
    router.push({
      pathname: '/nutrition/product/[code]',
      params: {
        code: item.code,
        meal: meal || 'Snack',
        initialData: JSON.stringify(item)
      }
    });
  };

  const renderItem = ({ item }: { item: FoodProduct }) => (
    <TouchableOpacity onPress={() => navigateToProduct(item)} activeOpacity={0.7} className="mb-3">
      <Card className="bg-zinc-900 border border-zinc-800 pointer-events-none">
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
            <View className="flex-row mt-2 gap-3">
              <Text className="text-zinc-300 text-xs font-medium bg-zinc-800 px-2 py-0.5 rounded mr-1">
                {Math.round(item.nutriments["energy-kcal_100g"] || 0)} kcal
              </Text>
              <Text className="text-blue-400 text-xs font-medium">P: {Math.round(item.nutriments.proteins_100g || 0)}</Text>
              <Text className="text-yellow-400 text-xs font-medium">C: {Math.round(item.nutriments.carbohydrates_100g || 0)}</Text>
              <Text className="text-red-400 text-xs font-medium">F: {Math.round(item.nutriments.fat_100g || 0)}</Text>
            </View>
          </View>
          <View className="h-8 w-8 bg-blue-600 rounded-full items-center justify-center">
            <Text className="text-white font-bold">+</Text>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <View className="p-4 flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1 bg-zinc-800 rounded-full">
              <ChevronLeft size={24} color="white" />
            </TouchableOpacity>
            <View>
              <Text className="text-3xl font-bold text-white">Add Food</Text>
              {meal && <Text className="text-blue-400 font-medium text-sm">to {meal}</Text>}
            </View>
          </View>
        </View>

        {locationName && (
          <View className="flex-row items-center mb-4 pl-1">
            <MapPin size={14} color="#a1a1aa" />
            <Text className="text-zinc-400 text-xs ml-1">Results optimized for <Text className="text-blue-400">{locationName}</Text></Text>
          </View>
        )}

        {/* Search Bar */}
        <View className="flex-row gap-2 mb-6">
          <View className="flex-1 flex-row items-center bg-zinc-900 rounded-xl px-4 border border-zinc-800 h-12">
            <Search size={20} color="#A1A1AA" />
            <TextInput
              className="flex-1 ml-3 text-white h-full"
              placeholder={meal ? `Search ${meal} foods...` : "Search food..."}
              placeholderTextColor="#52525B"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
              autoFocus={!isScanning}
            />
          </View>
          <TouchableOpacity
            className="w-12 h-12 bg-zinc-800 rounded-xl items-center justify-center border border-zinc-700"
            onPress={handleScanToggle}
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
            keyExtractor={(item) => item.code + Math.random()}
            renderItem={renderItem}
            contentContainerStyle={{ paddingBottom: 20 }}
            ListEmptyComponent={
              <View className="items-center mt-10 opacity-70">
                {!query.trim() ? (
                  <>
                    <Sparkles size={48} color="#3b82f6" style={{ marginBottom: 16, opacity: 0.5 }} />
                    <Text className="text-zinc-500 font-medium text-lg">Suggestions</Text>
                    <Text className="text-zinc-600 text-center mt-2 px-10">
                      Foods you add to {meal || 'your meals'} will appear here automatically.
                    </Text>
                  </>
                ) : (
                  <>
                    <Search size={48} color="#71717a" style={{ marginBottom: 16 }} />
                    <Text className="text-zinc-500">No results found</Text>
                  </>
                )}
              </View>
            }
            ListHeaderComponent={
              !query.trim() && results.length > 0 ? (
                <View className="flex-row items-center mb-3 ml-1">
                  <History size={14} color="#a1a1aa" />
                  <Text className="text-zinc-400 text-xs ml-2 font-medium uppercase tracking-wider">Suggested History</Text>
                </View>
              ) : null
            }
          />
        )}

        {/* Camera Modal Overlay */}
        <Modal visible={isScanning} animationType="slide" presentationStyle="fullScreen">
          <View className="flex-1 bg-black">
            <CameraView
              style={{ flex: 1 }}
              onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
              barcodeScannerSettings={{
                barcodeTypes: ["qr", "ean13", "ean8", "upc_e", "upc_a"],
              }}
            >
              <SafeAreaView className="flex-1">
                <View className="flex-row justify-between p-4">
                  <View></View>
                  <TouchableOpacity
                    onPress={() => setIsScanning(false)}
                    className="h-10 w-10 bg-black/50 rounded-full items-center justify-center"
                  >
                    <X size={24} color="white" />
                  </TouchableOpacity>
                </View>
                <View className="flex-1 justify-center items-center">
                  <View className="w-64 h-64 border-2 border-white/50 rounded-xl bg-transparent" />
                  <Text className="text-white mt-4 font-bold bg-black/50 px-3 py-1 rounded">Scan a barcode</Text>
                </View>
              </SafeAreaView>
            </CameraView>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}
