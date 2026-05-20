import { Injectable, inject } from '@angular/core';
import { BehaviorSubject, Observable, throwError, of, interval, forkJoin } from 'rxjs';
import { map, catchError, retry, switchMap, startWith, filter } from 'rxjs/operators';
import { Apollo } from 'apollo-angular';
import {
  GET_TRAINER,
  GET_TEAMS,
  GET_BATTLES,
  GET_BATTLE_LOGS,
  CREATE_TEAM,
  UPDATE_TEAM,
  DELETE_TEAM,
  CREATE_BATTLE,
  CREATE_BATTLE_LOG,
  UPDATE_TRAINER
} from '../core/graphql/local.queries';
import { MutationQueueService } from '../services/mutation-queue.service';

export interface Trainer {
  id: number;
  name: string;
  badge_count: number;
  region: string;
  avatar_url: string;
  rank: string;
}

export interface Team {
  id: number;
  trainer_id: number;
  name: string;
  pokemon_ids: number[];
  created_at: string;
}

export interface Battle {
  id: number;
  trainer_id: number;
  opponent_name: string;
  team_id: number;
  result: 'win' | 'loss';
  date: string;
  score_trainer: number;
  score_opponent: number;
}

export interface BattleLog {
  id: number;
  battle_id: number;
  timestamp: string;
  message: string;
  severity: 'success' | 'info' | 'danger' | 'warning';
}

export interface TrainerState {
  currentTrainer: Trainer | null;
  teams: Team[];
  battles: Battle[];
  battleLogs: BattleLog[];
  loading: boolean;
  error: string | null;
}

const initialState: TrainerState = {
  currentTrainer: null,
  teams: [],
  battles: [],
  battleLogs: [],
  loading: false,
  error: null
};

@Injectable({ providedIn: 'root' })
export class TrainerStore {
  private apollo = inject(Apollo);
  /** Local json-graphql-server client (mutations + trainer queries). */
  private localApollo = this.apollo.use('local');
  private mutationQueue = inject(MutationQueueService);
  private lastBattleLogId = 0;
  private state$ = new BehaviorSubject<TrainerState>(initialState);

  // Public observables
  public currentTrainer$ = this.state$.pipe(map(state => state.currentTrainer));
  public teams$ = this.state$.pipe(map(state => state.teams || []));
  public battles$ = this.state$.pipe(map(state => state.battles || []));
  public battleLogs$ = this.state$.pipe(map(state => state.battleLogs || []));
  public loading$ = this.state$.pipe(map(state => state.loading));
  public error$ = this.state$.pipe(map(state => state.error));

  /**
   * Fetches trainer profile by ID from local GraphQL server.
   *
   * @param id - Trainer ID to fetch
   * @returns Observable<Trainer> - Stream of trainer data
   */
  fetchTrainer(id: number): Observable<Trainer | null> {
    this.setLoading(true);
    
    return this.localApollo.query<any>({
      query: GET_TRAINER,
      variables: { id: String(id) },
      fetchPolicy: 'network-only'
    }).pipe(
      retry({ count: 3, delay: 1000 }),
      map((result) => {
        const raw = result?.data?.Trainer;
        const trainer = raw
          ? { ...raw, id: Number(raw.id), badge_count: Number(raw.badge_count) }
          : null;
        this.updateState({ currentTrainer: trainer, loading: false, error: null });
        return trainer;
      }),
      catchError((error) => {
        console.error('Error fetching trainer:', error);
        this.setError(error.message || 'Failed to fetch trainer');
        return of(null);
      })
    );
  }

  /**
   * Fetches all teams for a trainer.
   *
   * @param trainerId - Trainer ID to fetch teams for
   * @returns Observable<Team[]> - Stream of teams
   */
  fetchTeams(trainerId: number): Observable<Team[]> {
    this.setLoading(true);
    
    return this.localApollo.query<any>({
      query: GET_TEAMS,
      variables: { trainerId: String(trainerId) },
      fetchPolicy: 'network-only'
    }).pipe(
      retry({ count: 3, delay: 1000 }),
      map((result) => {
        const teams = (result?.data?.allTeams || []).map((t: Team) => this.normalizeTeam(t));
        this.updateState({ teams, loading: false, error: null });
        return teams;
      }),
      catchError((error) => {
        console.error('Error fetching teams:', error);
        this.setError(error.message || 'Failed to fetch teams');
        return of([]);
      })
    );
  }

  /**
   * Fetches all battles for a trainer.
   *
   * @param trainerId - Trainer ID to fetch battles for
   * @returns Observable<Battle[]> - Stream of battles
   */
  fetchBattles(trainerId: number): Observable<Battle[]> {
    this.setLoading(true);
    
    return this.localApollo.query<any>({
      query: GET_BATTLES,
      variables: { trainerId: String(trainerId) },
      fetchPolicy: 'network-only'
    }).pipe(
      retry({ count: 3, delay: 1000 }),
      map((result) => {
        const battles = (result?.data?.allBattles || []).map((b: Battle) => ({
          ...b,
          id: Number(b.id),
          trainer_id: Number(b.trainer_id),
          team_id: Number(b.team_id),
        }));
        this.updateState({ battles, loading: false, error: null });
        return battles;
      }),
      catchError((error) => {
        console.error('Error fetching battles:', error);
        this.setError(error.message || 'Failed to fetch battles');
        return of([]);
      })
    );
  }

  /**
   * Fetches all battle logs and stores them in state.
   *
   * @returns Observable<BattleLog[]> - Stream of battle logs
   */
  fetchBattleLogs(): Observable<BattleLog[]> {
    return this.queryBattleLogsFromApi().pipe(
      map((logs) => {
        this.updateState({ battleLogs: logs });
        if (logs.length > 0) {
          this.lastBattleLogId = Math.max(this.lastBattleLogId, ...logs.map((l) => l.id));
        }
        return logs;
      })
    );
  }

  /**
   * Resets the poll cursor so the next feed poll loads the full log list.
   */
  resetBattleLogPollCursor(): void {
    this.lastBattleLogId = 0;
  }

  /**
   * Simulates a live battle-log subscription via polling.
   * json-graphql-server has no WebSocket support; interval(5000) + switchMap polls
   * GET_BATTLE_LOGS once every 5s and appends only entries with id > lastBattleLogId.
   *
   * @param intervalMs - Poll interval in milliseconds (default 5000)
   * @returns Observable<BattleLog[]> - Emits batches of newly seen log entries
   */
  pollBattleLogFeed(intervalMs = 5000): Observable<BattleLog[]> {
    return interval(intervalMs).pipe(
      startWith(0),
      switchMap(() => this.queryBattleLogsFromApi()),
      map((logs) => {
        const previousHigh = this.lastBattleLogId;
        const newLogs = logs.filter((log) => log.id > previousHigh);

        if (previousHigh === 0 && logs.length > 0) {
          this.updateState({ battleLogs: logs });
          this.lastBattleLogId = Math.max(...logs.map((l) => l.id));
          return logs;
        }

        if (newLogs.length > 0) {
          this.lastBattleLogId = Math.max(previousHigh, ...newLogs.map((l) => l.id));
          const merged = [...(this.state$.value.battleLogs || []), ...newLogs];
          this.updateState({ battleLogs: merged });
          return newLogs;
        }

        return [];
      }),
      filter((batch) => batch.length > 0)
    );
  }

  /**
   * Queries battle logs from the local API without mutating poll cursor.
   *
   * @returns Observable<BattleLog[]> - Normalized log rows
   */
  private queryBattleLogsFromApi(): Observable<BattleLog[]> {
    return this.localApollo.query<any>({
      query: GET_BATTLE_LOGS,
      fetchPolicy: 'network-only',
    }).pipe(
      retry({ count: 3, delay: 1000 }),
      map((result) => {
        const raw = result?.data?.allBattleLogs ?? result?.data?.allBattle_log ?? [];
        return (Array.isArray(raw) ? raw : []).map((l: BattleLog) => ({
          ...l,
          id: Number(l.id),
          battle_id: Number(l.battle_id),
        }));
      }),
      catchError((error) => {
        console.error('Error fetching battle logs:', error);
        return of([]);
      })
    );
  }

  /**
   * Creates a new team with optimistic update.
   *
   * @param trainerId - Owner trainer ID
   * @param name - Team name
   * @param pokemonIds - Array of Pokémon IDs
   * @returns Observable<Team> - Stream of created team
   */
  createTeam(trainerId: number, name: string, pokemonIds: number[]): Observable<Team> {
    const optimisticTeam: Team = {
      id: Date.now(),
      trainer_id: trainerId,
      name,
      pokemon_ids: pokemonIds,
      created_at: new Date().toISOString()
    };
    
    const currentTeams = this.state$.value.teams || [];
    this.updateState({ teams: [...currentTeams, optimisticTeam] });

    if (!navigator.onLine) {
      this.mutationQueue.enqueue('createTeam', {
        trainer_id: String(trainerId),
        name,
        pokemon_ids: pokemonIds,
        created_at: optimisticTeam.created_at,
      });
      return of(optimisticTeam);
    }
    
    return this.localApollo.mutate<any>({
      mutation: CREATE_TEAM,
      variables: {
        trainer_id: String(trainerId),
        name,
        pokemon_ids: pokemonIds,
        created_at: new Date().toISOString()
      }
    }).pipe(
      map((result) => {
        if (result.errors?.length) {
          throw new Error(result.errors.map((e) => e.message).join(', '));
        }
        const newTeam = result?.data?.createTeam;
        if (!newTeam) {
          throw new Error('Failed to create team');
        }
        const normalized = this.normalizeTeam(newTeam);
        const teams = (this.state$.value.teams || []).filter((t) => t.id !== optimisticTeam.id);
        this.updateState({ teams: [...teams, normalized] });
        return normalized;
      }),
      catchError((error) => {
        this.updateState({ teams: currentTeams });
        console.error('Error creating team:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Updates an existing team.
   *
   * @param id - Team ID
   * @param name - New team name
   * @param pokemonIds - New Pokémon IDs array
   * @returns Observable<Team> - Stream of updated team
   */
  updateTeam(id: number, name: string, pokemonIds: number[]): Observable<Team> {
    const currentTeams = this.state$.value.teams || [];
    const optimisticTeams = currentTeams.map(t =>
      t.id === id ? { ...t, name, pokemon_ids: pokemonIds } : t
    );
    
    this.updateState({ teams: optimisticTeams });

    if (!navigator.onLine) {
      this.mutationQueue.enqueue('updateTeam', {
        id: String(id),
        name,
        pokemon_ids: pokemonIds,
      });
      return of(optimisticTeams.find((t) => t.id === id)!);
    }
    
    return this.localApollo.mutate<any>({
      mutation: UPDATE_TEAM,
      variables: { id: String(id), name, pokemon_ids: pokemonIds }
    }).pipe(
      map((result) => {
        const updatedTeam = result?.data?.updateTeam;
        if (updatedTeam) {
          const teams = (this.state$.value.teams || []).map(t =>
            t.id === id ? updatedTeam : t
          );
          this.updateState({ teams });
          return updatedTeam;
        }
        return optimisticTeams.find(t => t.id === id)!;
      }),
      catchError((error) => {
        this.updateState({ teams: currentTeams });
        console.error('Error updating team:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Deletes a team.
   *
   * @param id - Team ID to delete
   * @returns Observable<any> - Stream of delete result
   */
  deleteTeam(id: number): Observable<any> {
    const currentTeams = this.state$.value.teams || [];
    this.updateState({ teams: currentTeams.filter(t => t.id !== id) });

    if (!navigator.onLine) {
      this.mutationQueue.enqueue('deleteTeam', { id: String(id) });
      return of({ id });
    }
    
    return this.localApollo.mutate<any>({
      mutation: DELETE_TEAM,
      variables: { id: String(id) }
    }).pipe(
      catchError((error) => {
        this.updateState({ teams: currentTeams });
        console.error('Error deleting team:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Creates a battle log line on the mock server and appends it to the live feed.
   *
   * @param log - Log payload without id
   * @returns Observable<BattleLog>
   */
  createBattleLog(log: Omit<BattleLog, 'id'>): Observable<BattleLog> {
    const payload = {
      battle_id: log.battle_id,
      timestamp: log.timestamp,
      message: log.message,
      severity: log.severity,
    };

    if (!navigator.onLine) {
      const entry: BattleLog = { ...log, id: Date.now() + Math.floor(Math.random() * 1000) };
      this.appendBattleLogEntry(entry);
      this.mutationQueue.enqueue('createBattleLog', payload);
      return of(entry);
    }

    return this.localApollo.mutate<any>({
      mutation: CREATE_BATTLE_LOG,
      variables: payload,
    }).pipe(
      map((result) => {
        const raw = result?.data?.createBattleLog;
        if (!raw) {
          throw new Error('Failed to create battle log');
        }
        const entry: BattleLog = {
          ...raw,
          id: Number(raw.id),
          battle_id: Number(raw.battle_id),
        };
        this.appendBattleLogEntry(entry);
        return entry;
      }),
      catchError((error) => {
        console.error('Error creating battle log:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Appends a log entry to state and advances the poll cursor.
   *
   * @param entry - Battle log row
   */
  private appendBattleLogEntry(entry: BattleLog): void {
    const logs = [...(this.state$.value.battleLogs || []), entry];
    this.lastBattleLogId = Math.max(this.lastBattleLogId, entry.id);
    this.updateState({ battleLogs: logs });
  }

  /**
   * Builds default live-feed messages for a newly logged battle.
   *
   * @param battle - Created battle row
   * @returns Omit<BattleLog, 'id'>[] - Messages to persist
   */
  private buildAutoLogsForBattle(battle: Battle): Omit<BattleLog, 'id'>[] {
    const now = new Date().toISOString();
    const outcome =
      battle.result === 'win'
        ? `Victory against ${battle.opponent_name} (${battle.score_trainer}-${battle.score_opponent})!`
        : `Defeat against ${battle.opponent_name} (${battle.score_trainer}-${battle.score_opponent}).`;

    return [
      {
        battle_id: Number(battle.id),
        timestamp: now,
        message: `Battle vs ${battle.opponent_name} logged.`,
        severity: 'info',
      },
      {
        battle_id: Number(battle.id),
        timestamp: now,
        message: outcome,
        severity: battle.result === 'win' ? 'success' : 'danger',
      },
    ];
  }

  /**
   * Persists auto-generated feed lines for a battle.
   *
   * @param battle - Created battle
   * @returns Observable<BattleLog[]> - Created log entries
   */
  private autoGenerateLogsForBattle(battle: Battle): Observable<BattleLog[]> {
    const drafts = this.buildAutoLogsForBattle(battle);
    return forkJoin(drafts.map((draft) => this.createBattleLog(draft)));
  }

  /**
   * Logs a new battle result and auto-generates live feed entries.
   *
   * @param battle - Battle data to create
   * @returns Observable<Battle> - Stream of created battle
   */
  logBattle(battle: Omit<Battle, 'id'>): Observable<Battle> {
    if (!navigator.onLine) {
      const optimistic: Battle = { ...battle, id: Date.now() };
      const battles = [...(this.state$.value.battles || []), optimistic];
      this.updateState({ battles });
      this.mutationQueue.enqueue('createBattle', {
        trainer_id: String(battle.trainer_id),
        opponent_name: battle.opponent_name,
        team_id: String(battle.team_id),
        result: battle.result,
        date: battle.date,
        score_trainer: battle.score_trainer,
        score_opponent: battle.score_opponent,
      });
      this.autoGenerateLogsForBattle(optimistic).subscribe();
      return of(optimistic);
    }

    return this.localApollo.mutate<any>({
      mutation: CREATE_BATTLE,
      variables: {
        trainer_id: String(battle.trainer_id),
        opponent_name: battle.opponent_name,
        team_id: String(battle.team_id),
        result: battle.result,
        date: battle.date,
        score_trainer: battle.score_trainer,
        score_opponent: battle.score_opponent,
      },
    }).pipe(
      map((result) => {
        const newBattle = result?.data?.createBattle;
        if (!newBattle) {
          throw new Error('Failed to create battle');
        }
        const normalized: Battle = {
          ...newBattle,
          id: Number(newBattle.id),
          trainer_id: Number(newBattle.trainer_id),
          team_id: Number(newBattle.team_id),
        };
        const battles = [...(this.state$.value.battles || []), normalized];
        this.updateState({ battles });
        return normalized;
      }),
      switchMap((newBattle) =>
        this.autoGenerateLogsForBattle(newBattle).pipe(map(() => newBattle))
      ),
      catchError((error) => {
        console.error('Error logging battle:', error);
        return throwError(() => error);
      })
    );
  }

  /**
   * Updates trainer profile.
   *
   * @param trainer - Updated trainer data
   * @returns Observable<Trainer> - Stream of updated trainer
   */
  updateTrainerProfile(trainer: { id: number; name: string; region: string; avatar_url: string; rank: string }): Observable<Trainer> {
    const currentTrainer = this.state$.value.currentTrainer;
    this.updateState({
      currentTrainer: currentTrainer ? { ...currentTrainer, ...trainer } : null
    });

    if (!navigator.onLine) {
      this.mutationQueue.enqueue('updateTrainer', {
        id: String(trainer.id),
        name: trainer.name,
        region: trainer.region,
        avatar_url: trainer.avatar_url,
        rank: trainer.rank,
      });
      return of(this.state$.value.currentTrainer!);
    }
    
    return this.localApollo.mutate<any>({
      mutation: UPDATE_TRAINER,
      variables: {
        id: String(trainer.id),
        name: trainer.name,
        region: trainer.region,
        avatar_url: trainer.avatar_url,
        rank: trainer.rank
      }
    }).pipe(
      map((result) => {
        const updatedTrainer = result?.data?.updateTrainer;
        this.updateState({ currentTrainer: updatedTrainer });
        return updatedTrainer;
      }),
      catchError((error) => {
        this.updateState({ currentTrainer });
        console.error('Error updating trainer:', error);
        return throwError(() => error);
      })
    );
  }

  private setLoading(loading: boolean): void {
    this.updateState({ loading });
  }

  private setError(error: string | null): void {
    this.updateState({ error, loading: false });
  }

  private updateState(updates: Partial<TrainerState>): void {
    this.state$.next({ ...this.state$.value, ...updates });
  }

  /** Coerces GraphQL ID scalars (strings) into numeric app models. */
  private normalizeTeam(team: Team & { id: number | string }): Team {
    return {
      ...team,
      id: Number(team.id),
      trainer_id: Number(team.trainer_id),
      pokemon_ids: (team.pokemon_ids ?? []).map((id) => Number(id))
    };
  }

  getState(): TrainerState {
    return this.state$.value;
  }
}