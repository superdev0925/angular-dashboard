import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { TrainerSelectors } from './trainer.selectors';
import { TrainerStore, Battle } from './trainer.store';

describe('TrainerSelectors', () => {
  let selectors: TrainerSelectors;
  const battles$ = new BehaviorSubject<Battle[]>([
    { id: 1, trainer_id: 1, opponent_name: 'A', team_id: 1, result: 'win', date: '2024-06-01', score_trainer: 3, score_opponent: 1 },
    { id: 2, trainer_id: 1, opponent_name: 'B', team_id: 1, result: 'loss', date: '2024-07-01', score_trainer: 1, score_opponent: 3 },
  ]);

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrainerSelectors,
        {
          provide: TrainerStore,
          useValue: { battles$ },
        },
      ],
    });
    selectors = TestBed.inject(TrainerSelectors);
  });

  it('should compute win rate', (done) => {
    selectors.getWinRate().subscribe((rate) => {
      expect(rate).toBe(50);
      done();
    });
  });

  it('should combine dashboard stats with combineLatest', (done) => {
    selectors.getTrainerDashboardStats().subscribe((stats) => {
      expect(stats.wins).toBe(1);
      expect(stats.losses).toBe(1);
      expect(stats.total).toBe(2);
      expect(stats.winRate).toBe(50);
      done();
    });
  });
});
