import { Injectable, computed, signal, effect } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

const STORAGE_KEY = 'pokedex-trainer-theme';

/**
 * Global light/dark theme; persists choice and sets `data-theme` on the document root.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  readonly theme = signal<ThemeMode>(this.readStoredTheme());

  readonly isDark = computed(() => this.theme() === 'dark');

  constructor() {
    effect(() => {
      const mode = this.theme();
      document.documentElement.setAttribute('data-theme', mode);
      try {
        localStorage.setItem(STORAGE_KEY, mode);
      } catch {
        /* private browsing / quota */
      }
    });
  }

  /** Applies light or dark theme from header settings. */
  setTheme(mode: ThemeMode): void {
    this.theme.set(mode);
  }

  /** Toggles between light and dark. */
  toggleTheme(): void {
    this.setTheme(this.isDark() ? 'light' : 'dark');
  }

  private readStoredTheme(): ThemeMode {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'light' || stored === 'dark') {
        return stored;
      }
    } catch {
      /* ignore */
    }
    return 'dark';
  }
}
