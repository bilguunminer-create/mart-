export type InventorySuggestion = {
  matched: boolean;
  fields: { name: string; description: string; weight: string; category: string };
  sources: { title: string; url: string }[];
  searchHtml: string;
  message: string;
};

// Only fill fields that have not been edited while the request was running.
export function mergeInventorySuggestion<T extends Record<string, string>>(current: T, before: T, result: InventorySuggestion): T {
  if (!result.matched) return current;
  const next = { ...current };
  for (const key of ['name', 'description', 'weight', 'category'] as const) {
    if (current[key] === before[key] && result.fields[key]) (next as Record<string, string>)[key] = result.fields[key];
  }
  return next;
}

// Remove only the previous AI values when replacing a product photo.
export function clearInventorySuggestion<T extends Record<string, string>>(current: T, previous: InventorySuggestion | null): T {
  if (!previous?.matched) return current;
  const next = { ...current };
  for (const key of ['name', 'description', 'weight', 'category'] as const) {
    if (previous.fields[key] && current[key] === previous.fields[key]) (next as Record<string, string>)[key] = key === 'category' ? 'food' : '';
  }
  return next;
}
