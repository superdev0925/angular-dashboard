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
  animate = input(false);
  @ViewChild('lineCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;

  constructor() {
    effect(() => {
      // Track inputs reactively and update chart after view init.
      this.battles();
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

  private getMonthlyData(): { months: string[]; wins: number[]; losses: number[] } {
    const monthlyData = new Map<string, { wins: number; losses: number }>();

    this.battles()?.forEach((battle) => {
      if (!battle?.date) return;
      const month = battle.date.substring(0, 7);
      const current = monthlyData.get(month) || { wins: 0, losses: 0 };
      if (battle.result === 'win') current.wins++;
      else if (battle.result === 'loss') current.losses++;
      monthlyData.set(month, current);
    });

    const sortedMonths = Array.from(monthlyData.keys()).sort();
    if (sortedMonths.length === 0) return { months: [], wins: [], losses: [] };

    return {
      months: sortedMonths.map((m) => {
        const d = new Date(m + '-01');
        return d.toLocaleString('default', { month: 'short' });
      }),
      wins: sortedMonths.map((m) => monthlyData.get(m)?.wins || 0),
      losses: sortedMonths.map((m) => monthlyData.get(m)?.losses || 0),
    };
  }

  private createChart(): void {
    if (!this.canvasRef?.nativeElement) return;
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;

    this.chart?.destroy();
    const { months, wins, losses } = this.getMonthlyData();

    const config: ChartConfiguration<'line', number[], string> = {
      type: 'line',
      data: {
        labels: months,
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
    const { months, wins, losses } = this.getMonthlyData();
    this.chart.data.labels = months;
    this.chart.data.datasets[0].data = wins;
    this.chart.data.datasets[1].data = losses;
    this.chart.update(this.animate() ? 'active' : 'none');
  }
}
