import { getLocales } from 'expo-localization';

export interface FoodProduct {
  code: string;
  product_name: string;
  brands: string;
  image_url: string;
  nutriments: {
    "energy-kcal_100g": number;
    proteins_100g: number;
    carbohydrates_100g: number;
    fat_100g: number;
  };
  serving_size?: string;
  serving_quantity?: number;
}

const getDeviceCountryCode = () => {
  const locales = getLocales();
  if (locales && locales.length > 0 && locales[0].regionCode) {
    return locales[0].regionCode.toLowerCase();
  }
  return 'world';
};

const defaultCountryCode = getDeviceCountryCode();
const API_URL = `https://world.openfoodfacts.org/cgi/search.pl`;
const SEARCH_FIELDS = 'code,product_name,brands,image_url,nutriments,serving_size,serving_quantity';

export const searchFood = async (query: string, countryCode?: string): Promise<FoodProduct[]> => {
  try {
    const cc = countryCode || defaultCountryCode;
    // API Call for standard search with country code filter
    const searchUrl = `${API_URL}?search_terms=${query}&search_simple=1&action=process&json=1&fields=${SEARCH_FIELDS}&cc=${cc}`;
    const response = await fetch(searchUrl);
    const data = await response.json();

    if (!data.products) return [];

    return data.products.map((p: any) => ({
      code: p.code,
      product_name: p.product_name || 'Unknown Product',
      brands: p.brands || '',
      image_url: p.image_url,
      nutriments: p.nutriments || {},
      serving_size: p.serving_size,
      serving_quantity: p.serving_quantity
    }));
  } catch (error) {
    console.error("Search error", error?.toString());
    return [];
  }
};

export const getFoodByBarcode = async (barcode: string): Promise<FoodProduct | null> => {
  try {
    // Barcode lookup is global, but we can stick to world API
    const response = await fetch(`https://world.openfoodfacts.org/api/v0/product/${barcode}.json?fields=${SEARCH_FIELDS}`);
    const data = await response.json();

    if (!data.product) return null;

    const p = data.product;
    return {
      code: p.code,
      product_name: p.product_name || 'Unknown Product',
      brands: p.brands || '',
      image_url: p.image_url,
      nutriments: p.nutriments || {},
      serving_size: p.serving_size,
      serving_quantity: p.serving_quantity
    };
  } catch (error) {
    console.error("Barcode error", error);
    return null;
  }
}
