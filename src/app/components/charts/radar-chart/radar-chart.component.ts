import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  ViewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';

Chart.register(...registerables);

const RADAR_LABELS = ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'];

@Component({
  selector: 'app-radar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="radar-chart-wrapper" [class.chart-animated]="animate()">
      <canvas #radarCanvas class="radar-canvas"></canvas>
    </div>
  `,
  styles: [`
    .radar-chart-wrapper {
      position: relative;
      width: 100%;
      height: 280px;
      display: block;
    }
    .radar-canvas {
      display: block;
      width: 100% !important;
      height: 280px !important;
    }
    .chart-animated {
      animation: chartReveal 0.5s ease-out both;
    }
    @keyframes chartReveal {
      from { opacity: 0; transform: translateY(8px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `],
})
export class RadarChartComponent implements AfterViewInit, OnDestroy {
  /** Six stat values: HP, Atk, Def, SpA, SpD, Spe */
  stats = input<number[]>([0, 0, 0, 0, 0, 0]);
  pokemonName = input('Pokémon');
  dark = input(false);
  animate = input(false);

  @ViewChild('radarCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;
  private renderTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    effect(() => {
      this.stats();
      this.pokemonName();
      this.dark();
      this.animate();
      if (!this.viewReady) {
        return;
      }
      this.scheduleRender();
    });
  }

  /**
   * Waits for layout, then draws the chart (dashboard tab uses *ngIf).
   */
  ngAfterViewInit(): void {
    this.viewReady = true;
    this.scheduleRender(120);
  }

  /**
   * Destroys the Chart.js instance on teardown.
   */
  ngOnDestroy(): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
    this.destroyChart();
  }

  /**
   * Debounces chart rebuilds so the canvas has dimensions.
   *
   * @param delayMs - Delay before render
   */
  private scheduleRender(delayMs = 0): void {
    if (this.renderTimer) {
      clearTimeout(this.renderTimer);
    }
    this.renderTimer = setTimeout(() => {
      this.renderTimer = null;
      this.renderChart();
    }, delayMs);
  }

  /**
   * Normalizes stat array to exactly six numeric values.
   *
   * @returns number[] - Stat values for radar axes
   */
  private normalizedStats(): number[] {
    const raw = this.stats() ?? [];
    const values = RADAR_LABELS.map((_, i) => {
      const v = Number(raw[i]);
      return Number.isFinite(v) ? v : 0;
    });
    return values;
  }

  /**
   * Destroys any existing chart instance.
   */
  private destroyChart(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  /**
   * Rebuilds the radar chart from current inputs.
   */
  private renderChart(): void {
    const canvas = this.canvasRef?.nativeElement;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return;
    }

    this.destroyChart();

    const statValues = this.normalizedStats();
    const label = this.pokemonName() || 'Pokémon';
    const maxStat = Math.max(...statValues, 1);
    const axisMax = Math.max(100, Math.ceil(maxStat / 50) * 50);

    const config: ChartConfiguration<'radar', number[], string> = {
      type: 'radar',
      data: {
        labels: [...RADAR_LABELS],
        datasets: [
          {
            label,
            data: statValues,
            backgroundColor: 'rgba(124, 58, 237, 0.35)',
            borderColor: 'rgba(167, 139, 250, 1)',
            borderWidth: 2,
            pointBackgroundColor: 'rgba(167, 139, 250, 1)',
            pointBorderColor: '#ffffff',
            pointHoverBackgroundColor: '#ffffff',
            pointHoverBorderColor: 'rgba(99, 102, 241, 1)',
            pointRadius: 4,
            pointHoverRadius: 6,
            fill: true,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          r: {
            beginAtZero: true,
            min: 0,
            max: axisMax,
            grid: {
              color: this.dark() ? 'rgba(148, 163, 184, 0.2)' : 'rgba(0, 0, 0, 0.1)',
            },
            angleLines: {
              color: this.dark() ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 0, 0, 0.1)',
            },
            ticks: {
              stepSize: axisMax / 4,
              backdropColor: 'transparent',
              color: this.dark() ? '#64748b' : '#6b7280',
              showLabelBackdrop: false,
            },
            pointLabels: {
              font: { size: 11, weight: 'bold' },
              color: this.dark() ? '#cbd5e1' : '#374151',
            },
          },
        },
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: this.dark() ? '#e2e8f0' : '#374151',
              font: { size: 12 },
              usePointStyle: true,
            },
          },
          tooltip: {
            callbacks: {
              label: (context) => `${context.label}: ${context.raw}`,
            },
          },
        },
        animation: {
          duration: this.animate() ? 800 : 0,
          easing: 'easeOutQuart',
        },
      },
    };

    this.chart = new Chart(ctx, config);
    this.chart.resize();
    this.chart.update(this.animate() ? 'active' : 'none');
  }
}
