// Built-in fallback photos for each category tile, used until an admin uploads
// their own via the Ангилалын зургууд settings panel. Overrides are stored
// centrally in store_settings.data.category_images (not localStorage), so
// every visitor and every admin session sees the same images.
export const DEFAULT_CATEGORY_IMAGES: Record<string, string[]> = {
  food: ['/categories/food.jpg'],
  drinks: ['/categories/drinks.jpg'],
  vitamins: [
    '/categories/vitamins-1.jpg',
    '/categories/vitamins-2.jpg',
    '/categories/vitamins-3.jpg',
    '/categories/vitamins-4.jpg'
  ],
  baby: ['/categories/baby.jpg'],
  household: ['/categories/household.jpg'],
  snacks: ['/categories/snacks.jpg'],
  beauty: ['/categories/beauty.jpg']
};
