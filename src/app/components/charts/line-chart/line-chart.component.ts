import {
  Component,
  ChangeDetectionStrategy,
  effect,
  input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Battle } from '../../../state/trainer.store';
import {
  dashboardLineAnimationRoot,
  dashboardLineAnimations,
} from '../chart-animations';

Chart.register(...registerables);

export type BattleChartPeriod = 'monthly' | 'weekly';

@Component({
  selector: 'app-line-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="line-chart-wrapper" [class.chart-animated]="animate()">
      <canvas #lineCanvas class="line-canvas"></canvas>
    </div>
  `,
  styles: [
    `
      .line-chart-wrapper {
        position: relative;
        width: 100%;
        height: 280px;
      }
      .line-canvas {
        width: 100% !important;
        height: 280px !important;
      }
      .chart-animated {
        animation: chartReveal 0.5s ease-out both;
      }
      .chart-animated .line-canvas {
        animation: chartBreathe 4s ease-in-out 0.6s infinite;
      }
      @keyframes chartReveal {
        from {
          opacity: 0;
          transform: translateY(10px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
      @keyframes chartBreathe {
        0%,
        100% {
          transform: scale(1);
        }
        50% {
          transform: scale(1.01);
        }
      }
    `,
  ],
})
export class LineChartComponent implements AfterViewInit, OnDestroy {
  battles = input<Battle[]>([]);
  period = input<BattleChartPeriod>('monthly');
  animate = input(false);
  @ViewChild('lineCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;

  constructor() {
    effect(() => {
      // Track inputs reactively and update chart after view init.
      this.battles();
      this.period();
      this.animate();
      if (!this.viewReady) return;
      queueMicrotask(() => this.updateChart());
    });
  }

  ngAfterViewInit(): void {
    setTimeout(() => this.createChart(), 100);
    this.viewReady = true;
  }

  ngOnDestroy(): void {
    this.chart?.destroy();
    this.chart = null;
  }

  private getChartData(): { labels: string[]; wins: number[]; losses: number[] } {
    return this.period() === 'weekly' ? this.getWeeklyData() : this.getMonthlyData();
  }

  private aggregateBattles(
    bucketKey: (dateStr: string) => string,
    formatLabel: (key: string) => string
  ): { labels: string[]; wins: number[]; losses: number[] } {
    const buckets = new Map<string, { wins: number; losses: number }>();

    this.battles()?.forEach((battle) => {
      if (!battle?.date) return;
      const key = bucketKey(battle.date);
      const current = buckets.get(key) || { wins: 0, losses: 0 };
      if (battle.result === 'win') current.wins++;
      else if (battle.result === 'loss') current.losses++;
      buckets.set(key, current);
    });

    const sortedKeys = Array.from(buckets.keys()).sort();
    if (sortedKeys.length === 0) return { labels: [], wins: [], losses: [] };

    return {
      labels: sortedKeys.map(formatLabel),
      wins: sortedKeys.map((k) => buckets.get(k)?.wins || 0),
      losses: sortedKeys.map((k) => buckets.get(k)?.losses || 0),
    };
  }

  private getMonthlyData(): { labels: string[]; wins: number[]; losses: number[] } {
    return this.aggregateBattles(
      (dateStr) => dateStr.substring(0, 7),
      (monthKey) => {
        const d = new Date(monthKey + '-01');
        return d.toLocaleString('default', { month: 'short' });
      }
    );
  }

  private getWeeklyData(): { labels: string[]; wins: number[]; losses: number[] } {
    return this.aggregateBattles(
      (dateStr) => this.weekBucket(dateStr),
      (weekKey) => this.formatWeekLabel(weekKey)
    );
  }

  /** Monday of the battle's week (YYYY-MM-DD). */
  private weekBucket(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    const day = date.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(y, m - 1, d + mondayOffset);
    const yy = monday.getFullYear();
    const mm = String(monday.getMonth() + 1).padStart(2, '0');
    const dd = String(monday.getDate()).padStart(2, '0');
    return `${yy}-${mm}-${dd}`;
  }

  private formatWeekLabel(weekKey: string): string {
    const [y, m, d] = weekKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('default', { month: 'short', day: 'numeric' });
  }

  private createChart(): void {
    if (!this.canvasRef?.nativeElement) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart?.destroy();
    const { labels, wins, losses } = this.getChartData();

    const config: ChartConfiguration<'line', number[], string> = {
      type: 'line',
      data: {
        labels,
        datasets: [
          {
            label: 'Wins',
            data: wins,
            borderColor: '#a78bfa',
            backgroundColor: 'rgba(167, 139, 250, 0.15)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#a78bfa',
          },
          {
            label: 'Losses',
            data: losses,
            borderColor: '#f472b6',
            backgroundColor: 'rgba(244, 114, 182, 0.1)',
            fill: true,
            tension: 0.4,
            pointRadius: 4,
            pointBackgroundColor: '#f472b6',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            align: 'end',
            labels: { color: '#94a3b8', usePointStyle: true, boxWidth: 8 },
          },
        },
        scales: {
          x: {
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#64748b' },
          },
          y: {
            beginAtZero: true,
            grid: { color: 'rgba(148, 163, 184, 0.08)' },
            ticks: { color: '#64748b', stepSize: 1 },
          },
        },
        ...(this.animate()
          ? {
              animation: dashboardLineAnimationRoot,
              animations: dashboardLineAnimations,
            }
          : {
              animation: { duration: 600, easing: 'easeOutQuart' },
            }),
      },
    };

    this.chart = new Chart(ctx, config);
    if (this.animate()) {
      this.chart.reset();
      this.chart.update('active');
    }
  }

  private updateChart(): void {
    if (!this.chart) {
      this.createChart();
      return;
    }
    const { labels, wins, losses } = this.getChartData();
    this.chart.data.labels = labels;
    this.chart.data.datasets[0].data = wins;
    this.chart.data.datasets[1].data = losses;
    this.chart.update(this.animate() ? 'active' : 'none');
  }
}
