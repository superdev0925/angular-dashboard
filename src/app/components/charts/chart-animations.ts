import type { ChartOptions } from 'chart.js';

/** Shared animation presets for dashboard charts. */
export const dashboardLineAnimations: ChartOptions<'line'>['animations'] = {
  x: {
    type: 'number',
    easing: 'easeOutQuart',
    duration: 900,
    from: NaN,
    delay(ctx) {
      return ctx.type === 'data' ? ctx.dataIndex * 120 : 0;
    },
  },
  y: {
    type: 'number',
    easing: 'easeOutQuart',
    duration: 1000,
    from(ctx) {
      if (ctx.type === 'data' && ctx.chart.scales['y']) {
        return ctx.chart.scales['y'].getPixelForValue(0);
      }
      return undefined;
    },
    delay(ctx) {
      return ctx.type === 'data' ? ctx.dataIndex * 120 : 0;
    },
  },
  tension: {
    duration: 700,
    easing: 'easeOutQuad',
    from: 0,
    to: 0.4,
    delay: 200,
  },
  radius: {
    duration: 500,
    easing: 'easeOutBack',
    from: 0,
    delay(ctx) {
      return ctx.type === 'data' ? 600 + ctx.dataIndex * 80 : 0;
    },
  },
};

export const dashboardLineAnimationRoot: ChartOptions<'line'>['animation'] = {
  duration: 1400,
  easing: 'easeOutQuart',
};

export const dashboardRadarAnimations: ChartOptions<'radar'>['animations'] = {
  numbers: {
    type: 'number',
    properties: ['r'],
    easing: 'easeOutQuart',
    duration: 1200,
    from: (ctx) => (ctx.type === 'data' ? 0 : undefined),
    delay(ctx) {
      return ctx.type === 'data' ? ctx.dataIndex * 100 : 0;
    },
  },
  colors: {
    type: 'color',
    duration: 800,
    easing: 'easeOutQuart',
  },
};

export const dashboardRadarAnimationRoot: ChartOptions<'radar'>['animation'] = {
  duration: 1400,
  easing: 'easeOutQuart',
};

export const dashboardDoughnutAnimationRoot: ChartOptions<'doughnut'>['animation'] = {
  duration: 1400,
  easing: 'easeOutQuart',
  animateRotate: true,
  animateScale: true,
  delay(ctx) {
    return ctx.type === 'data' ? ctx.dataIndex * 150 : 0;
  },
};

export const dashboardDoughnutAnimations: ChartOptions<'doughnut'>['animations'] = {
  circumference: {
    duration: 1400,
    easing: 'easeOutQuart',
    from: 0,
    delay(ctx) {
      return ctx.type === 'data' ? ctx.dataIndex * 120 : 0;
    },
  },
  radius: {
    duration: 1200,
    easing: 'easeOutBack',
    from: '90%',
    to: '100%',
  },
};
