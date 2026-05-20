import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { TeamCoverageInput, TeamCoverageResult } from '../workers/stats-analysis.worker';

/**
 * Runs heavy team coverage analysis off the main thread via Web Worker.
 */
@Injectable({ providedIn: 'root' })
export class StatsAnalysisService {
  private worker: Worker | null = null;

  /**
   * Analyzes which types a team hits super-effectively using a Web Worker.
   *
   * @param teamTypes - Pokémon types on the current team
   * @returns Observable<TeamCoverageResult> - Coverage summary and timing
   */
  analyzeTeamCoverage(teamTypes: string[]): Observable<TeamCoverageResult> {
    return new Observable((subscriber) => {
      if (typeof Worker === 'undefined') {
        subscriber.error(new Error('Web Workers are not supported in this environment'));
        return;
      }

      const worker = this.getWorker();
      const payload: TeamCoverageInput = { teamTypes, allPokemonTypes: [] };

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
   * Lazily creates the stats analysis worker instance.
   *
   * @returns Worker - Singleton worker reference
   */
  private getWorker(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/stats-analysis.worker', import.meta.url),
        { type: 'module' }
      );
    }
    return this.worker;
  }
}
