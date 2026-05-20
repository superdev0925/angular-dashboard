import { ChangeDetectionStrategy, Component, effect, input, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Pokemon } from '../../../state/pokemon.store';
import { OnDestroy } from '@angular/core';

// Register all Chart.js components
Chart.register(...registerables);

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
      height: 320px;
      display: block;
    }
    .radar-canvas {
      width: 100% !important;
      height: 320px !important;
    }
    .chart-animated {
      animation: chartReveal 0.5s ease-out both;
    }
    .chart-animated .radar-canvas {
      animation: radarFloat 4.2s ease-in-out 0.65s infinite;
    }
    @keyframes chartReveal {
      from { opacity: 0; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1); }
    }
    @keyframes radarFloat {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.015); }
    }
  `]
})
export class RadarChartComponent implements AfterViewInit, OnDestroy {
  pokemon = input<Pokemon | null>(null);
  dark = input(false);
  animate = input(false);
  @ViewChild('radarCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private chart: Chart | null = null;
  private viewReady = false;

  constructor() {
    effect(() => {
      this.pokemon();
      this.dark();
      this.animate();
      if (!this.viewReady) return;
      queueMicrotask(() => this.updateChart());
    });
  }
  
  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
  
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.viewReady = true;
      this.createChart();
    }, 100);
  }
  
  /**
   * Reads base stats in radar axis order (HP → Speed).
   *
   * @returns number[] - Six stat values for Chart.js
   */
  private getStatValues(): number[] {
    const p = this.pokemon();
    if (!p?.stats?.length) {
      return [0, 0, 0, 0, 0, 0];
    }

    const order = ['hp', 'attack', 'defense', 'special-attack', 'special-defense', 'speed'];
    return order.map((name) => {
      const row = p.stats.find((s) => {
        const statName = (s?.stat?.name ?? '').toLowerCase().replace(/_/g, '-');
        return statName === name;
      });
      return row?.base_stat ?? 0;
    });
  }
  
  private createChart(): void {
    if (!this.canvasRef || !this.canvasRef.nativeElement) {
      console.log('Canvas not ready');
      return;
    }
    
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) {
      console.log('Cannot get canvas context');
      return;
    }
    
    // Destroy existing chart
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    
    const statValues = this.getStatValues();
    const pokemonName = this.pokemon()?.name || 'Pokemon';
    
    console.log('Creating radar chart for:', pokemonName, statValues);
    
    const config: ChartConfiguration<'radar', number[], string> = {
      type: 'radar',
      data: {
        labels: ['HP', 'Attack', 'Defense', 'Sp. Atk', 'Sp. Def', 'Speed'],
        datasets: [{
          label: pokemonName,
          data: statValues,
          backgroundColor: 'rgba(124, 58, 237, 0.25)',
          borderColor: 'rgba(167, 139, 250, 1)',
          borderWidth: 2,
          pointBackgroundColor: 'rgba(167, 139, 250, 1)',
          pointBorderColor: '#ffffff',
          pointHoverBackgroundColor: '#ffffff',
          pointHoverBorderColor: 'rgba(99, 102, 241, 1)',
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.1
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          r: {
            beginAtZero: true,
            max: 200,
            grid: {
              color: this.dark() ? 'rgba(148, 163, 184, 0.15)' : 'rgba(0, 0, 0, 0.1)',
            },
            angleLines: {
              color: this.dark() ? 'rgba(148, 163, 184, 0.12)' : 'rgba(0, 0, 0, 0.1)',
            },
            ticks: {
              stepSize: 50,
              backdropColor: 'transparent',
              color: this.dark() ? '#64748b' : '#6b7280',
            },
            pointLabels: {
              font: { size: 12 },
              color: this.dark() ? '#94a3b8' : '#374151',
            }
          }
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.label}: ${context.raw}`;
              }
            }
          },
          legend: {
            position: 'top',
            labels: {
              font: { size: 12 },
              usePointStyle: true
            }
          }
        },
        animation: {
          duration: this.animate() ? 900 : 400,
          easing: 'easeOutQuart',
        },
      },
    };
    
    try {
      this.chart = new Chart(ctx, config);
      console.log('Radar chart created successfully');
    } catch (error) {
      console.error('Error creating radar chart:', error);
    }
  }
  
  private updateChart(): void {
    const p = this.pokemon();
    if (this.chart && p) {
      const statValues = this.getStatValues();
      this.chart.data.datasets[0].data = statValues;
      this.chart.data.datasets[0].label = p.name;
      this.chart.update();
    } else {
      this.createChart();
    }
  }
}