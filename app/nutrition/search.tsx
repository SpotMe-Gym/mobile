import { useState, useEffect } from 'react';
import { View, Text, TextInput, FlatList, Image, ActivityIndicator, TouchableOpacity, Alert, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import { searchFood, getFoodByBarcode, FoodProduct } from '../../services/foodService';
import { Search, Scan, X, ChevronLeft, MapPin } from 'lucide-react-native';
import { Card } from '../../components/ui/Card';
import { useRouter } from 'expo-router';

export default function NutritionSearch() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FoodProduct[]>([]);
  const [loading, setLoading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [locationName, setLocationName] = useState<string | null>(null);
  const [countryCode, setCountryCode] = useState<string | undefined>(undefined);

  const [permission, requestPermission] = useCameraPermissions();

  useEffect(() => {
    (async () => {
      try {
        let { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          console.log('Permission to access location was denied');
          return;
        }

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

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    const products = await searchFood(query, countryCode);
    setResults(products);
    setLoading(false);
  };

  const handleScanToggle = async () => {
    try {
      if (!permission) {
        // Permission not loaded yet
        return;
      }
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

    // Search the barcode
    const product = await getFoodByBarcode(data);
    setLoading(false);

    if (product) {
      setResults([product]);
    } else {
      Alert.alert("Not Found", "Product not found in database.");
    }
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
        {/* Header */}
        <View className="flex-row items-center justify-between mb-6">
          <View className="flex-row items-center">
            <TouchableOpacity onPress={() => router.back()} className="mr-4 p-1 bg-zinc-800 rounded-full">
              <ChevronLeft size={24} color="white" />
            </TouchableOpacity>
            <Text className="text-3xl font-bold text-white">Add Food</Text>
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
              placeholder="Search food..."
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
              <View className="items-center mt-10">
                <Text className="text-zinc-600">Search for products or scan a barcode</Text>
              </View>
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
