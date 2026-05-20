import { Injectable } from '@angular/core';
import { Pokemon } from '../state/pokemon.store';

const DB_NAME = 'pokedex-trainer-dashboard';
const DB_VERSION = 1;
const STORE_POKEMON = 'pokemon';
const STORE_META = 'meta';

/** Bonus 6: IndexedDB cache for offline Pokédex reads. */
@Injectable({ providedIn: 'root' })
export class PokemonCacheService {
  private dbPromise: Promise<IDBDatabase> | null = null;

  /**
   * Opens (or reuses) the IndexedDB connection.
   *
   * @returns Promise<IDBDatabase>
   */
  private openDb(): Promise<IDBDatabase> {
    if (this.dbPromise) {
      return this.dbPromise;
    }
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_POKEMON)) {
          db.createObjectStore(STORE_POKEMON);
        }
        if (!db.objectStoreNames.contains(STORE_META)) {
          db.createObjectStore(STORE_META);
        }
      };
    });
    return this.dbPromise;
  }

  /**
   * Persists the Pokémon catalog to IndexedDB.
   *
   * @param pokemon - List to cache
   */
  async savePokemon(pokemon: Pokemon[]): Promise<void> {
    const db = await this.openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STORE_POKEMON, STORE_META], 'readwrite');
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
      tx.objectStore(STORE_POKEMON).put(pokemon, 'catalog');
      tx.objectStore(STORE_META).put(Date.now(), 'pokemonCachedAt');
    });
  }

  /**
   * Loads cached Pokémon from IndexedDB.
   *
   * @returns Pokemon[] or null if never cached
   */
  async loadPokemon(): Promise<Pokemon[] | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_POKEMON, 'readonly');
      const request = tx.objectStore(STORE_POKEMON).get('catalog');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve((request.result as Pokemon[]) ?? null);
    });
  }

  /**
   * Returns cache timestamp metadata.
   */
  async getCachedAt(): Promise<number | null> {
    const db = await this.openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_META, 'readonly');
      const request = tx.objectStore(STORE_META).get('pokemonCachedAt');
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve((request.result as number) ?? null);
    });
  }
}
