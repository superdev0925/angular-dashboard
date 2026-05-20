import { gql } from 'apollo-angular';

/**
 * GraphQL query to fetch paginated Pokémon list with types, stats, and sprites
 */
export const GET_POKEMON = gql`
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

/**
 * GraphQL query to fetch single Pokémon details by ID including abilities and moves
 */
export const GET_POKEMON_BY_ID = gql`
  query GetPokemonById($id: Int!) {
    pokemon_v2_pokemon_by_pk(id: $id) {
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
      pokemon_v2_pokemonabilities {
        is_hidden
        pokemon_v2_ability {
          name
          pokemon_v2_abilityeffecttexts(where: {language_id: {_eq: 9}}) {
            effect
            short_effect
          }
        }
      }
      pokemon_species_id
      pokemon_v2_pokemonmoves(limit: 12, order_by: {move_id: asc}) {
        pokemon_v2_move {
          name
        }
      }
      pokemon_v2_pokemonsprites {
        sprites
      }
    }
  }
`;

/**
 * Reads evolution_chain_id for a species (used after pokemon detail fetch).
 */
export const GET_SPECIES_EVOLUTION_CHAIN_ID = gql`
  query GetSpeciesEvolutionChainId($speciesId: Int!) {
    pokemon_v2_pokemonspecies_by_pk(id: $speciesId) {
      evolution_chain_id
    }
  }
`;

/**
 * Fetches species evolution chain members by chain id (separate query — not nested on pokemon).
 */
export const GET_EVOLUTION_CHAIN = gql`
  query GetEvolutionChain($chainId: Int!) {
    pokemon_v2_pokemonspecies(where: { evolution_chain_id: { _eq: $chainId } }, order_by: { order: asc }) {
      name
      order
    }
  }
`;

/**
 * GraphQL query to fetch Pokémon types with damage relations for type effectiveness
 */
export const GET_TYPES = gql`
  query GetTypes {
    pokemon_v2_type {
      id
      name
      pokemon_v2_typeefficacies {
        damage_factor
        pokemonV2TypeByTargetTypeId {
          name
        }
      }
    }
  }
`;