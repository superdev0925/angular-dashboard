import { Injectable, inject } from '@angular/core';
import { Apollo } from 'apollo-angular';
import { map, catchError, retry } from 'rxjs/operators';
import { Observable, throwError, of } from 'rxjs';
import { gql } from '@apollo/client/core';

export interface PokemonType {
  id: number;
  name: string;
}

export interface PokemonStat {
  base_stat: number;
  pokemon_v2_stat: {
    name: string;
  };
}

export interface PokemonSprite {
  sprites: string;
}

export interface PokemonData {
  id: number;
  name: string;
  height: number;
  weight: number;
  base_experience: number;
  pokemon_v2_pokemontypes: Array<{ pokemon_v2_type: PokemonType }>;
  pokemon_v2_pokemonstats: PokemonStat[];
  pokemon_v2_pokemonsprites: PokemonSprite[];
}

const GET_POKEMON = gql`
  query GetPokemon($limit: Int, $offset: Int) {
    pokemon_v2_pokemon(limit: $limit, offset: $offset) {
      id
      name
      height
      weight
      base_experience
      pokemon_v2_pokemontypes {
        pokemon_v2_type {
          id
          name
        }
      }
      pokemon_v2_pokemonstats {
        base_stat
        pokemon_v2_stat {
          name
        }
      }
      pokemon_v2_pokemonsprites {
        sprites
      }
    }
  }
`;

@Injectable({ providedIn: 'root' })
export class PokemonService {
  private apollo = inject(Apollo);

  /**
   * Fetches paginated Pokémon from the PokéAPI GraphQL endpoint.
   *
   * @param limit - Number of Pokémon to fetch per page
   * @param offset - Starting index for pagination
   * @returns Observable<PokemonData[]> - Stream of Pokémon data
   */
  getPokemon(limit: number = 100, offset: number = 0): Observable<PokemonData[]> {
    console.log('Fetching Pokémon from GraphQL API...');
    
    return this.apollo.query<{ pokemon_v2_pokemon: PokemonData[] }>({
      query: GET_POKEMON,
      variables: { limit, offset },
      fetchPolicy: 'network-only'
    }).pipe(
      retry(2),
      map((result) => {
        const pokemon = result.data?.pokemon_v2_pokemon || [];
        console.log('GraphQL Response:', pokemon.length, 'Pokémon');
        return pokemon;
      }),
      catchError((error: Error) => {
        console.error('GraphQL Error:', error);
        return of([]);
      })
    );
  }
}