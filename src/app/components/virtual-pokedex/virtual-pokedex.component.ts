import { Component, OnInit, signal, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import { PokemonStore, Pokemon } from '../../state/pokemon.store';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-virtual-pokedex',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="virtual-pokedex">
      <h2>Virtual Scrolling Pokédex</h2>
      <p class="info">Full national dex ({{ virtualPokemon().length }} Pokémon) — virtual scroll for performance.</p>
      
      <cdk-virtual-scroll-viewport 
        [itemSize]="280" 
        [minBufferPx]="560" 
        [maxBufferPx]="840"
        class="viewport"
        (scrolledIndexChange)="onScrollIndexChange($event)">
        
        <div *cdkVirtualFor="let pokemon of virtualPokemon(); let i = index; trackBy: trackByPokemonId" class="pokemon-card-container">
          @if (isLoading() && !virtualPokemon().length) {
            <div class="skeleton-card">
              <div class="skeleton-image shimmer"></div>
              <div class="skeleton-text shimmer"></div>
              <div class="skeleton-text-small shimmer"></div>
            </div>
          } @else {
            <div class="pokemon-card" (click)="selectPokemon(pokemon)" [style.animation-delay]="(i * 0.05) + 's'">
              <img [src]="getPokemonImage(pokemon)" [alt]="pokemon.name" class="pokemon-image">
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
      margin-bottom: 20px;
      font-size: 14px;
    }

    .viewport {
      height: calc(100vh - 120px);
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
      animation: fadeInUp 0.4s ease-out backwards;

      &:hover {
        transform: translateY(-5px) scale(1.02);
        border-color: var(--primary);
        box-shadow: 0 8px 24px rgba(124, 58, 237, 0.25);

        .pokemon-image {
          transform: scale(1.1) rotate(5deg);
        }
      }

      .pokemon-image {
        width: 120px;
        height: 120px;
        transition: transform 0.3s ease;
        image-rendering: pixelated;
      }

      h3 {
        margin: 10px 0;
        color: var(--text-heading);
        text-transform: capitalize;
      }

      .types {
        display: flex;
        justify-content: center;
        flex-wrap: wrap;
        gap: 8px;
        margin: 10px 0;

        span {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          font-weight: 600;
          color: #fff;
          text-transform: capitalize;
        }
      }

      .stats {
        display: flex;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
        gap: 16px 24px;
        font-size: 12px;
        font-weight: 600;
        color: var(--text-muted);
        margin-top: 10px;
      }

      .stats span {
        color: var(--accent);
      }
    }

    .skeleton-card {
      background: var(--surface-card);
      border: 1px solid var(--glass-border);
      border-radius: 12px;
      padding: 20px;
      height: 280px;

      .skeleton-image {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: var(--surface-deep);
        margin: 0 auto;
      }

      .skeleton-text {
        height: 20px;
        background: var(--surface-deep);
        margin: 15px auto;
        width: 60%;
        border-radius: 4px;
      }

      .skeleton-text-small {
        height: 12px;
        background: var(--surface-deep);
        margin: 10px auto;
        width: 40%;
        border-radius: 4px;
      }
    }

    .shimmer {
      animation: shimmer 1.5s infinite;
      background: linear-gradient(
        90deg,
        var(--surface-deep) 25%,
        var(--surface-elevated) 50%,
        var(--surface-deep) 75%
      );
      background-size: 200% 100%;
    }
    
    @keyframes shimmer {
      0% { background-position: 200% 0; }
      100% { background-position: -200% 0; }
    }
    
    /* Staggered Entry Animation */
    @keyframes fadeInUp {
      from {
        opacity: 0;
        transform: translateY(30px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    
    /* Type Badges */
    .type-normal { background: #A8A878; }
    .type-fire { background: #F08030; }
    .type-water { background: #6890F0; }
    .type-electric { background: #F8D030; }
    .type-grass { background: #78C850; }
    .type-ice { background: #98D8D8; }
    .type-fighting { background: #C03028; }
    .type-poison { background: #A040A0; }
    .type-ground { background: #E0C068; }
    .type-flying { background: #A890F0; }
    .type-psychic { background: #F85888; }
    .type-bug { background: #A8B820; }
    .type-rock { background: #B8A038; }
    .type-ghost { background: #705898; }
    .type-dragon { background: #7038F8; }
    .type-dark { background: #705848; }
    .type-steel { background: #B8B8D0; }
    .type-fairy { background: #EE99AC; }
  `]
})
export class VirtualPokedexComponent implements OnInit {
  private pokemonStore = inject(PokemonStore);
  private destroyRef = inject(DestroyRef);

  virtualPokemon = signal<Pokemon[]>([]);
  isLoading = signal(false);

  ngOnInit() {
    this.pokemonStore.loading$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((loading) => this.isLoading.set(loading));

    this.pokemonStore.pokemon$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => this.virtualPokemon.set(list ?? []));

    if (!this.pokemonStore.getState().pokemon.length) {
      this.pokemonStore
        .fetchAllPokemon()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe();
    }
  }

  /**
   * Scroll index hook for CDK virtual viewport (buffer tuning only).
   * @param _index - Current scroll index
   */
  onScrollIndexChange(_index: number): void {
    // Full catalog is loaded via PokemonStore.fetchAllPokemon().
  }
  
  trackByPokemonId(_index: number, item: Pokemon): number {
    return item.id;
  }
  
  getPokemonImage(pokemon: Pokemon): string {
    return pokemon.sprites;
  }
  
  getStat(pokemon: Pokemon, statName: string): number {
    const stat = pokemon.stats.find(s => s.stat.name === statName);
    return stat?.base_stat || 0;
  }
  
  selectPokemon(pokemon: Pokemon) {
    console.log('Selected:', pokemon.name);
    // Emit to parent component
  }
}