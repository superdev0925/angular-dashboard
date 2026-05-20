import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { PokemonSelectors } from './pokemon.selectors';
import { Pokemon, PokemonStore } from './pokemon.store';

describe('PokemonSelectors', () => {
  let selectors: PokemonSelectors;

  const mockPokemon: Pokemon = {
    id: 25,
    name: 'pikachu',
    height: 4,
    weight: 60,
    base_experience: 112,
    types: [{ id: 13, name: 'electric' }],
    stats: [
      { base_stat: 35, stat: { name: 'hp' } },
      { base_stat: 55, stat: { name: 'attack' } },
      { base_stat: 40, stat: { name: 'defense' } },
      { base_stat: 50, stat: { name: 'special-attack' } },
      { base_stat: 50, stat: { name: 'special-defense' } },
      { base_stat: 90, stat: { name: 'speed' } }
    ],
    sprites: ''
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        PokemonSelectors,
        { provide: PokemonStore, useValue: { pokemon$: of([]) } }
      ]
    });
    selectors = TestBed.inject(PokemonSelectors);
  });

  it('calculateTotalStats sums all base stats', () => {
    expect(selectors.calculateTotalStats(mockPokemon)).toBe(320);
  });

  it('getStatsForRadar returns six stat values in order', () => {
    expect(selectors.getStatsForRadar(mockPokemon)).toEqual([35, 55, 40, 50, 50, 90]);
  });

  it('getMatchup returns neutral when no effectiveness data loaded', () => {
    expect(selectors.getMatchup('fire', ['grass'])).toBe('neutral');
  });
});
