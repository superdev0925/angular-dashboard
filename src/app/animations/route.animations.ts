import { trigger, transition, style, animate } from '@angular/animations';

/** Bonus 5: Tab / route content fade-slide transitions. */
export const tabContentAnimation = trigger('tabContent', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(12px)' }),
    animate('280ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
]);
