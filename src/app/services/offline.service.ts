import { Injectable, computed, inject, DestroyRef, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { fromEvent, merge, of } from 'rxjs';
import { map, startWith, tap } from 'rxjs/operators';
import { MutationQueueService } from './mutation-queue.service';

/** Bonus 6: Tracks browser online/offline state via navigator.onLine + window events. */
@Injectable({ providedIn: 'root' })
export class OfflineService {
  private destroyRef = inject(DestroyRef);
  private mutationQueue = inject(MutationQueueService);

  /** True when the browser reports network connectivity. */
  readonly isOnline = toSignal(
    merge(
      of(navigator.onLine),
      fromEvent(window, 'online').pipe(map(() => true)),
      fromEvent(window, 'offline').pipe(map(() => false))
    ).pipe(startWith(navigator.onLine)),
    { initialValue: navigator.onLine }
  );

  readonly isOffline = computed(() => !this.isOnline());

  pendingMutationCount = signal(0);

  constructor() {
    this.refreshPendingCount();
    merge(fromEvent(window, 'online'), fromEvent(window, 'offline'))
      .pipe(
        tap(() => this.refreshPendingCount()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();

    fromEvent(window, 'online')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.syncPendingMutations();
      });
  }

  /**
   * Re-reads queued mutation count from storage.
   */
  refreshPendingCount(): void {
    this.pendingMutationCount.set(this.mutationQueue.getPending().length);
  }

  /**
   * Syncs queued mutations when connectivity returns.
   */
  async syncPendingMutations(): Promise<number> {
    if (!navigator.onLine) {
      return 0;
    }
    const synced = await this.mutationQueue.flushAll();
    this.refreshPendingCount();
    return synced;
  }
}
