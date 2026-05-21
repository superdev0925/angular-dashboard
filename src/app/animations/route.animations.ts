import { trigger, transition, style, animate } from '@angular/animations';

/** Bonus 5: Tab / route content fade-slide transitions. */
export const tabContentAnimation = trigger('tabContent', [
  transition(':enter', [
    style({ opacity: 0, transform: 'translateY(12px)' }),
    animate('280ms ease-out', style({ opacity: 1, transform: 'translateY(0)' })),
  ]),
]);

/** Bonus 2: Team queue slot insert / remove. */
export const queueSlotAnimation = trigger('queueSlot', [
  transition(':enter', [
    style({ opacity: 0, transform: 'scale(0.85)' }),
    animate('220ms cubic-bezier(0.4, 0, 0.2, 1)', style({ opacity: 1, transform: 'scale(1)' })),
  ]),
  transition(':leave', [
    animate('180ms cubic-bezier(0.4, 0, 1, 1)', style({ opacity: 0, transform: 'scale(0.85)' })),
  ]),
]);
