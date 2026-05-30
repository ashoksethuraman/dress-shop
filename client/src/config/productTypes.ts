// Centralized list of product `type` values used across the app.
// Add new types here when introducing more product classifications.
export const PRODUCT_TYPES = ['Pyjama Set', 'T-Shirts', 'Others'] as const;
export type ProductType = (typeof PRODUCT_TYPES)[number];

// Structured items for UI components that need a key + label + enabled flag
export const PRODUCT_TYPE_ITEMS = [
	{ key: 'ALL', label: 'All', enabled: true },
	{ key: 'PYJAMA', label: 'Pyjama Set', enabled: true },
	{ key: 'T-SHIRTS', label: 'T-Shirts', enabled: true },
] as const;

export type ProductTypeItem = typeof PRODUCT_TYPE_ITEMS[number];

export const CATEGORIES = [
	{ key: 'ALL', label: 'All', enabled: true },
	{ key: 'WOMEN', label: 'Women', enabled: true },
	{ key: 'MEN', label: 'Men', enabled: true },
	{ key: 'GIRLS', label: 'Girls', enabled: true },
	{ key: 'BOYS', label: 'Boys', enabled: true },
] as const;

export type CategoryItem = typeof CATEGORIES[number];
