import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  exiting?: boolean;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  private toasts = signal<Toast[]>([]);
  private nextId = 0;
  
  toasts$ = this.toasts.asReadonly();
  
  /**
   * Shows a toast notification with slide-in animation
   * @param message - Message to display
   * @param type - Toast type
   * @param duration - Duration in ms (default: 3000)
   */
  show(message: string, type: Toast['type'] = 'info', duration: number = 3000) {
    const id = this.nextId++;
    const toast: Toast = { id, message, type };
    
    this.toasts.update(current => [...current, toast]);
    
    setTimeout(() => {
      this.toasts.update((current) =>
        current.map((t) => (t.id === id ? { ...t, exiting: true } : t))
      );
      setTimeout(() => {
        this.toasts.update((current) => current.filter((t) => t.id !== id));
      }, 280);
    }, duration);
  }
}