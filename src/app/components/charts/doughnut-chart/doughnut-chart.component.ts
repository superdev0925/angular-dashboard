import { ChangeDetectionStrategy, Component, effect, input, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { OnDestroy } from '@angular/core';
import {
  dashboardDoughnutAnimationRoot,
  dashboardDoughnutAnimations,
} from '../chart-animations';

Chart.register(...registerables);

@Component({
  selector: 'app-doughnut-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="doughnut-chart-wrapper" [class.chart-animated]="animate()">
      <canvas #doughnutCanvas class="doughnut-canvas"></canvas>
    </div>
  `,
  styles: [`
    .doughnut-chart-wrapper {
      position: relative;
      width: min(100%, var(--doughnut-size, 240px));
      max-width: var(--doughnut-size, 240px);
      aspect-ratio: 1;
      height: auto;
      margin: 0 auto;
      display: block;
    }
    .doughnut-canvas {
      display: block;
      width: 100% !important;
      height: 100% !important;
    }
    .chart-animated {
      animation: chartReveal 0.55s ease-out both;
    }
    @keyframes chartReveal {
      from { opacity: 0; transform: scale(0.92); }
      to { opacity: 1; transform: scale(1); }
    }
  `]
})

export class DoughnutChartComponent implements AfterViewInit, OnDestroy {
  teamTypes = input<{ name: string; count: number; color: string }[]>([]);
  wins = input(0);
  losses = input(0);
  variant = input<'team' | 'battle'>('team');
  dark = input(false);
  animate = input(false);
  /** Hide Chart.js legend when the parent renders a custom legend (e.g. Pokédex sidebar). */
  showLegend = input(true);
  @ViewChild('doughnutCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  private chart: Chart | null = null;
  private viewReady = false;

  constructor() {
    effect(() => {
      this.teamTypes();
      this.wins();
      this.losses();
      this.variant();
      this.dark();
      this.animate();
      this.showLegend();
      if (!this.viewReady) return;
      queueMicrotask(() => this.updateChart());
    });
  }
  
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.createChart();
    }, 100);
    this.viewReady = true;
  }
  
  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
  
  private getChartData(): { labels: string[]; data: number[]; colors: string[] } {
    if (this.variant() === 'battle') {
      const w = this.wins() || 0;
      const l = this.losses() || 0;
      return {
        labels: ['Wins', 'Losses'],
        data: [w, l],
        colors: ['#7c3aed', '#f472b6'],
      };
    }

    const types = this.teamTypes();
    if (!types || types.length === 0) {
      return {
        labels: [],
        data: [],
        colors: []
      };
    }
    
    const colorMap: { [key: string]: string } = {
      fire: '#F08030', water: '#6890F0', grass: '#78C850',
      electric: '#F8D030', psychic: '#F85888', ice: '#98D8D8',
      dragon: '#7038F8', dark: '#705848', fairy: '#EE99AC',
      fighting: '#C03028', poison: '#A040A0', ground: '#E0C068',
      flying: '#A890F0', rock: '#B8A038', bug: '#A8B820',
      ghost: '#705898', steel: '#B8B8D0', normal: '#A8A878'
    };
    
    return {
      labels: types.map((t) => t.name),
      data: types.map((t) => t.count),
      colors: types.map(
        (t) => t.color || colorMap[t.name.toLowerCase()] || '#7c3aed'
      ),
    };
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
    
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
    
    const { labels, data, colors } = this.getChartData();
    const total = data.reduce((sum, val) => sum + val, 0);
    
    console.log('Creating doughnut chart with data:', { labels, data, colors });
    
    const config: ChartConfiguration<'doughnut', number[], string> = {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors,
          borderWidth: 3,
          borderColor: this.dark() ? '#0f172a' : '#ffffff',
          hoverOffset: 12,
          borderRadius: 6,
          spacing: 3,
          hoverBorderWidth: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        aspectRatio: 1,
        cutout: '62%',
        layout: {
          padding: 4,
        },
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                const value = context.raw as number;
                const percentage = ((value / total) * 100).toFixed(1);
                return `${context.label}: ${value} (${percentage}%)`;
              }
            }
          },
          legend: {
            display: this.showLegend(),
            position: 'bottom',
            labels: {
              font: { size: 11 },
              usePointStyle: true,
              boxWidth: 10,
              padding: 10,
              color: this.dark() ? '#94a3b8' : '#374151',
            },
          },
        },
        ...(this.animate()
          ? {
              animation: dashboardDoughnutAnimationRoot,
              animations: dashboardDoughnutAnimations,
            }
          : {
              animation: {
                duration: 1000,
                easing: 'easeOutBounce',
                animateRotate: true,
                animateScale: true,
              },
            }),
      },
    };
    
    try {
      this.chart = new Chart(ctx, config);
      if (this.animate()) {
        this.chart.reset();
        this.chart.update('active');
      }
      console.log('Doughnut chart created successfully');
    } catch (error) {
      console.error('Error creating doughnut chart:', error);
    }
  }
  
  private updateChart(): void {
    if (this.chart) {
      const { labels, data, colors } = this.getChartData();
      this.chart.data.labels = labels;
      this.chart.data.datasets[0].data = data;
      this.chart.data.datasets[0].backgroundColor = colors;
      this.chart.update(this.animate() ? 'active' : 'none');
    } else {
      this.createChart();
    }
  }
}