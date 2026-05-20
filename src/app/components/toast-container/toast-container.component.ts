import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';

/** Global toast stack with slide-in/out (Bonus 5 micro-interaction). */
@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="toast-stack" aria-live="polite">
      <div
        *ngFor="let toast of toastService.toasts$()"
        class="toast"
        [class.success]="toast.type === 'success'"
        [class.error]="toast.type === 'error'"
        [class.warning]="toast.type === 'warning'"
        [class.info]="toast.type === 'info'"
        [class.exiting]="toast.exiting">
        {{ toast.message }}
      </div>
    </div>
  `,
  styles: [`
    .toast-stack {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 2000;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      max-width: 360px;
    }
    .toast {
      padding: 12px 16px;
      border-radius: 8px;
      color: #fff;
      animation: slideIn 0.3s ease;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }
    .toast.exiting {
      animation: slideOut 0.28s ease forwards;
    }
    .toast.success { background: #22c55e; }
    .toast.error { background: #ef4444; }
    .toast.warning { background: #f59e0b; }
    .toast.info { background: #6366f1; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `],
})
export class ToastContainerComponent {
  toastService = inject(ToastService);
}
