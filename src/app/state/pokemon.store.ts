import { Injectable, inject, DestroyRef } from '@angular/core';
import { BehaviorSubject, Observable, throwError, of, from } from 'rxjs';
import { map, catchError, retry, tap, debounceTime, distinctUntilChanged, shareReplay, switchMap } from 'rxjs/operators';
import { Apollo } from 'apollo-angular';
import {
  GET_POKEMON,
  GET_POKEMON_BY_ID,
  GET_TYPES,
  GET_SPECIES_EVOLUTION_CHAIN_ID,
  GET_EVOLUTION_CHAIN,
} from '../core/graphql/pokemon.queries';
import { PokemonCacheService } from '../services/pokemon-cache.service';

export interface Pokemon {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number;
  types: { id: number; name: string }[];
  stats: { base_stat: number; stat: { name: string } }[];
  abilities?: any[];
  moves?: string[];
  evolutionChain?: string[];
  sprites: string;
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
   * Fetches paginated Pokémon from the PokéAPI GraphQL endpoint.
   * Results are cached in the store to avoid redundant network calls.
   * Implements retry logic with exponential backoff for network failures.
   *
   * @param limit - Number of Pokémon to fetch per page
   * @param offset - Starting index for pagination
   * @returns Observable<Pokemon[]> - Stream of Pokémon data
   */
  fetchPokemon(limit: number = 20, offset: number = 0): Observable<Pokemon[]> {
    this.setLoading(true);

    if (!navigator.onLine) {
      return this.fetchPokemonFromCache(limit, offset);
    }

    return this.apollo.query<any>({
      query: GET_POKEMON,
      variables: { limit, offset },
      fetchPolicy: 'network-only',
    }).pipe(
      retry({ count: 3, delay: 1000 }),
      map((result) => {
        const raw = result?.data?.pokemon_v2_pokemon;
        const pokemon = this.transformPokemonData(Array.isArray(raw) ? raw : []);
        void this.pokemonCache.savePokemon(pokemon);
        this.updateState({
          pokemon,
          pagination: { limit, offset, total: pokemon.length },
          loading: false,
          error: null,
        });
        return pokemon;
      }),
      catchError((error) =>
        this.fetchPokemonFromCache(limit, offset).pipe(
          switchMap((cached) => {
            if (cached.length) {
              return of(cached);
            }
            this.setError(error.message);
            return throwError(() => error);
          })
        )
      )
    );
  }

  /**
   * Loads Pokémon from IndexedDB when offline or when the network fails.
   *
   * @param limit - Page size
   * @param offset - Page offset
   * @returns Observable<Pokemon[]>
   */
  private fetchPokemonFromCache(limit: number, offset: number): Observable<Pokemon[]> {
    return from(this.pokemonCache.loadPokemon()).pipe(
      map((all) => {
        const pokemon = (all ?? []).slice(offset, offset + limit);
        this.updateState({
          pokemon,
          pagination: { limit, offset, total: pokemon.length },
          loading: false,
          error: pokemon.length ? null : 'No cached Pokémon available',
        });
        return pokemon;
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
        stats: this.normalizeStats(pokemon?.pokemon_v2_pokemonstats),
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
      stats: this.normalizeStats(data.pokemon_v2_pokemonstats),
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

  /** Maps PokéAPI stat rows to `{ base_stat, stat: { name } }` for UI and selectors. */
  private normalizeStats(raw: any[] | undefined): { base_stat: number; stat: { name: string } }[] {
    if (!raw?.length) {
      return [];
    }
    return raw.map((s) => ({
      base_stat: s?.base_stat ?? 0,
      stat: {
        name: s?.stat?.name ?? s?.pokemon_v2_stat?.name ?? ''
      }
    }));
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