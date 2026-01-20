export interface FoodProduct {
  code: string;
  product_name: string;
  brands?: string;
  image_url?: string;
  nutriments: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
  };
}

const API_URL = "https://world.openfoodfacts.org/cgi/search.pl";

export const searchFood = async (query: string): Promise<FoodProduct[]> => {
  try {
    const response = await fetch(
      `${API_URL}?search_terms=${encodeURIComponent(query)}&search_simple=1&action=process&json=1&page_size=20`
    );
    const data = await response.json();
    return data.products || [];
  } catch (error) {
    console.error("Error searching food:", error);
    return [];
  }
};
