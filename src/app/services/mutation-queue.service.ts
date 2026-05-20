import { Injectable, inject } from '@angular/core';
import { Observable, throwError, firstValueFrom } from 'rxjs';
import { Apollo } from 'apollo-angular';
import {
  CREATE_TEAM,
  UPDATE_TEAM,
  DELETE_TEAM,
  CREATE_BATTLE,
  CREATE_BATTLE_LOG,
  UPDATE_TRAINER,
} from '../core/graphql/local.queries';

export type QueuedMutationType =
  | 'createTeam'
  | 'updateTeam'
  | 'deleteTeam'
  | 'createBattle'
  | 'createBattleLog'
  | 'updateTrainer';

export interface QueuedMutation {
  id: string;
  type: QueuedMutationType;
  payload: Record<string, unknown>;
  createdAt: number;
}

const STORAGE_KEY = 'pokedex.pendingMutations';

/** Bonus 6: Queues local GraphQL mutations while offline; syncs on reconnect. */
@Injectable({ providedIn: 'root' })
export class MutationQueueService {
  private apollo = inject(Apollo);
  private localApollo = this.apollo.use('local');

  /**
   * Enqueues a mutation for later sync.
   *
   * @param type - Mutation kind
   * @param payload - GraphQL variables payload
   */
  enqueue(type: QueuedMutationType, payload: Record<string, unknown>): QueuedMutation {
    const entry: QueuedMutation = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      payload,
      createdAt: Date.now(),
    };
    const queue = this.readQueue();
    queue.push(entry);
    this.writeQueue(queue);
    return entry;
  }

  /**
   * Returns pending queued mutations.
   */
  getPending(): QueuedMutation[] {
    return this.readQueue();
  }

  /**
   * Flushes all pending mutations sequentially (last queued entry wins on conflict).
   */
  async flushAll(): Promise<number> {
    let synced = 0;
    const queue = [...this.readQueue()];
    for (const item of queue) {
      try {
        await firstValueFrom(this.runMutation(item));
        this.remove(item.id);
        synced++;
      } catch (err) {
        console.warn('Mutation sync failed (kept in queue):', item.type, err);
      }
    }
    return synced;
  }

  private runMutation(item: QueuedMutation): Observable<unknown> {
    switch (item.type) {
      case 'createTeam':
        return this.localApollo.mutate({ mutation: CREATE_TEAM, variables: item.payload });
      case 'updateTeam':
        return this.localApollo.mutate({ mutation: UPDATE_TEAM, variables: item.payload });
      case 'deleteTeam':
        return this.localApollo.mutate({ mutation: DELETE_TEAM, variables: item.payload });
      case 'createBattle':
        return this.localApollo.mutate({ mutation: CREATE_BATTLE, variables: item.payload });
      case 'createBattleLog':
        return this.localApollo.mutate({ mutation: CREATE_BATTLE_LOG, variables: item.payload });
      case 'updateTrainer':
        return this.localApollo.mutate({ mutation: UPDATE_TRAINER, variables: item.payload });
      default:
        return throwError(() => new Error(`Unknown mutation: ${item.type}`));
    }
  }

  private readQueue(): QueuedMutation[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
    } catch {
      return [];
    }
  }

  private writeQueue(queue: QueuedMutation[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  }

  private remove(id: string): void {
    this.writeQueue(this.readQueue().filter((q) => q.id !== id));
  }
}
