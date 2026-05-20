import { gql } from 'apollo-angular';

/** Queries/mutations aligned with json-graphql-server schema (Trainer, allTeams, createTeam, …). */

export const GET_TRAINER = gql`
  query GetTrainer($id: ID!) {
    Trainer(id: $id) {
      id
      name
      badge_count
      region
      avatar_url
      rank
    }
  }
`;

export const GET_TEAMS = gql`
  query GetTeams($trainerId: ID) {
    allTeams(filter: { trainer_id: $trainerId }) {
      id
      trainer_id
      name
      pokemon_ids
      created_at
    }
  }
`;

export const GET_BATTLES = gql`
  query GetBattles($trainerId: ID) {
    allBattles(filter: { trainer_id: $trainerId }) {
      id
      trainer_id
      opponent_name
      team_id
      result
      date
      score_trainer
      score_opponent
    }
  }
`;

export const GET_BATTLE_LOGS = gql`
  query GetBattleLogs {
    allBattleLogs {
      id
      battle_id
      timestamp
      message
      severity
    }
  }
`;

export const CREATE_TEAM = gql`
  mutation CreateTeam($trainer_id: ID!, $name: String!, $pokemon_ids: [Int]!, $created_at: String!) {
    createTeam(trainer_id: $trainer_id, name: $name, pokemon_ids: $pokemon_ids, created_at: $created_at) {
      id
      trainer_id
      name
      pokemon_ids
      created_at
    }
  }
`;

export const UPDATE_TEAM = gql`
  mutation UpdateTeam($id: ID!, $name: String!, $pokemon_ids: [Int]!) {
    updateTeam(id: $id, name: $name, pokemon_ids: $pokemon_ids) {
      id
      name
      pokemon_ids
    }
  }
`;

export const DELETE_TEAM = gql`
  mutation DeleteTeam($id: ID!) {
    deleteTeam(id: $id) {
      id
    }
  }
`;

export const CREATE_BATTLE_LOG = gql`
  mutation CreateBattleLog($battle_id: Int!, $timestamp: String!, $message: String!, $severity: String!) {
    createBattleLog(battle_id: $battle_id, timestamp: $timestamp, message: $message, severity: $severity) {
      id
      battle_id
      timestamp
      message
      severity
    }
  }
`;

export const CREATE_BATTLE = gql`
  mutation CreateBattle(
    $trainer_id: ID!
    $opponent_name: String!
    $team_id: ID!
    $result: String!
    $date: String!
    $score_trainer: Int!
    $score_opponent: Int!
  ) {
    createBattle(
      trainer_id: $trainer_id
      opponent_name: $opponent_name
      team_id: $team_id
      result: $result
      date: $date
      score_trainer: $score_trainer
      score_opponent: $score_opponent
    ) {
      id
      trainer_id
      opponent_name
      team_id
      result
      date
      score_trainer
      score_opponent
    }
  }
`;

export const UPDATE_TRAINER = gql`
  mutation UpdateTrainer($id: ID!, $name: String!, $region: String!, $avatar_url: String!, $rank: String!) {
    updateTrainer(id: $id, name: $name, region: $region, avatar_url: $avatar_url, rank: $rank) {
      id
      name
      region
      avatar_url
      rank
    }
  }
`;
