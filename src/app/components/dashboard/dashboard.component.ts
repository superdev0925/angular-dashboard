import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Pokemon } from '../../state/pokemon.store';
import { Battle, Team } from '../../state/trainer.store';
import { PokemonSelectors } from '../../state/pokemon.selectors';
import { RadarChartComponent } from '../charts/radar-chart/radar-chart.component';
import { LineChartComponent } from '../charts/line-chart/line-chart.component';
import { DoughnutChartComponent } from '../charts/doughnut-chart/doughnut-chart.component';
import { DEFAULT_TRAINER_AVATAR, resolveOpponentAvatarUrl } from '../../utils/avatar-url';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, RadarChartComponent, LineChartComponent, DoughnutChartComponent],
  template: `
    <div class="dashboard-shell">
      <section class="hero-banner">
        <div class="hero-bg"></div>
        <div class="hero-content">
          <div class="hero-text">
            <h1>Welcome back, {{ trainerName() }}! 👋</h1>
            <p>Your Pokémon journey continues. Ready for your next battle?</p>
          </div>
          <div class="hero-rings">
            <div class="ring-card">
              <div class="ring purple" [style.--pct]="pokemonRingPct + '%'">
                <span>{{ pokemonRingPct | number:'1.0-0' }}%</span>
              </div>
              <span class="ring-label">Pokémon Completion</span>
            </div>
            <div class="ring-card">
              <div class="ring gray" [style.--pct]="winRate() + '%'">
                <span>{{ winRate() | number:'1.0-0' }}%</span>
              </div>
              <span class="ring-label">Win Rate</span>
            </div>
          </div>
        </div>
        <img
          class="hero-gengar"
          src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/94.png"
          alt="Gengar"
        />
      </section>

      <div class="stats-grid">
        <div class="stat-card glass">
          <div class="stat-icon purple">⚔</div>
          <div class="stat-body">
            <span class="stat-title">Total Battles</span>
            <p class="stat-value">{{ displayBattles }}</p>
            <span class="trend up">+12% vs last month</span>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon green">✓</div>
          <div class="stat-body">
            <span class="stat-title">Wins</span>
            <p class="stat-value">{{ displayWins }}</p>
            <span class="trend up">+8% vs last month</span>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon red">✗</div>
          <div class="stat-body">
            <span class="stat-title">Losses</span>
            <p class="stat-value">{{ displayLosses }}</p>
            <span class="trend down">-5% vs last month</span>
          </div>
        </div>
        <div class="stat-card glass">
          <div class="stat-icon gold">★</div>
          <div class="stat-body">
            <span class="stat-title">Teams</span>
            <p class="stat-value">{{ displayTeams }}</p>
            <span class="trend up">+2 vs last month</span>
          </div>
        </div>
      </div>

      <div class="charts-row three-col">
        <div class="chart-card glass">
          <div class="chart-header">
            <h3>Pokémon Stats Radar</h3>
            <select class="chart-select" [ngModel]="chartPokemonId()" (ngModelChange)="onChartPokemonChange($event)">
              <option *ngFor="let p of chartPokemonOptions()" [ngValue]="p.id">{{ p.name | titlecase }}</option>
            </select>
          </div>
          <div class="chart-body">
            <app-radar-chart
              [stats]="chartPokemonStats()"
              [pokemonName]="chartPokemonName()"
              [dark]="chartDark()"
              [animate]="true">
            </app-radar-chart>
          </div>
        </div>
        <div class="chart-card glass">
          <div class="chart-header">
            <h3>Battle Performance</h3>
            <select
              class="chart-select"
              [ngModel]="battleChartPeriod()"
              (ngModelChange)="onBattleChartPeriodChange($event)">
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
            </select>
          </div>
          <div class="chart-body">
            <app-line-chart
              [battles]="battles()"
              [period]="battleChartPeriod()"
              [animate]="true">
            </app-line-chart>
          </div>
        </div>
        <div class="chart-card glass outcome-card">
          <div class="chart-header">
            <h3>Battle Outcome</h3>
          </div>
          <div class="outcome-layout">
            <div class="chart-body doughnut-wrap">
              <app-doughnut-chart
                variant="battle"
                [wins]="displayWins"
                [losses]="displayLosses"
                [dark]="chartDark()"
                [animate]="true"
                [showLegend]="false">
              </app-doughnut-chart>
              <div class="doughnut-center">
                <strong>{{ displayBattles }}</strong>
                <span>Total Battles</span>
              </div>
            </div>
            <div class="outcome-legend">
              <span><i class="dot purple"></i> Wins {{ displayWins }} ({{ winPct | number:'1.1-1' }}%)</span>
              <span><i class="dot pink"></i> Losses {{ displayLosses }} ({{ lossPct | number:'1.1-1' }}%)</span>
            </div>
          </div>
        </div>
      </div>

      <div class="bottom-row">
        <div class="panel glass recent-battles">
          <div class="panel-header">
            <h3>Recent Battles</h3>
            <button type="button" class="link-btn" (click)="viewAllBattles.emit()">View All</button>
          </div>
          <div class="table-scroll" role="region" aria-label="Recent battles" tabindex="0">
          <table>
            <thead>
              <tr>
                <th>Opponent</th>
                <th>Result</th>
                <th>Pokémon</th>
                <th>Type</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let battle of recentBattles()">
                <td class="opponent">
                  <img
                    [src]="opponentAvatar(battle.opponent_name)"
                    [alt]="battle.opponent_name"
                    (error)="onOpponentAvatarError($event)">
                  <div>
                    <strong>{{ battle.opponent_name }}</strong>
                    <span class="sub">{{ opponentSubtitle(battle.opponent_name) }}</span>
                  </div>
                </td>
                <td>
                  <span class="result" [class.win]="battle.result === 'win'">
                    {{ battle.result === 'win' ? 'Victory' : 'Defeat' }}
                    {{ battle.score_trainer }}-{{ battle.score_opponent }}
                  </span>
                </td>
                <td class="sprites">
                  <img
                    *ngFor="let id of battlePokemonIds(battle)"
                    [src]="'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/' + id + '.png'"
                    alt="">
                </td>
                <td>
                  <span *ngFor="let t of battleTypes(battle)" class="type-pill" [style.background]="typeColor(t)">{{ t }}</span>
                </td>
                <td class="muted">{{ formatRelative(battle.date) }}</td>
              </tr>
              <tr *ngIf="!recentBattles().length">
                <td colspan="5" class="empty">No battles yet — log one from Battle Log.</td>
              </tr>
            </tbody>
          </table>
          </div>
        </div>

        <div class="panel glass badges-panel">
          <div class="panel-header">
            <h3>Badges</h3>
            <button type="button" class="link-btn" (click)="viewAllProfile.emit()">View All</button>
          </div>
          <div class="badges-grid">
            <div
              *ngFor="let badge of gymBadges(); let i = index"
              class="badge-tile"
              [class.earned]="i < badgeCount()"
              [title]="badge">
              <span class="badge-emoji">🏅</span>
              <span class="badge-name">{{ badge }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-shell {
      color: var(--dash-text);
      width: 100%;
    }

    .glass {
      background: var(--dash-card);
      border: 1px solid var(--dash-border);
      border-radius: 16px;
      backdrop-filter: blur(12px);
      transition: border-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease;
    }

    .chart-select:hover {
      border-color: var(--primary);
    }

    .hero-banner {
      position: relative;
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 24px;
      min-height: 200px;
      border: 1px solid var(--dash-border);
    }

    .hero-bg {
      position: absolute;
      inset: 0;
      background: var(--dashboard-hero-bg);
    }

    .hero-content {
      position: relative;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 28px 32px;
      gap: 24px;
      flex-wrap: wrap;
    }

    .hero-text h1 {
      font-size: 1.65rem;
      font-weight: 700;
      margin-bottom: 8px;
    }

    .hero-text p {
      color: var(--dash-muted);
      font-size: 14px;
      max-width: 420px;
    }

    .hero-rings {
      display: flex;
      gap: 20px;
    }

    .ring-card {
      text-align: center;
      background: var(--ring-card-bg);
      border: 1px solid var(--dash-border);
      border-radius: 12px;
      padding: 12px 16px;
    }

    .ring {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      margin: 0 auto 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      position: relative;
    }

    .ring.purple {
      background: conic-gradient(#a78bfa var(--pct), rgba(148, 163, 184, 0.2) 0);
    }

    .ring.gray {
      background: conic-gradient(#64748b var(--pct), rgba(148, 163, 184, 0.2) 0);
    }

    .ring::before {
      content: '';
      position: absolute;
      inset: 5px;
      border-radius: 50%;
      background: var(--ring-inner-bg);
    }

    .ring span {
      position: relative;
      z-index: 1;
      color: var(--ring-label-color);
      font-weight: 700;
      font-size: 13px;
    }

    .ring-label {
      font-size: 11px;
      color: var(--dash-muted);
    }

    .hero-gengar {
      position: absolute;
      right: 24px;
      bottom: -8px;
      width: 160px;
      height: 160px;
      object-fit: contain;
      z-index: 2;
      filter: drop-shadow(0 0 24px rgba(124, 58, 237, 0.6));
      pointer-events: none;
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    @media (max-width: 1100px) {
      .stats-grid { grid-template-columns: repeat(2, 1fr); }
    }

    @media (max-width: 640px) {
      .stats-grid { grid-template-columns: 1fr; }
      .hero-gengar { width: 110px; height: 110px; right: 8px; opacity: 0.85; }
      .hero-rings { width: 100%; justify-content: center; }
      .badges-grid { grid-template-columns: repeat(3, 1fr); }
    }

    .stat-card {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 20px;
      min-width: 0;
    }

    .stat-body {
      flex: 1;
      min-width: 0;
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      min-width: 48px;
      flex-shrink: 0;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      font-weight: 700;
    }

    .stat-icon.purple { background: rgba(124, 58, 237, 0.25); color: #a78bfa; }
    .stat-icon.green { background: rgba(16, 185, 129, 0.2); color: #34d399; }
    .stat-icon.red { background: rgba(239, 68, 68, 0.2); color: #f87171; }
    .stat-icon.gold { background: rgba(245, 158, 11, 0.2); color: #fbbf24; }

    .stat-title {
      display: block;
      font-size: 13px;
      color: var(--dash-muted);
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      margin: 0 0 4px;
    }

    .trend {
      font-size: 12px;
      font-weight: 500;
    }

    .trend.up { color: var(--trend-up-color); }
    .trend.down { color: var(--trend-down-color); }

    .charts-row {
      display: grid;
      gap: 16px;
      margin-bottom: 24px;
    }

    .charts-row.three-col {
      grid-template-columns: repeat(3, 1fr);
    }

    .charts-row .chart-card {
      animation: cardSlideIn 0.55s ease-out both;
    }

    .charts-row .chart-card:nth-child(1) { animation-delay: 0.05s; }
    .charts-row .chart-card:nth-child(2) { animation-delay: 0.15s; }
    .charts-row .chart-card:nth-child(3) { animation-delay: 0.25s; }

    @keyframes cardSlideIn {
      from {
        opacity: 0;
        transform: translateY(16px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .doughnut-center {
      animation: centerPop 0.6s ease-out 0.9s both;
    }

    @keyframes centerPop {
      from {
        opacity: 0;
        transform: translate(-50%, -50%) scale(0.6);
      }
      to {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1);
      }
    }

    @media (max-width: 1200px) {
      .charts-row.three-col { grid-template-columns: 1fr; }
    }

    .chart-card {
      padding: 20px;
    }

    .chart-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }

    .chart-header h3 {
      font-size: 15px;
      font-weight: 600;
      margin: 0;
    }

    .chart-select {
      background: var(--surface-deep);
      border: 1px solid var(--dash-border);
      color: var(--dash-text);
      border-radius: 8px;
      padding: 6px 10px;
      font-size: 12px;
      cursor: pointer;
    }

    .chart-body {
      min-height: 260px;
    }

    .outcome-card .chart-body {
      min-height: 0;
    }

    .outcome-layout {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    .doughnut-wrap {
      position: relative;
      width: 100%;
      max-width: 260px;
      margin: 0 auto;
      --doughnut-size: 220px;
      min-height: 220px;
    }

    .doughnut-center {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      text-align: center;
      pointer-events: none;
    }

    .doughnut-center strong {
      display: block;
      font-size: 1.5rem;
      color: var(--text-heading);
    }

    .doughnut-center span {
      font-size: 11px;
      color: var(--dash-muted);
    }

    .outcome-legend {
      display: flex;
      flex-direction: column;
      gap: 8px;
      font-size: 13px;
      color: var(--dash-muted);
      width: 100%;
      max-width: 260px;
      padding: 0 8px;
    }

    .outcome-legend span {
      display: flex;
      align-items: center;
      white-space: nowrap;
    }

    .dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      border-radius: 50%;
      margin-right: 6px;
    }

    .dot.purple { background: #7c3aed; }
    .dot.pink { background: #f472b6; }

    .bottom-row {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 16px;
    }

    @media (max-width: 1000px) {
      .bottom-row { grid-template-columns: 1fr; }
    }

    .panel {
      padding: 20px;
    }

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }

    .panel-header h3 {
      margin: 0;
      font-size: 15px;
    }

    .link-btn {
      background: none;
      border: none;
      color: #a78bfa;
      font-size: 13px;
      cursor: pointer;
      font-weight: 500;
    }

    .table-scroll {
      width: 100%;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      border-radius: 8px;
    }

    .table-scroll::-webkit-scrollbar {
      height: 6px;
    }

    table {
      width: 100%;
      min-width: 560px;
      border-collapse: collapse;
      font-size: 13px;
    }

    th {
      text-align: left;
      color: var(--dash-muted);
      font-size: 11px;
      text-transform: uppercase;
      font-weight: 600;
      padding: 8px 10px;
      border-bottom: 1px solid var(--dash-border);
      white-space: nowrap;
    }

    td {
      padding: 12px 10px;
      border-bottom: 1px solid var(--dash-border);
      vertical-align: middle;
    }

    tbody tr {
      transition: background-color 0.2s ease;
    }

    tbody tr:hover {
      background: var(--table-row-hover);
    }

    tr:last-child td { border-bottom: none; }

    .opponent {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .opponent img {
      width: 36px;
      height: 36px;
      border-radius: 50%;
    }

    .opponent .sub {
      display: block;
      font-size: 11px;
      color: var(--dash-muted);
    }

    .result.win { color: #34d399; font-weight: 600; }
    .result:not(.win) { color: #f87171; font-weight: 600; }

    .sprites {
      white-space: nowrap;
    }

    .sprites img {
      width: 28px;
      height: 28px;
      margin-right: 2px;
      image-rendering: pixelated;
      vertical-align: middle;
    }

    .type-pill {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 10px;
      text-transform: capitalize;
      color: white;
      margin-right: 4px;
    }

    .muted { color: var(--dash-muted); white-space: nowrap; }

    .empty {
      text-align: center;
      color: var(--dash-muted);
      padding: 24px !important;
    }

    .badges-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(72px, 1fr));
      gap: 12px;
    }

    @media (max-width: 1000px) {
      .recent-battles .opponent strong {
        font-size: 12px;
      }
    }

    .badge-tile {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      padding: 12px 8px;
      border-radius: 12px;
      background: var(--badge-tile-bg);
      border: 1px solid var(--badge-tile-border);
      opacity: 0.55;
    }

    .badge-tile.earned {
      opacity: 1;
      background: var(--badge-tile-earned-bg);
      border-color: var(--primary);
      box-shadow: 0 0 12px var(--primary-light);
    }

    .badge-emoji { font-size: 22px; }
    .badge-name {
      font-size: 10px;
      color: var(--badge-tile-text);
      text-align: center;
      font-weight: 500;
    }
  `],
})
export class DashboardComponent {
  trainerName = input<string>('Ash');
  chartDark = input(false);
  pokemonCount = input<number>(0);
  winRate = input<number>(0);
  totalBattles = input<number>(0);
  wins = input<number>(0);
  losses = input<number>(0);
  teamCount = input<number>(0);
  selectedPokemon = input<Pokemon | null>(null);
  chartPokemonOptions = input<Pokemon[]>([]);
  battles = input<Battle[]>([]);
  teams = input<Team[]>([]);
  recentBattles = input<Battle[]>([]);
  gymBadges = input<string[]>([]);
  badgeCount = input<number>(0);

  chartPokemonChange = output<number>();
  viewAllBattles = output<void>();
  viewAllProfile = output<void>();

  private pokemonSelectors = inject(PokemonSelectors);

  chartPokemonId = signal(1);
  battleChartPeriod = signal<'monthly' | 'weekly'>('monthly');

  chartPokemon = computed((): Pokemon | null => {
    const id = this.chartPokemonId();
    const options = this.chartPokemonOptions();
    return options.find((p) => p.id === id) ?? options[0] ?? this.selectedPokemon();
  });

  /** Display name for radar chart (avoids optional chaining in template). */
  chartPokemonName = computed(() => {
    const p = this.chartPokemon();
    return p?.name ?? 'Pokémon';
  });

  chartPokemonStats = computed(() => {
    const p = this.chartPokemon();
    if (!p?.stats?.length) {
      return [0, 0, 0, 0, 0, 0];
    }
    return this.pokemonSelectors.getStatsForRadar(p);
  });

  constructor() {
    effect(
      () => {
        const options = this.chartPokemonOptions();
        const selected = this.selectedPokemon();
        const currentId = this.chartPokemonId();

        if (selected?.id && options.some((p) => p.id === selected.id)) {
          this.chartPokemonId.set(selected.id);
          return;
        }

        if (options.length && !options.some((p) => p.id === currentId)) {
          this.chartPokemonId.set(options[0].id);
        }
      },
      { allowSignalWrites: true }
    );
  }

  get pokemonRingPct(): number {
    const nationalDexTarget = 1025;
    return Math.min(100, (this.pokemonCount() / nationalDexTarget) * 100);
  }

  get displayBattles(): number {
    return this.totalBattles();
  }

  get displayWins(): number {
    return this.wins();
  }

  get displayLosses(): number {
    return this.losses();
  }

  get displayTeams(): number {
    return this.teamCount();
  }

  get winPct(): number {
    const t = this.displayWins + this.displayLosses;
    return t ? (this.displayWins / t) * 100 : 0;
  }

  get lossPct(): number {
    const t = this.displayWins + this.displayLosses;
    return t ? (this.displayLosses / t) * 100 : 0;
  }

  onChartPokemonChange(id: number): void {
    this.chartPokemonId.set(Number(id));
    this.chartPokemonChange.emit(Number(id));
  }

  onBattleChartPeriodChange(value: string): void {
    if (value === 'monthly' || value === 'weekly') {
      this.battleChartPeriod.set(value);
    }
  }

  battlePokemonIds(battle: Battle): number[] {
    const team = this.teams().find((t) => t.id === battle.team_id);
    return team?.pokemon_ids?.slice(0, 4) ?? [];
  }

  battleTypes(battle: Battle): string[] {
    const ids = this.battlePokemonIds(battle);
    const types = new Set<string>();
    ids.forEach((id) => {
      const p = this.chartPokemonOptions().find((x) => x.id === id);
      p?.types?.forEach((t) => types.add(t.name));
    });
    return Array.from(types).slice(0, 2);
  }

  typeColor(type: string): string {
    const map: Record<string, string> = {
      ghost: '#705898',
      electric: '#f8d030',
      fire: '#f08030',
      water: '#6890f0',
      grass: '#78c850',
      poison: '#a040a0',
    };
    return map[type.toLowerCase()] ?? '#7c3aed';
  }

  opponentAvatar(name: string): string {
    return resolveOpponentAvatarUrl(name);
  }

  onOpponentAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.includes(DEFAULT_TRAINER_AVATAR)) {
      img.src = DEFAULT_TRAINER_AVATAR;
    }
  }

  opponentSubtitle(name: string): string {
    const gyms: Record<string, string> = {
      misty: 'Cerulean Gym Leader',
      brock: 'Pewter Gym Leader',
      gary: 'Rival Trainer',
    };
    return gyms[name.toLowerCase().split(' ')[0]] ?? 'Trainer';
  }

  formatRelative(dateStr: string): string {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) return dateStr;
    const mins = Math.floor((Date.now() - date.getTime()) / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
}
