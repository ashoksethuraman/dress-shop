/**
 * Migration script to fix age size sorting in existing products
 * Run with: npx ts-node scripts/fixAgeSizeSorting.ts
 */

import * as admin from 'firebase-admin';
import * as serviceAccount from '../service-account-key.json';

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
});

const db = admin.firestore();

/**
 * Extracts the first number from an age size string (e.g., "9-10" -> 9)
 */
function extractStartAge(ageSize: string): number {
  const match = ageSize.match(/^(\d+)/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Sorts age sizes in ascending numerical order
 */
function sortAgeSizes(ageSizes: string[]): string[] {
  return [...ageSizes].sort((a, b) => {
    const startA = extractStartAge(a);
    const startB = extractStartAge(b);
    return startA - startB;
  });
}

/**
 * Sorts age size inventory keys and returns a new object with sorted keys
 */
function sortAgeSizeInventory(inventory: Record<string, number>): Record<string, number> {
  const sortedKeys = sortAgeSizes(Object.keys(inventory));
  const sortedInventory: Record<string, number> = {};
  
  for (const key of sortedKeys) {
    sortedInventory[key] = inventory[key];
  }
  
  return sortedInventory;
}

interface ProductData {
  title?: string;
  category?: string;
  ageSizes?: string[];
  ageSizeInventory?: Record<string, number>;
}

async function fixAgeSizeSorting(): Promise<void> {
  console.log('🔍 Searching for boys/girls products with unsorted age sizes...\n');

  try {
    const productsSnapshot = await db.collection('products')
      .where('category', 'in', ['boys', 'girls'])
      .get();

    if (productsSnapshot.empty) {
      console.log('✅ No boys/girls products found.');
      return;
    }

    console.log(`📦 Found ${productsSnapshot.size} boys/girls products.\n`);

    let fixedCount = 0;
    const batch = db.batch();

    for (const doc of productsSnapshot.docs) {
      const data = doc.data() as ProductData;
      const productId = doc.id;
      const title = data.title || 'Unknown';
      const category = data.category || 'unknown';
      
      let needsUpdate = false;
      const updates: Partial<ProductData> = {};

      // Check if ageSizes needs sorting
      if (data.ageSizes && Array.isArray(data.ageSizes) && data.ageSizes.length > 0) {
        const sorted = sortAgeSizes(data.ageSizes);
        const needsSorting = JSON.stringify(data.ageSizes) !== JSON.stringify(sorted);
        
        if (needsSorting) {
          console.log(`📝 Product: "${title}" (${category})`);
          console.log(`   Before: [${data.ageSizes.join(', ')}]`);
          console.log(`   After:  [${sorted.join(', ')}]`);
          updates.ageSizes = sorted;
          needsUpdate = true;
        }
      }

      // Check if ageSizeInventory needs sorting
      if (data.ageSizeInventory && typeof data.ageSizeInventory === 'object') {
        const keys = Object.keys(data.ageSizeInventory);
        if (keys.length > 0) {
          const sortedInventory = sortAgeSizeInventory(data.ageSizeInventory);
          const needsSorting = JSON.stringify(data.ageSizeInventory) !== JSON.stringify(sortedInventory);
          
          if (needsSorting) {
            if (!needsUpdate) {
              console.log(`📝 Product: "${title}" (${category})`);
            }
            console.log(`   Inventory sorted: ${keys.join(', ')} -> ${Object.keys(sortedInventory).join(', ')}`);
            updates.ageSizeInventory = sortedInventory;
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        batch.update(doc.ref, updates);
        fixedCount++;
        console.log('   ✅ Queued for update\n');
      }
    }

    if (fixedCount > 0) {
      console.log(`💾 Committing ${fixedCount} updates to Firestore...`);
      await batch.commit();
      console.log(`✅ Successfully fixed ${fixedCount} product(s)!\n`);
    } else {
      console.log('✅ All products already have correctly sorted age sizes.\n');
    }

  } catch (error) {
    console.error('❌ Error fixing age size sorting:', error);
    process.exit(1);
  }

  process.exit(0);
}

// Run the migration
fixAgeSizeSorting();