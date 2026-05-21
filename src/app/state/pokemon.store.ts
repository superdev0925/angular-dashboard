import { Injectable, inject, DestroyRef } from '@angular/core';
import { BehaviorSubject, Observable, throwError, of, from } from 'rxjs';
import { map, catchError, retry, tap, debounceTime, distinctUntilChanged, shareReplay, switchMap, finalize } from 'rxjs/operators';
import { Apollo } from 'apollo-angular';
import {
  GET_POKEMON,
  GET_POKEMON_BY_ID,
  GET_TYPES,
  GET_SPECIES_EVOLUTION_CHAIN_ID,
  GET_EVOLUTION_CHAIN,
} from '../core/graphql/pokemon.queries';
import { PokemonCacheService } from '../services/pokemon-cache.service';
import {
  POKEMON_STAT_IDS,
  PokemonStatRow,
  canonicalizePokemonStats,
  normalizeStatKey,
} from '../utils/pokemon-stats.util';

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number;
  types: { id: number; name: string }[];
  stats: PokemonStatRow[];
  abilities?: any[];
  moves?: string[];
  evolutionChain?: string[];
  sprites: string;
}

/** GraphQL page size when loading the full national dex catalog. */
export const POKEMON_CATALOG_BATCH_SIZE = 100;

export interface FetchPokemonOptions {
  /** When true, merge this page into the store instead of replacing the catalog. */
  append?: boolean;
}

export interface PokemonState {
  pokemon: Pokemon[];
  selectedPokemon: Pokemon | null;
  types: any[];
  loading: boolean;
  error: string | null;
  searchTerm: string;
  typeFilter: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  pagination: { limit: number; offset: number; total: number };
}

const initialState: PokemonState = {
  pokemon: [],
  selectedPokemon: null,
  types: [],
  loading: false,
  error: null,
  searchTerm: '',
  typeFilter: '',
  sortBy: 'id',
  sortOrder: 'asc',
  pagination: { limit: 20, offset: 0, total: 0 }
};

@Injectable({ providedIn: 'root' })
export class PokemonStore {
  private apollo = inject(Apollo);
  private destroyRef = inject(DestroyRef);
  private pokemonCache = inject(PokemonCacheService);
  private state$ = new BehaviorSubject<PokemonState>(initialState);

  // Public observables
  public pokemon$ = this.state$.pipe(map(state => state.pokemon));
  public loading$ = this.state$.pipe(map(state => state.loading));
  public error$ = this.state$.pipe(map(state => state.error));
  public selectedPokemon$ = this.state$.pipe(map(state => state.selectedPokemon));
  public types$ = this.state$.pipe(map(state => state.types), shareReplay(1));
  public searchTerm$ = this.state$.pipe(map(state => state.searchTerm));
  public typeFilter$ = this.state$.pipe(map(state => state.typeFilter));

  /**
   * Fetches one paginated page from the PokéAPI GraphQL endpoint.
   *
   * @param limit - Number of Pokémon to fetch per page
   * @param offset - Starting index for pagination
   * @param options - When `append` is true, merges into the existing store catalog
   * @returns Observable<Pokemon[]> - The page that was just fetched
   */
  fetchPokemon(
    limit: number = POKEMON_CATALOG_BATCH_SIZE,
    offset: number = 0,
    options?: FetchPokemonOptions
  ): Observable<Pokemon[]> {
    this.setLoading(true);

    if (!navigator.onLine) {
      return this.fetchPokemonFromCache(limit, offset, options?.append).pipe(map((r) => r.page));
    }

    return this.queryPokemonPage(limit, offset).pipe(
      map((page) => {
        const catalog = options?.append
          ? this.mergePokemonLists(this.state$.value.pokemon, page)
          : page;
        void this.pokemonCache.savePokemon(catalog);
        this.updateState({
          pokemon: catalog,
          pagination: { limit, offset, total: catalog.length },
          loading: false,
          error: null,
        });
        return page;
      }),
      catchError((error) =>
        this.fetchPokemonFromCache(limit, offset, options?.append).pipe(
          switchMap((cached) => {
            if (cached.page.length) {
              return of(cached.page);
            }
            this.setError(error.message);
            return throwError(() => error);
          })
        )
      )
    );
  }

  /**
   * Loads the full Pokédex catalog by paging through PokéAPI until a short page is returned.
   * Merges each batch into the store and persists the full list to IndexedDB.
   *
   * @returns Observable<Pokemon[]> - Complete merged catalog in the store
   */
  fetchAllPokemon(): Observable<Pokemon[]> {
    this.setLoading(true);

    if (!navigator.onLine) {
      return this.loadFullCatalogFromCache();
    }

    return this.fetchAllPokemonPages(POKEMON_CATALOG_BATCH_SIZE, 0, []).pipe(
      tap((catalog) => {
        void this.pokemonCache.savePokemon(catalog);
        this.updateState({
          pokemon: catalog,
          pagination: { limit: POKEMON_CATALOG_BATCH_SIZE, offset: 0, total: catalog.length },
          loading: false,
          error: null,
        });
      }),
      catchError((error) =>
        this.loadFullCatalogFromCache().pipe(
          switchMap((cached) => {
            if (cached.length) {
              return of(cached);
            }
            this.setError(error.message);
            return throwError(() => error);
          })
        )
      ),
      finalize(() => this.setLoading(false))
    );
  }

  /**
   * Recursively fetches PokéAPI pages until fewer than `batchSize` rows are returned.
   *
   * @param batchSize - GraphQL limit per request
   * @param offset - Current offset into the national dex
   * @param accumulated - Pokémon merged so far
   * @returns Observable<Pokemon[]> - Full catalog
   */
  private fetchAllPokemonPages(
    batchSize: number,
    offset: number,
    accumulated: Pokemon[]
  ): Observable<Pokemon[]> {
    return this.queryPokemonPage(batchSize, offset).pipe(
      switchMap((page) => {
        const merged = this.mergePokemonLists(accumulated, page);
        if (page.length < batchSize) {
          return of(merged);
        }
        return this.fetchAllPokemonPages(batchSize, offset + page.length, merged);
      })
    );
  }

  /**
   * Runs GET_POKEMON against the public PokéAPI GraphQL endpoint.
   *
   * @param limit - Page size
   * @param offset - Page offset
   * @returns Observable<Pokemon[]> - Transformed page
   */
  private queryPokemonPage(limit: number, offset: number): Observable<Pokemon[]> {
    return this.apollo.query<any>({
      query: GET_POKEMON,
      variables: { limit, offset },
      fetchPolicy: 'network-only',
    }).pipe(
      retry({ count: 3, delay: 1000 }),
      map((result) => {
        const raw = result?.data?.pokemon_v2_pokemon;
        return this.transformPokemonData(Array.isArray(raw) ? raw : []);
      })
    );
  }

  /**
   * Merges two Pokémon lists by id and sorts by national dex number.
   *
   * @param existing - Current catalog
   * @param incoming - New page or batch
   * @returns Pokemon[] - Deduped sorted catalog
   */
  private mergePokemonLists(existing: Pokemon[], incoming: Pokemon[]): Pokemon[] {
    const byId = new Map<number, Pokemon>();
    for (const p of existing) {
      byId.set(p.id, p);
    }
    for (const p of incoming) {
      byId.set(p.id, p);
    }
    return Array.from(byId.values()).sort((a, b) => a.id - b.id);
  }

  /**
   * Loads the full cached catalog from IndexedDB (offline / fallback).
   *
   * @returns Observable<Pokemon[]> - Cached catalog or empty
   */
  private loadFullCatalogFromCache(): Observable<Pokemon[]> {
    return from(this.pokemonCache.loadPokemon()).pipe(
      map((all) => {
        const pokemon = (all ?? []).map((p) => ({
          ...p,
          stats: canonicalizePokemonStats(p.stats),
        }));
        this.updateState({
          pokemon,
          pagination: { limit: pokemon.length, offset: 0, total: pokemon.length },
          loading: false,
          error: pokemon.length ? null : 'No cached Pokémon available',
        });
        return pokemon;
      })
    );
  }

  /**
   * Loads a slice from IndexedDB when offline or when the network fails.
   *
   * @param limit - Page size
   * @param offset - Page offset
   * @param append - Whether to merge into the existing store list
   * @returns Observable with the fetched page and merged catalog metadata
   */
  private fetchPokemonFromCache(
    limit: number,
    offset: number,
    append?: boolean
  ): Observable<{ page: Pokemon[]; catalog: Pokemon[] }> {
    return from(this.pokemonCache.loadPokemon()).pipe(
      map((all) => {
        const full = (all ?? []).map((p) => ({
          ...p,
          stats: canonicalizePokemonStats(p.stats),
        }));
        const page = full.slice(offset, offset + limit);
        const catalog = append ? this.mergePokemonLists(this.state$.value.pokemon, page) : full;
        this.updateState({
          pokemon: catalog,
          pagination: { limit, offset, total: catalog.length },
          loading: false,
          error: catalog.length ? null : 'No cached Pokémon available',
        });
        return { page, catalog };
      })
    );
  }

  /**
   * Fetches a single Pokémon by ID with detailed information including abilities.
   *
   * @param id - Pokémon ID to fetch
   * @returns Observable<Pokemon> - Stream of detailed Pokémon data
   */
  fetchPokemonById(id: number): Observable<Pokemon> {
    this.setLoading(true);

    return this.apollo.query<any>({
      query: GET_POKEMON_BY_ID,
      variables: { id },
      fetchPolicy: 'network-only',
    }).pipe(
      retry({ count: 3, delay: 1000 }),
      switchMap((result) => {
        const raw = result?.data?.pokemon_v2_pokemon_by_pk;
        if (!raw) {
          return throwError(() => new Error('Pokémon not found'));
        }
        const speciesId = raw.pokemon_species_id as number | undefined;
        if (!speciesId) {
          const pokemon = this.transformSinglePokemon(raw, []);
          this.updateState({ selectedPokemon: pokemon, loading: false });
          return of(pokemon);
        }
        return this.apollo.query<any>({
          query: GET_SPECIES_EVOLUTION_CHAIN_ID,
          variables: { speciesId },
        }).pipe(
          switchMap((speciesResult) => {
            const chainId =
              speciesResult?.data?.pokemon_v2_pokemonspecies_by_pk?.evolution_chain_id;
            if (!chainId) {
              const pokemon = this.transformSinglePokemon(raw, []);
              this.updateState({ selectedPokemon: pokemon, loading: false });
              return of(pokemon);
            }
            return this.apollo.query<any>({
              query: GET_EVOLUTION_CHAIN,
              variables: { chainId },
            }).pipe(
              map((evoResult) => {
                const chain =
                  evoResult?.data?.pokemon_v2_pokemonspecies?.map((s: { name: string }) => s.name) ??
                  [];
                const pokemon = this.transformSinglePokemon(raw, chain);
                this.updateState({ selectedPokemon: pokemon, loading: false });
                return pokemon;
              })
            );
          })
        );
      }),
      catchError((error) => {
        this.setLoading(false);
        this.setError(error.message);
        return throwError(() => error);
      })
    );
  }

  /**
   * Fetches all Pokémon types with damage relations for type effectiveness calculations.
   *
   * @returns Observable<any[]> - Stream of type data
   */
  fetchTypes(): Observable<any[]> {
    return this.apollo.query<any>({
      query: GET_TYPES
    }).pipe(
      retry({ count: 3, delay: 1000 }),
      tap((result) => {
        this.updateState({ types: result.data.pokemon_v2_type });
      }),
      map((result) => result.data.pokemon_v2_type),
      shareReplay(1)
    );
  }

  /**
   * Searches Pokémon with debounce for optimal performance.
   * Uses debounceTime(300) and distinctUntilChanged to avoid excessive API calls.
   *
   * @param searchTerm - Search term to filter Pokémon
   * @returns Observable<Pokemon[]> - Filtered Pokémon list
   */
  searchPokemon(searchTerm: string): Observable<Pokemon[]> {
    this.updateState({ searchTerm });
    
    return this.pokemon$.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      map(pokemon => {
        if (!searchTerm) return pokemon;
        const term = searchTerm.toLowerCase();
        return pokemon.filter(p => 
          p.name.toLowerCase().includes(term) || 
          p.id.toString().includes(term)
        );
      })
    );
  }

  /**
   * Filters Pokémon by type.
   *
   * @param type - Type to filter by
   */
  filterByType(type: string): void {
    this.updateState({ typeFilter: type });
  }

  /**
   * Sets the selected Pokémon in the store.
   *
   * @param pokemon - Pokémon to select
   */
  setSelectedPokemon(pokemon: Pokemon | null): void {
    this.updateState({ selectedPokemon: pokemon });
  }

  /**
   * Transforms raw GraphQL Pokémon data to the Pokemon interface.
   *
   * @param data - Raw GraphQL data
   * @returns Pokemon[] - Transformed Pokémon array
   */
  private transformPokemonData(data: any[]): Pokemon[] {
    if (!data || !Array.isArray(data)) return [];

    return data.map((pokemon) => {
      const id = pokemon?.id || 0;
      return {
        id,
        name: pokemon?.name || 'Unknown',
        height: pokemon?.height || 0,
        weight: pokemon?.weight || 0,
        base_experience: pokemon?.base_experience || 0,
        types: pokemon?.pokemon_v2_pokemontypes?.map((t: any) => t?.pokemon_v2_type || { id: 0, name: 'unknown' }) || [],
        stats: canonicalizePokemonStats(this.normalizeStats(pokemon?.pokemon_v2_pokemonstats)),
        sprites: this.resolveSpriteUrl(id, pokemon?.pokemon_v2_pokemonsprites?.[0]?.sprites),
      };
    });
  }

  /**
   * Transforms single Pokémon data with abilities.
   *
   * @param data - Raw GraphQL data
   * @returns Pokemon - Transformed Pokémon
   */
  private transformSinglePokemon(data: any, evolutionChain: string[] = []): Pokemon {
    // Safely extract abilities
    let abilities: any[] = [];
    if (data.pokemon_v2_pokemonabilities && Array.isArray(data.pokemon_v2_pokemonabilities)) {
      abilities = data.pokemon_v2_pokemonabilities;
    }

    const moves =
      data.pokemon_v2_pokemonmoves
        ?.map((m: any) => m?.pokemon_v2_move?.name)
        .filter(Boolean) ?? [];

    return {
      id: data.id,
      name: data.name,
      height: data.height,
      weight: data.weight,
      base_experience: data.base_experience,
      types: data.pokemon_v2_pokemontypes?.map((t: any) => t.pokemon_v2_type) || [],
      stats: canonicalizePokemonStats(this.normalizeStats(data.pokemon_v2_pokemonstats)),
      abilities: abilities,
      moves,
      evolutionChain,
      sprites: this.resolveSpriteUrl(data.id, data.pokemon_v2_pokemonsprites?.[0]?.sprites),
    };
  }

  /**
   * Resolves a sprite image URL from GraphQL sprites JSON or falls back to PokeAPI CDN by ID.
   *
   * @param id - Pokémon national dex ID
   * @param rawSprites - Sprites field from GraphQL (string JSON or object)
   * @returns string - Usable sprite image URL
   */
  private resolveSpriteUrl(id: number, rawSprites?: unknown): string {
    const fallback = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    if (rawSprites == null) {
      return fallback;
    }

    try {
      let sprites: Record<string, unknown> =
        typeof rawSprites === 'string' ? JSON.parse(rawSprites) : (rawSprites as Record<string, unknown>);

      if (typeof sprites === 'string') {
        sprites = JSON.parse(sprites);
      }

      const other = sprites['other'] as Record<string, Record<string, string>> | undefined;
      const fromApi =
        (sprites['front_default'] as string) ||
        other?.['official-artwork']?.['front_default'] ||
        other?.['home']?.['front_default'];

      return fromApi || fallback;
    } catch {
      return fallback;
    }
  }

  /** Maps PokéAPI stat rows using stat_id so SP. ATK / SP. DEF never swap. */
  private normalizeStats(raw: any[] | undefined): PokemonStatRow[] {
    if (!raw?.length) {
      return [];
    }
    return raw.map((s) => {
      const statId = s?.stat_id ?? s?.pokemon_v2_stat?.id;
      const id = statId != null ? Number(statId) : undefined;
      const rawName = s?.pokemon_v2_stat?.name ?? s?.stat?.name ?? '';
      const name =
        (id != null && POKEMON_STAT_IDS[id]) ||
        normalizeStatKey(String(rawName)) ||
        String(rawName).toLowerCase().replace(/_/g, '-');
      return {
        base_stat: s?.base_stat ?? 0,
        stat: { name, id },
      };
    });
  }

  private setLoading(loading: boolean): void {
    this.updateState({ loading });
  }

  private setError(error: string | null): void {
    this.updateState({ error, loading: false });
  }

  private updateState(updates: Partial<PokemonState>): void {
    this.state$.next({ ...this.state$.value, ...updates });
  }

  getState(): PokemonState {
    return this.state$.value;
  }
}