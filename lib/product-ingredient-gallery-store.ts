import { readJsonKv, writeJsonKv } from "./json-kv-store";

export type IngredientImage = { name: string; imageUrl: string; scale: number; x: number; y: number };
export type IngredientGalleryStore = { products: Record<string, IngredientImage[]> };
const KEY = "maroma:product-ingredient-galleries";
const FILE = "product-ingredient-galleries.json";
const empty = (): IngredientGalleryStore => ({ products: {} });
export const readIngredientGalleryStore = () => readJsonKv<IngredientGalleryStore>(KEY, FILE, empty());
export const writeIngredientGalleryStore = (value: IngredientGalleryStore) => writeJsonKv(KEY, FILE, value);
