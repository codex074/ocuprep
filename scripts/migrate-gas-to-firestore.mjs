import { migrateCollections } from './lib/firestore-migration.mjs';

const requested = process.argv.slice(2);
const collections = requested.length > 0 ? requested : ['users', 'formulas', 'preps'];

try {
  const summary = await migrateCollections(collections);
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
} catch (error) {
  console.error(error);
  process.exit(1);
}
