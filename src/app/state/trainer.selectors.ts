import { Injectable, inject } from '@angular/core';
import { Observable, combineLatest, map, distinctUntilChanged, shareReplay } from 'rxjs';
import { TrainerStore } from './trainer.store';

export interface TrainerDashboardStats {
  winRate: number;
  wins: number;
  losses: number;
  total: number;
}

@Injectable({ providedIn: 'root' })
export class TrainerSelectors {
  private trainerStore = inject(TrainerStore);

  /**
   * Calculates win rate for the current trainer.
   *
   * @returns Observable<number> - Win rate percentage
   */
  getWinRate(): Observable<number> {
    return this.trainerStore.battles$.pipe(
      map((battles) => {
        if (battles.length === 0) return 0;
        const wins = battles.filter((b) => b.result === 'win').length;
        return (wins / battles.length) * 100;
      }),
      distinctUntilChanged()
    );
  }

  /**
   * Gets battle history grouped by month with win/loss counts.
   *
   * @returns Observable<Array<{month: string; wins: number; losses: number}>> - Monthly battle stats
   */
  getMonthlyBattleStats(): Observable<Array<{ month: string; wins: number; losses: number }>> {
    return this.trainerStore.battles$.pipe(
      map((battles) => {
        const monthlyStats = new Map<string, { wins: number; losses: number }>();

        battles.forEach((battle) => {
          const month = battle.date.substring(0, 7);
          const stats = monthlyStats.get(month) || { wins: 0, losses: 0 };

          if (battle.result === 'win') {
            stats.wins++;
          } else {
            stats.losses++;
          }

          monthlyStats.set(month, stats);
        });

        return Array.from(monthlyStats.entries()).map(([month, stats]) => ({
          month,
          wins: stats.wins,
          losses: stats.losses,
        }));
      }),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b))
    );
  }

  /**
   * Gets total battle count.
   *
   * @returns Observable<number> - Total battles
   */
  getTotalBattles(): Observable<number> {
    return this.trainerStore.battles$.pipe(
      map((battles) => battles.length),
      distinctUntilChanged()
    );
  }

  /**
   * Gets win count.
   *
   * @returns Observable<number> - Number of wins
   */
  getWinCount(): Observable<number> {
    return this.trainerStore.battles$.pipe(
      map((battles) => battles.filter((b) => b.result === 'win').length),
      distinctUntilChanged()
    );
  }

  /**
   * Gets loss count.
   *
   * @returns Observable<number> - Number of losses
   */
  getLossCount(): Observable<number> {
    return this.trainerStore.battles$.pipe(
      map((battles) => battles.filter((b) => b.result === 'loss').length),
      distinctUntilChanged()
    );
  }

  /**
   * Combines trainer battle metrics into one derived stream for dashboards.
   *
   * @returns Observable<TrainerDashboardStats> - Aggregated trainer stats
   */
  getTrainerDashboardStats(): Observable<TrainerDashboardStats> {
    return combineLatest([
      this.getWinRate(),
      this.getWinCount(),
      this.getLossCount(),
      this.getTotalBattles(),
    ]).pipe(
      map(([winRate, wins, losses, total]) => ({ winRate, wins, losses, total })),
      distinctUntilChanged(
        (a, b) =>
          a.winRate === b.winRate &&
          a.wins === b.wins &&
          a.losses === b.losses &&
          a.total === b.total
      ),
      shareReplay(1)
    );
  }
}
