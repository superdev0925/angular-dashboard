import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TrainerStore } from '../../state/trainer.store';
import { TrainerSelectors } from '../../state/trainer.selectors';

@Component({
  selector: 'app-battles-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="battles-page">
      <h1>Battle Log</h1>
      <div class="stats-cards">
        <div class="stat-card">
          <h3>Win Rate</h3>
          <p class="stat-value">{{ winRate() | number:'1.0-0' }}%</p>
        </div>
        <div class="stat-card">
          <h3>Total Battles</h3>
          <p class="stat-value">{{ totalBattles() }}</p>
        </div>
        <div class="stat-card">
          <h3>Wins</h3>
          <p class="stat-value wins">{{ wins() }}</p>
        </div>
        <div class="stat-card">
          <h3>Losses</h3>
          <p class="stat-value losses">{{ losses() }}</p>
        </div>
      </div>
      
      <div class="battle-table">
        <table>
          <thead>
            <tr><th>Date</th><th>Opponent</th><th>Team</th><th>Result</th><th>Score</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let battle of battles()" [class.win]="battle.result === 'win'" [class.loss]="battle.result === 'loss'">
              <td>{{ battle.date }}</td>
              <td>{{ battle.opponent_name }}</td>
              <td>{{ getTeamName(battle.team_id) }}</td>
              <td>{{ battle.result | uppercase }}</td>
              <td>{{ battle.score_trainer }} - {{ battle.score_opponent }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .battles-page { padding: 20px; }
    .stats-cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
    .stat-card { background: white; padding: 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; margin: 10px 0; }
    .wins { color: #4caf50; }
    .losses { color: #f44336; }
    .battle-table { background: white; border-radius: 10px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #f5f5f5; font-weight: 600; }
    tr.win { background: rgba(76, 175, 80, 0.1); }
    tr.loss { background: rgba(244, 67, 54, 0.1); }
  `]
})
export class BattlesPageComponent implements OnInit {
  private trainerStore = inject(TrainerStore);
  private trainerSelectors = inject(TrainerSelectors);
  
  battles = signal<any[]>([]);
  winRate = signal(0);
  totalBattles = signal(0);
  wins = signal(0);
  losses = signal(0);
  
  ngOnInit() {
    this.trainerStore.battles$.subscribe(battles => {
      this.battles.set(battles);
      this.totalBattles.set(battles.length);
      this.wins.set(battles.filter(b => b.result === 'win').length);
      this.losses.set(battles.filter(b => b.result === 'loss').length);
    });
    
    this.trainerSelectors.getWinRate().subscribe(rate => {
      this.winRate.set(rate);
    });
    
    this.trainerStore.fetchBattles(1).subscribe();
  }
  
  getTeamName(teamId: number): string {
    const teams = this.trainerStore.getState().teams;
    const team = teams.find(t => t.id === teamId);
    return team?.name || 'Unknown';
  }
}