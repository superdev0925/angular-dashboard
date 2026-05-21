import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { PokemonStore, Pokemon } from '../../state/pokemon.store';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

/**
 * Bonus 1: Virtual scrolling Pokédex with lazy batches of 20 and skeleton cards.
 */
@Component({
  selector: 'app-virtual-pokedex',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="virtual-pokedex">
      <h2>Virtual Scrolling Pokédex</h2>
      <p class="info" *ngIf="!showPrimaryLoading()">
        Scroll to load Pokémon in batches of {{ batchSize }} ({{ loadedCount() }} loaded)
      </p>

      <div *ngIf="showPrimaryLoading()" class="catalog-loading loading" role="status" aria-live="polite">
        <div class="pokeball" aria-hidden="true"></div>
        <p>Loading Pokémon...</p>
      </div>

      <cdk-virtual-scroll-viewport
        *ngIf="!showPrimaryLoading()"
        [itemSize]="280"
        [minBufferPx]="560"
        [maxBufferPx]="840"
        class="viewport"
        (scrolledIndexChange)="onScrollIndexChange($event)">
        <div
          *cdkVirtualFor="let pokemon of virtualPokemon(); let i = index; trackBy: trackByPokemon"
          class="pokemon-card-container">
          @if (!pokemon) {
            <div class="skeleton-card" aria-hidden="true">
              <div class="skeleton-image shimmer"></div>
              <div class="skeleton-text shimmer"></div>
              <div class="skeleton-text-small shimmer"></div>
            </div>
          } @else {
            <div
              class="pokemon-card card-enter"
              (click)="selectPokemon(pokemon)"
              [style.animation-delay.ms]="(i % 20) * 50">
              <img [src]="getPokemonImage(pokemon)" [alt]="pokemon.name" class="pokemon-image sprite-bounce">
              <h3>{{ pokemon.name | titlecase }}</h3>
              <div class="types">
                <span *ngFor="let type of pokemon.types" [class]="'type-badge type-' + type.name">
                  {{ type.name }}
                </span>
              </div>
              <div class="stats">
                <span>HP: {{ getStat(pokemon, 'hp') }}</span>
                <span>ATK: {{ getStat(pokemon, 'attack') }}</span>
                <span>DEF: {{ getStat(pokemon, 'defense') }}</span>
              </div>
            </div>
          }
        </div>
      </cdk-virtual-scroll-viewport>

      <div *ngIf="isLoadingMore() && loadedCount() > 0" class="loading-more loading" role="status">
        <div class="pokeball pokeball-sm" aria-hidden="true"></div>
        <p>Loading Pokémon...</p>
      </div>
    </div>
  `,
  styles: [`
    .virtual-pokedex {
      padding: 20px;
      height: 100vh;
      display: flex;
      flex-direction: column;
      color: var(--text-body);
    }

    .virtual-pokedex h2 {
      margin: 0 0 8px;
      color: var(--text-heading);
      font-size: 1.35rem;
    }

    .info {
      color: var(--text-muted);
      margin-bottom: 12px;
      font-size: 14px;
    }

    .loading {
      text-align: center;
      padding: 60px 24px;
      background: var(--surface-card);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      flex: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 280px;

      .pokeball {
        width: 50px;
        height: 50px;
        border: 4px solid var(--surface-border);
        border-top: 4px solid var(--primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin: 0 auto 16px;
      }

      .pokeball-sm {
        width: 40px;
        height: 40px;
        border-width: 3px;
        margin-bottom: 12px;
      }

      p {
        margin: 0;
        color: var(--text-muted);
        font-size: 15px;
      }
    }

    .catalog-loading {
      margin-bottom: 16px;
    }

    .viewport {
      height: calc(100vh - 140px);
      width: 100%;
    }

    .pokemon-card-container {
      padding: 10px;
      display: inline-block;
      width: 100%;
    }

    .pokemon-card {
      background: var(--surface-card);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1),
        box-shadow 0.3s ease,
        border-color 0.3s ease;
      box-shadow: var(--shadow);
    }

    .card-enter {
      animation: fadeInUp 0.4s ease-out backwards;
    }

    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(16px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .pokemon-card:hover {
      transform: translateY(-5px) scale(1.02);
      border-color: var(--primary);
      box-shadow: 0 8px 24px rgba(124, 58, 237, 0.25);
    }

    .pokemon-card:hover .sprite-bounce {
      animation: spriteBounce 0.45s ease;
    }

    @keyframes spriteBounce {
      0%, 100% { transform: translateY(0); }
      40% { transform: translateY(-8px) scale(1.08); }
      70% { transform: translateY(-2px); }
    }

    .pokemon-image {
      width: 120px;
      height: 120px;
      image-rendering: pixelated;
    }

    .skeleton-card {
      background: var(--surface-card);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 20px;
      min-height: 220px;
    }

    .skeleton-image {
      width: 120px;
      height: 120px;
      margin: 0 auto 16px;
      border-radius: 12px;
      background: var(--surface-deep);
    }

    .skeleton-text {
      height: 16px;
      width: 70%;
      margin: 0 auto 8px;
      border-radius: 8px;
      background: var(--surface-deep);
    }

    .skeleton-text-small {
      height: 12px;
      width: 50%;
      margin: 0 auto;
      border-radius: 6px;
      background: var(--surface-deep);
    }

    .shimmer {
      background: linear-gradient(
        90deg,
        var(--surface-deep) 25%,
        var(--surface-elevated) 50%,
        var(--surface-deep) 75%
      );
      background-size: 200% 100%;
      animation: shimmer 1.5s infinite;
    }

    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }

    .loading-more {
      margin-top: 12px;
      padding: 32px 24px;
      min-height: auto;
    }

    @keyframes spin {
      to { transform: rotate(360deg); }
    }

    .types {
      display: flex;
      justify-content: center;
      gap: 6px;
      flex-wrap: wrap;
      margin: 8px 0;
    }

    .type-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      color: white;
      text-transform: capitalize;
    }

    .type-normal { background: #A8A878; }
    .type-fire { background: #F08030; }
    .type-water { background: #6890F0; }
    .type-grass { background: #78C850; }
    .type-electric { background: #F8D030; color: #1e293b; }
  `],
})
export class VirtualPokedexComponent implements OnInit {
  private pokemonStore = inject(PokemonStore);
  private destroyRef = inject(DestroyRef);

  readonly batchSize = 20;

  virtualPokemon = signal<(Pokemon | null)[]>([]);
  isLoadingMore = signal(false);
  loadedCount = signal(0);
  private catalogComplete = false;

  /** Centered pokeball loader for the first lazy batch. */
  showPrimaryLoading = computed(() => this.loadedCount() === 0 && this.isLoadingMore());

  ngOnInit(): void {
    this.loadNextBatch();
  }

  /**
   * Loads the next lazy batch of 20 Pokémon from PokéAPI into the virtual list.
   */
  loadNextBatch(): void {
    if (this.isLoadingMore() || this.catalogComplete) {
      return;
    }
    const offset = this.loadedCount();
    this.isLoadingMore.set(true);
    this.virtualPokemon.update((list) => [...list, ...Array(this.batchSize).fill(null)]);

    this.pokemonStore
      .fetchPokemon(this.batchSize, offset, { append: true, updateStore: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (batch) => {
          this.virtualPokemon.update((list) => {
            const updated = [...list];
            for (let i = 0; i < batch.length; i++) {
              updated[offset + i] = batch[i];
            }
            if (batch.length < this.batchSize) {
              updated.length = offset + batch.length;
            }
            return updated;
          });
          this.loadedCount.set(offset + batch.length);
          if (batch.length < this.batchSize) {
            this.catalogComplete = true;
          }
          this.isLoadingMore.set(false);
        },
        error: () => {
          this.virtualPokemon.update((list) => list.slice(0, offset));
          this.isLoadingMore.set(false);
        },
      });
  }

  /**
   * Triggers lazy loading when the user scrolls near the end of the virtual list.
   */
  onScrollIndexChange(index: number): void {
    const buffer = 8;
    if (index + buffer >= this.loadedCount() - 1 && !this.catalogComplete) {
      this.loadNextBatch();
    }
  }

  trackByPokemon(index: number, pokemon: Pokemon | null): number {
    return pokemon?.id ?? index;
  }

  selectPokemon(pokemon: Pokemon): void {
    console.info('[virtual-pokedex] selected', pokemon.name);
  }

  getPokemonImage(pokemon: Pokemon): string {
    return pokemon.sprites;
  }

  getStat(pokemon: Pokemon, statName: string): number {
    const stat = pokemon.stats.find((s) => s.stat.name === statName);
    return stat?.base_stat || 0;
  }
}
