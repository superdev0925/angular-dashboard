import { Injectable, inject } from '@angular/core';
import { combineLatest, Observable } from 'rxjs';
import { map, distinctUntilChanged, debounceTime, shareReplay, tap } from 'rxjs/operators';
import { PokemonStore, Pokemon } from './pokemon.store';
import { buildStatMap, getPokemonTotal } from '../utils/pokemon-stats.util';

export interface PokemonFilter {
  searchTerm: string;
  typeFilter: string;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
  minTotalStats: number;
  maxTotalStats: number;
}

@Injectable({ providedIn: 'root' })
export class PokemonSelectors {
  private pokemonStore = inject(PokemonStore);
  private effectivenessMap = new Map<string, Map<string, number>>();

  /** Cached type matchup matrix from PokéAPI (shareReplay on types$). */
  readonly typeEffectiveness$ = this.pokemonStore.types$.pipe(
    map((types) => this.buildEffectivenessMap(types)),
    tap((map) => {
      this.effectivenessMap = map;
    }),
    shareReplay(1)
  );

  /**
   * Returns filtered and sorted Pokémon based on filter criteria.
   * Uses debounceTime for search input optimization.
   *
   * @param filter$ - Observable of filter criteria
   * @returns Observable<Pokemon[]> - Filtered Pokémon list
   */
  getFilteredPokemon(filter$: Observable<PokemonFilter>): Observable<Pokemon[]> {
    return combineLatest([
      this.pokemonStore.pokemon$,
      filter$.pipe(debounceTime(300), distinctUntilChanged())
    ]).pipe(
      map(([pokemon, filter]) => {
        let filtered = [...(pokemon || [])];

        const minBound = Math.min(filter.minTotalStats, filter.maxTotalStats);
        const maxBound = Math.max(filter.minTotalStats, filter.maxTotalStats);

        // Text search filter
        if (filter.searchTerm) {
          const term = filter.searchTerm.toLowerCase();
          filtered = filtered.filter(p =>
            p?.name?.toLowerCase().includes(term) ||
            p?.id?.toString().includes(term)
          );
        }

        // Type filter
        if (filter.typeFilter) {
          filtered = filtered.filter(p =>
            (p.types || []).some(t => t.name === filter.typeFilter)
          );
        }

        // Total stats filter (min/max slider can be crossed; clamp so rows are not all dropped)
        filtered = filtered.filter(p => {
          const total = this.calculateTotalStats(p);
          return total >= minBound && total <= maxBound;
        });

        // Sorting
        if (filter.sortBy) {
          filtered.sort((a, b) => {
            let aVal: any, bVal: any;
            if (filter.sortBy === 'total') {
              aVal = this.calculateTotalStats(a);
              bVal = this.calculateTotalStats(b);
            } else if (filter.sortBy === 'name') {
              aVal = a.name;
              bVal = b.name;
            } else {
              const statA = a.stats.find(s => s.stat.name === filter.sortBy);
              const statB = b.stats.find(s => s.stat.name === filter.sortBy);
              aVal = statA?.base_stat || 0;
              bVal = statB?.base_stat || 0;
            }
            
            if (filter.sortOrder === 'asc') {
              return aVal > bVal ? 1 : -1;
            } else {
              return aVal < bVal ? 1 : -1;
            }
          });
        }

        return filtered;
      })
    );
  }

  /**
   * Calculates total base stats for a Pokémon.
   *
   * @param pokemon - Pokémon to calculate stats for
   * @returns number - Sum of all base stats
   */
  calculateTotalStats(pokemon: Pokemon): number {
    return getPokemonTotal(pokemon?.stats);
  }

  /**
   * Gets the highest stat for a Pokémon.
   *
   * @param pokemon - Pokémon to analyze
   * @returns { name: string; value: number } - Highest stat
   */
  getHighestStat(pokemon: Pokemon): { name: string; value: number } {
    const statMap: { [key: string]: number } = {};
    pokemon.stats.forEach(stat => {
      statMap[stat.stat.name] = stat.base_stat;
    });
    
    const statNames = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
    let highestStat = { name: 'hp', value: 0 };
    
    statNames.forEach(name => {
      if (statMap[name] > highestStat.value) {
        highestStat = { name, value: statMap[name] };
      }
    });
    
    return highestStat;
  }

  /**
   * Gets stat array for radar chart.
   *
   * @param pokemon - Pokémon to get stats for
   * @returns number[] - Array of stat values
   */
  getStatsForRadar(pokemon: Pokemon): number[] {
    const map = buildStatMap(pokemon.stats);
    return [
      map.hp,
      map.attack,
      map.defense,
      map['special-attack'],
      map['special-defense'],
      map.speed,
    ];
  }

  /**
   * Returns matchup when `attacker` type faces one or more defending types.
   *
   * @param attacker - Attacking type name
   * @param defenders - Defending type names on a Pokémon
   * @returns 'super' | 'weak' | 'neutral'
   */
  getMatchup(attacker: string, defenders: string[]): 'super' | 'weak' | 'neutral' {
    const atk = attacker.toLowerCase();
    const row = this.effectivenessMap.get(atk);
    if (!row) {
      return 'neutral';
    }
    let best = 100;
    let worst = 100;
    for (const d of defenders) {
      const factor = row.get(d.toLowerCase()) ?? 100;
      best = Math.max(best, factor);
      worst = Math.min(worst, factor);
    }
    if (best >= 200) {
      return 'super';
    }
    if (worst <= 50) {
      return 'weak';
    }
    return 'neutral';
  }

  /**
   * Builds attacker → defender damage factor map from PokéAPI type efficacy data.
   *
   * @param types - Raw type list from GraphQL
   * @returns Map of attacking type to defending type damage factors
   */
  private buildEffectivenessMap(types: any[]): Map<string, Map<string, number>> {
    const map = new Map<string, Map<string, number>>();
    for (const t of types || []) {
      const name = (t?.name || '').toLowerCase();
      if (!name) {
        continue;
      }
      const inner = new Map<string, number>();
      for (const eff of t?.pokemon_v2_typeefficacies || []) {
        const target = eff?.pokemonV2TypeByTargetTypeId?.name?.toLowerCase();
        if (target) {
          inner.set(target, eff.damage_factor ?? 100);
        }
      }
      map.set(name, inner);
    }
    return map;
  }
}