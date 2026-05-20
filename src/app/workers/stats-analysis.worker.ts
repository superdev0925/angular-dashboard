/// <reference lib="webworker" />

export interface TeamCoverageInput {
  teamTypes: string[];
  allPokemonTypes: string[][];
}

export interface TeamCoverageResult {
  superEffectiveAgainst: string[];
  resistedBy: string[];
  uncoveredTypes: string[];
  elapsedMs: number;
}

const TYPE_CHART: Record<string, Record<string, number>> = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 2, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

const ALL_TYPES = Object.keys(TYPE_CHART);

/**
 * Computes best offensive type factor from a team's typings.
 *
 * @param teamTypes - Flat list of types on the team
 * @param defenderType - Type being attacked
 * @returns number - Damage multiplier
 */
function teamMultiplierAgainst(teamTypes: string[], defenderType: string): number {
  let best = 0;
  for (const atk of teamTypes) {
    const chart = TYPE_CHART[atk];
    if (!chart) continue;
    const mult = chart[defenderType] ?? 1;
    if (mult > best) best = mult;
  }
  return best;
}

addEventListener('message', ({ data }: MessageEvent<TeamCoverageInput>) => {
  const start = performance.now();
  const teamTypes = [...new Set((data.teamTypes ?? []).map((t) => t.toLowerCase()))];
  const superEffectiveAgainst: string[] = [];
  const resistedBy: string[] = [];

  for (const defender of ALL_TYPES) {
    const mult = teamMultiplierAgainst(teamTypes, defender);
    if (mult >= 2) superEffectiveAgainst.push(defender);
    if (mult === 0 || mult < 1) resistedBy.push(defender);
  }

  const uncoveredTypes = ALL_TYPES.filter((t) => !superEffectiveAgainst.includes(t));

  const result: TeamCoverageResult = {
    superEffectiveAgainst,
    resistedBy,
    uncoveredTypes: uncoveredTypes.slice(0, 8),
    elapsedMs: performance.now() - start,
  };

  postMessage(result);
});
