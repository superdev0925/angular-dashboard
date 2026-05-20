import { AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, OnDestroy, ViewChild, effect, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Chart, ChartConfiguration, registerables } from 'chart.js';
import { Battle } from '../../../state/trainer.store';
Chart.register(...registerables);

@Component({
  selector: 'app-bar-chart',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="bar-chart-wrapper" [class.chart-animated]="animate()">
      <canvas #barCanvas class="bar-canvas"></canvas>
    </div>
  `,
  styles: [`
    .bar-chart-wrapper {
      position: relative;
      width: 100%;
      height: 320px;
      display: block;
    }
    .bar-canvas {
      width: 100% !important;
      height: 320px !important;
    }
    .chart-animated {
      animation: chartReveal 0.5s ease-out both;
    }
    @keyframes chartReveal {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }
  `]
})

/** Grouped bar chart for monthly battle wins vs losses. */
export class BarChartComponent implements AfterViewInit, OnDestroy {
  battles = input<Battle[]>([]);
  animate = input(false);
  @ViewChild('barCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private chart: Chart | null = null;
  private viewReady = false;

  /**
   * Rebuilds the chart when battle data or animation input changes.
   */
  constructor() {
    effect(() => {
      this.battles();
      this.animate();
      if (!this.viewReady) return;
      queueMicrotask(() => this.updateChart());
    });
  }
  
  /**
   * Creates the Chart.js instance after the canvas is available.
   */
  ngAfterViewInit(): void {
    setTimeout(() => {
      this.createChart();
    }, 100);
    this.viewReady = true;
  }
  
  /**
   * Destroys the chart to prevent memory leaks.
   */
  ngOnDestroy(): void {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }
  /**
   * Aggregates battles into monthly win/loss series for the chart datasets.
   *
   * @returns Monthly labels and win/loss counts
   */
  private getMonthlyData(): { months: string[], wins: number[], losses: number[] } {
    const battles = this.battles();
    if (!battles || battles.length === 0) {
      return { months: [], wins: [], losses: [] };
    }
    
    const monthlyData = new Map<string, { wins: number; losses: number }>();
    
    battles.forEach(battle => {
      if (!battle || !battle.date) return;
      const month = battle.date.substring(0, 7);
      const current = monthlyData.get(month) || { wins: 0, losses: 0 };
      
      if (battle.result === 'win') {
        current.wins++;
      } else if (battle.result === 'loss') {
        current.losses++;
      }
      
      monthlyData.set(month, current);
    });
    
    const sortedMonths = Array.from(monthlyData.keys()).sort();
    const wins = sortedMonths.map(m => monthlyData.get(m)?.wins || 0);
    const losses = sortedMonths.map(m => monthlyData.get(m)?.losses || 0);
    
    return { months: sortedMonths, wins, losses };
  }
  
  /**
   * Instantiates the grouped bar chart on the canvas.
   */
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
    
    const { months, wins, losses } = this.getMonthlyData();
    
    console.log('Creating bar chart with data:', { months, wins, losses });
    
    const config: ChartConfiguration<'bar', number[], string> = {
      type: 'bar',
      data: {
        labels: months,
        datasets: [
          {
            label: 'Wins',
            data: wins,
            backgroundColor: 'rgba(16, 185, 129, 0.8)',
            borderColor: 'rgb(16, 185, 129)',
            borderWidth: 1,
            borderRadius: 8,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          },
          {
            label: 'Losses',
            data: losses,
            backgroundColor: 'rgba(239, 68, 68, 0.8)',
            borderColor: 'rgb(239, 68, 68)',
            borderWidth: 1,
            borderRadius: 8,
            barPercentage: 0.6,
            categoryPercentage: 0.8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: ${context.raw}`;
              }
            }
          },
          legend: {
            position: 'top',
            labels: {
              font: { size: 12 },
              usePointStyle: true,
              boxWidth: 10
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
            },
            ticks: {
              stepSize: 1,
              precision: 0
            },
            title: {
              display: true,
              text: 'Number of Battles',
              font: { size: 11 }
            }
          },
          x: {
            grid: {
              display: false
            },
            title: {
              display: true,
              text: 'Month',
              font: { size: 11 }
            }
          }
        },
        animation: this.animate()
          ? {
              duration: 900,
              easing: 'easeOutQuart',
            }
          : {
              duration: 0,
            },
      }
    };
    
    try {
      this.chart = new Chart(ctx, config);
      console.log('Bar chart created successfully');
    } catch (error) {
      console.error('Error creating bar chart:', error);
    }
  }
  
  /**
   * Updates chart datasets when battle input changes.
   */
  private updateChart(): void {
    if (this.chart) {
      const { months, wins, losses } = this.getMonthlyData();
      this.chart.data.labels = months;
      this.chart.data.datasets[0].data = wins;
      this.chart.data.datasets[1].data = losses;
      this.chart.update(this.animate() ? 'active' : 'none');
      console.log('Bar chart updated');
    } else {
      this.createChart();
    }
  }
}