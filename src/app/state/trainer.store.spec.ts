import { TestBed } from '@angular/core/testing';
import { Apollo } from 'apollo-angular';
import { of } from 'rxjs';
import { TrainerStore } from './trainer.store';

describe('TrainerStore', () => {
  let store: TrainerStore;
  const localApollo = {
    query: jasmine.createSpy('query').and.returnValue(of({ data: { allBattleLogs: [] } })),
    mutate: jasmine.createSpy('mutate')
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrainerStore,
        {
          provide: Apollo,
          useValue: {
            use: () => localApollo
          }
        }
      ]
    });
    store = TestBed.inject(TrainerStore);
  });

  it('fetchBattleLogs updates state from allBattleLogs', (done) => {
    localApollo.query.and.returnValue(
      of({
        data: {
          allBattleLogs: [
            { id: 1, battle_id: 1, timestamp: '2024-06-01T10:01:00Z', message: 'Test', severity: 'info' }
          ]
        }
      })
    );

    store.fetchBattleLogs().subscribe((logs) => {
      expect(logs.length).toBe(1);
      expect(store.getState().battleLogs[0].message).toBe('Test');
      done();
    });
  });
});
