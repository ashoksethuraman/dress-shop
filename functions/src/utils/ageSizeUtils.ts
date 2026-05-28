/**
 * Utility functions for handling age size sorting
 */

import type {AgeSize} from "../types/product";

/**
 * Extracts the first number from an age size string (e.g., "9-10" -> 9)
 */
function extractStartAge(ageSize: string): number {
  const match = ageSize.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Sorts age sizes in ascending numerical order
 * Example: ["9-10", "14-15", "8-9", "11-12"] -> ["8-9", "9-10", "11-12", "14-15"]
 */
export function sortAgeSizes(ageSizes: AgeSize[]): AgeSize[] {
  return [...ageSizes].sort((a, b) => {
    const startA = extractStartAge(a);
    const startB = extractStartAge(b);
    return startA - startB;
  });
}

/**
 * Sorts age size inventory keys and returns a new object with sorted keys
 * Example: {"9-10": 3, "8-9": 5} -> {"8-9": 5, "9-10": 3}
 */
export function sortAgeSizeInventory(
  inventory: Record<AgeSize, number>
): Record<AgeSize, number> {
  const sortedKeys = sortAgeSizes(Object.keys(inventory) as AgeSize[]);
  const sortedInventory: Record<AgeSize, number> = {} as Record<AgeSize, number>;

  for (const key of sortedKeys) {
    sortedInventory[key] = inventory[key];
  }

  return sortedInventory;
}
