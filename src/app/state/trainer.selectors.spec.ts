import { TestBed } from '@angular/core/testing';
import { BehaviorSubject } from 'rxjs';
import { TrainerSelectors } from './trainer.selectors';
import { TrainerStore, Battle } from './trainer.store';

describe('TrainerSelectors', () => {
  let selectors: TrainerSelectors;
  const battles$ = new BehaviorSubject<Battle[]>([
    { id: 1, trainer_id: 1, opponent_name: 'Gary', team_id: 1, result: 'win', date: '2024-06-01', score_trainer: 3, score_opponent: 1 },
    { id: 2, trainer_id: 1, opponent_name: 'Cynthia', team_id: 1, result: 'loss', date: '2024-06-15', score_trainer: 1, score_opponent: 3 },
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

  it('getWinRate returns percentage of wins', (done) => {
    selectors.getWinRate().subscribe((rate) => {
      expect(rate).toBe(50);
      done();
    });
  });
});
