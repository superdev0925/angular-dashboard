/** Canonical PokéAPI stat keys (stat_id 1–6). */
export type PokemonStatKey =
  | 'hp'
  | 'attack'
  | 'defense'
  | 'special-attack'
  | 'special-defense'
  | 'speed';

export interface PokemonStatRow {
  base_stat: number;
  stat: { name: string; id?: number };
}

/** PokéAPI `stat_id` → normalized stat key. */
export const POKEMON_STAT_IDS: Record<number, PokemonStatKey> = {
  1: 'hp',
  2: 'attack',
  3: 'defense',
  4: 'special-attack',
  5: 'special-defense',
  6: 'speed',
};

/** Stat columns shown on the main Pokédex table (no SPEED column). */
export const POKEDEX_TABLE_STAT_KEYS: readonly PokemonStatKey[] = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
] as const;

export const POKEDEX_TABLE_STAT_LABELS: Record<PokemonStatKey, string> = {
  hp: 'HP',
  attack: 'ATK',
  defense: 'DEF',
  'special-attack': 'SP. ATK',
  'special-defense': 'SP. DEF',
  speed: 'SPEED',
};

/**
 * Resolves a raw API stat name to a canonical key.
 *
 * @param raw - Stat name from GraphQL / REST
 */
export function normalizeStatKey(raw: string): PokemonStatKey | null {
  const key = raw.toLowerCase().replace(/_/g, '-').trim();
  if (key in POKEDEX_TABLE_STAT_LABELS) {
    return key as PokemonStatKey;
  }
  if (key === 'sp-atk' || key === 'specialattack') {
    return 'special-attack';
  }
  if (key === 'sp-def' || key === 'specialdefense') {
    return 'special-defense';
  }
  return null;
}

/**
 * Builds a lookup of all six base stats using stat_id first, then name.
 *
 * @param stats - Normalized stat rows from the store
 */
export function buildStatMap(stats: PokemonStatRow[] | undefined): Record<PokemonStatKey, number> {
  const map: Record<PokemonStatKey, number> = {
    hp: 0,
    attack: 0,
    defense: 0,
    'special-attack': 0,
    'special-defense': 0,
    speed: 0,
  };

  for (const row of stats ?? []) {
    const id = row.stat?.id;
    const key =
      (id != null && POKEMON_STAT_IDS[Number(id)]) || normalizeStatKey(row.stat?.name ?? '');

    if (key) {
      map[key] = Number(row.base_stat) || 0;
    }
  }

  return map;
}

/**
 * Reads one base stat for table / detail views.
 *
 * @param stats - Pokémon stat rows
 * @param key - Canonical stat key
 */
export function getPokemonStat(stats: PokemonStatRow[] | undefined, key: PokemonStatKey): number {
  return buildStatMap(stats)[key];
}

/**
 * Sum of all six base stats (HP through Speed).
 *
 * @param stats - Pokémon stat rows
 */
export function getPokemonTotal(stats: PokemonStatRow[] | undefined): number {
  const map = buildStatMap(stats);
  return (
    map.hp +
    map.attack +
    map.defense +
    map['special-attack'] +
    map['special-defense'] +
    map.speed
  );
}

const CANONICAL_STAT_ORDER: PokemonStatKey[] = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
];

/**
 * Rebuilds stats in fixed PokéAPI order so table columns never drift (incl. cached rows).
 *
 * @param stats - Raw or legacy stat rows
 */
export function canonicalizePokemonStats(stats: PokemonStatRow[] | undefined): PokemonStatRow[] {
  const map = buildStatMap(stats);
  return CANONICAL_STAT_ORDER.map((key) => ({
    base_stat: map[key],
    stat: {
      name: key,
      id: Number(Object.entries(POKEMON_STAT_IDS).find(([, v]) => v === key)?.[0]),
    },
  }));
}

/** Per-row values for the Pokédex table (avoids column / mapping mistakes). */
export interface PokedexTableRowStats {
  hp: number;
  attack: number;
  defense: number;
  specialAttack: number;
  specialDefense: number;
  total: number;
}

export function getPokedexTableRowStats(stats: PokemonStatRow[] | undefined): PokedexTableRowStats {
  const map = buildStatMap(stats);
  return {
    hp: map.hp,
    attack: map.attack,
    defense: map.defense,
    specialAttack: map['special-attack'],
    specialDefense: map['special-defense'],
    total: getPokemonTotal(stats),
  };
}
