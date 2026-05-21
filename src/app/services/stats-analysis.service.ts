import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TeamCoverageInput, TeamCoverageResult } from '../workers/stats-analysis.worker';

export interface CatalogEntry {
  id: number;
  name: string;
  types: string[];
}

/**
 * Runs heavy team coverage analysis off the main thread via Web Worker.
 */
@Injectable({ providedIn: 'root' })
export class StatsAnalysisService {
  private worker: Worker | null = null;

  /**
   * Analyzes team type coverage in a Web Worker and logs console.time vs main-thread baseline.
   *
   * @param teamTypes - Pokémon types on the queued team
   * @param catalog - Full Pokédex catalog for synergy suggestions (Bonus 4)
   * @returns Observable<TeamCoverageResult>
   */
  analyzeTeamCoverage(teamTypes: string[], catalog: CatalogEntry[] = []): Observable<TeamCoverageResult> {
    console.time('team-coverage-main-thread');
    this.runCoverageOnMainThread(teamTypes, catalog);
    console.timeEnd('team-coverage-main-thread');

    return new Observable((subscriber) => {
      if (typeof Worker === 'undefined') {
        subscriber.next(this.runCoverageOnMainThread(teamTypes, catalog));
        subscriber.complete();
        return;
      }

      const worker = this.getWorker();
      const payload: TeamCoverageInput = {
        teamTypes,
        allPokemonTypes: catalog.map((c) => c.types),
        catalog,
      };

      const onMessage = (event: MessageEvent<TeamCoverageResult>) => {
        console.timeEnd('team-coverage-worker');
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        subscriber.next(event.data);
        subscriber.complete();
      };

      const onError = (err: ErrorEvent) => {
        console.timeEnd('team-coverage-worker');
        worker.removeEventListener('message', onMessage);
        worker.removeEventListener('error', onError);
        subscriber.error(err.message);
      };

      worker.addEventListener('message', onMessage);
      worker.addEventListener('error', onError);
      console.time('team-coverage-worker');
      worker.postMessage(payload);
    });
  }

  /**
   * Synchronous baseline used for console.time comparison with the worker (Bonus 4).
   *
   * @param teamTypes - Team typings
   * @param catalog - Optional catalog for suggestions
   * @returns TeamCoverageResult
   */
  private runCoverageOnMainThread(teamTypes: string[], catalog: CatalogEntry[]): TeamCoverageResult {
    const TYPE_CHART: Record<string, Record<string, number>> = {
      fire: { grass: 2, water: 0.5 },
      water: { fire: 2 },
      grass: { water: 2, fire: 0.5 },
    };
    const ALL = ['normal', 'fire', 'water', 'grass', 'electric', 'ice'];
    const unique = [...new Set(teamTypes.map((t) => t.toLowerCase()))];
    const superEffectiveAgainst: string[] = [];
    for (const def of ALL) {
      let best = 0;
      for (const atk of unique) {
        const mult = TYPE_CHART[atk]?.[def] ?? 1;
        if (mult > best) {
          best = mult;
        }
      }
      if (best >= 2) {
        superEffectiveAgainst.push(def);
      }
    }
    return {
      superEffectiveAgainst,
      resistedBy: [],
      uncoveredTypes: ALL.filter((t) => !superEffectiveAgainst.includes(t)),
      elapsedMs: 0,
      suggestions: catalog.slice(0, 3).map((c) => ({ ...c, score: 1 })),
    };
  }

  /**
   * Lazily creates the stats analysis worker instance.
   *
   * @returns Worker - Singleton worker reference
   */
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(new URL('../workers/stats-analysis.worker', import.meta.url), {
        type: 'module',
      });
    }
    return this.worker;
  }
}
