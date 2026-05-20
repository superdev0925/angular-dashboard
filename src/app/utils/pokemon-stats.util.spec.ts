import {
  buildStatMap,
  getPokedexTableRowStats,
  getPokemonStat,
  getPokemonTotal,
} from './pokemon-stats.util';

describe('pokemon-stats.util', () => {
  const raticateStats = [
    { base_stat: 55, stat: { name: 'hp', id: 1 } },
    { base_stat: 81, stat: { name: 'attack', id: 2 } },
    { base_stat: 60, stat: { name: 'defense', id: 3 } },
    { base_stat: 50, stat: { name: 'special-attack', id: 4 } },
    { base_stat: 70, stat: { name: 'special-defense', id: 5 } },
    { base_stat: 97, stat: { name: 'speed', id: 6 } },
  ];

  it('maps stat_id so SP. ATK and SP. DEF are not swapped', () => {
    expect(getPokemonStat(raticateStats, 'special-attack')).toBe(50);
    expect(getPokemonStat(raticateStats, 'special-defense')).toBe(70);
    expect(getPokemonStat(raticateStats, 'speed')).toBe(97);
  });

  it('sums all six stats for TOTAL', () => {
    expect(getPokemonTotal(raticateStats)).toBe(413);
    expect(buildStatMap(raticateStats).hp + buildStatMap(raticateStats).speed).toBe(152);
  });

  it('getPokedexTableRowStats matches Blastoise base stats', () => {
    const blastoise = [
      { base_stat: 79, stat: { name: 'hp', id: 1 } },
      { base_stat: 83, stat: { name: 'attack', id: 2 } },
      { base_stat: 100, stat: { name: 'defense', id: 3 } },
      { base_stat: 85, stat: { name: 'special-attack', id: 4 } },
      { base_stat: 105, stat: { name: 'special-defense', id: 5 } },
      { base_stat: 78, stat: { name: 'speed', id: 6 } },
    ];
    const row = getPokedexTableRowStats(blastoise);
    expect(row.specialAttack).toBe(85);
    expect(row.specialDefense).toBe(105);
    expect(row.total).toBe(530);
  });
});
