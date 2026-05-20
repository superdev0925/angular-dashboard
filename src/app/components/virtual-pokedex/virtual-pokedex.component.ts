import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy, ViewChild, AfterViewInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ScrollingModule, CdkVirtualScrollViewport } from '@angular/cdk/scrolling';
import { PokemonStore, Pokemon } from '../../state/pokemon.store';
import { Subject } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

@Component({
  selector: 'app-virtual-pokedex',
  standalone: true,
  imports: [CommonModule, ScrollingModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="virtual-pokedex">
      <h2>Virtual Scrolling Pokédex</h2>
      <p class="info">Scroll to load more Pokémon automatically!</p>
      
      <cdk-virtual-scroll-viewport 
        [itemSize]="280" 
        [minBufferPx]="560" 
        [maxBufferPx]="840"
        class="viewport"
        (scrolledIndexChange)="onScrollIndexChange($event)">
        
        <div *cdkVirtualFor="let pokemon of virtualPokemon(); let i = index; trackBy: trackByPokemonId" class="pokemon-card-container">
          <!-- Skeleton Loader -->
          @if (isLoading() && !pokemon) {
            <div class="skeleton-card">
              <div class="skeleton-image shimmer"></div>
              <div class="skeleton-text shimmer"></div>
              <div class="skeleton-text-small shimmer"></div>
            </div>
          }
          
          <!-- Actual Pokemon Card -->
          @if (pokemon) {
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
    }
    
    .info {
      color: #666;
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
      background: white;
      border-radius: 12px;
      padding: 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      animation: fadeInUp 0.4s ease-out backwards;
      
      &:hover {
        transform: translateY(-5px) scale(1.02);
        box-shadow: 0 8px 24px rgba(0,0,0,0.15);
        
        .pokemon-image {
          transform: scale(1.1) rotate(5deg);
        }
      }
      
      .pokemon-image {
        width: 120px;
        height: 120px;
        transition: transform 0.3s ease;
      }
      
      h3 {
        margin: 10px 0;
        color: #333;
      }
      
      .types {
        display: flex;
        justify-content: center;
        gap: 8px;
        margin: 10px 0;
        
        span {
          padding: 4px 12px;
          border-radius: 20px;
          font-size: 12px;
          color: white;
          text-transform: capitalize;
        }
      }
      
      .stats {
        display: flex;
        justify-content: space-around;
        font-size: 12px;
        color: #666;
        margin-top: 10px;
      }
    }
    
    /* Skeleton Loader Styles */
    .skeleton-card {
      background: #f0f0f0;
      border-radius: 12px;
      padding: 20px;
      height: 280px;
      
      .skeleton-image {
        width: 120px;
        height: 120px;
        border-radius: 50%;
        background: #e0e0e0;
        margin: 0 auto;
      }
      
      .skeleton-text {
        height: 20px;
        background: #e0e0e0;
        margin: 15px auto;
        width: 60%;
        border-radius: 4px;
      }
      
      .skeleton-text-small {
        height: 12px;
        background: #e0e0e0;
        margin: 10px auto;
        width: 40%;
        border-radius: 4px;
      }
    }
    
    /* Shimmer Animation */
    .shimmer {
      animation: shimmer 1.5s infinite;
      background: linear-gradient(90deg, #e0e0e0 25%, #f0f0f0 50%, #e0e0e0 75%);
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
  
  virtualPokemon = signal<(Pokemon | null)[]>([]);
  isLoading = signal(false);
  private loadedCount = 0;
  private batchSize = 20;
  private totalPokemon = 1000;
  
  ngOnInit() {
    this.loadBatch(0);
  }
  
  /**
   * Loads a batch of Pokémon when scrolling
   * @param startIndex - Starting index for loading
   */
  loadBatch(startIndex: number) {
    if (startIndex >= this.loadedCount && this.loadedCount < this.totalPokemon) {
      this.isLoading.set(true);
      
      // Create skeleton placeholders
      const newItems = Array(this.batchSize).fill(null);
      this.virtualPokemon.update(current => [...current, ...newItems]);
      
      this.pokemonStore.fetchPokemon(this.batchSize, this.loadedCount).subscribe({
        next: (pokemon) => {
          this.virtualPokemon.update(current => {
            const updated = [...current];
            for (let i = 0; i < pokemon.length; i++) {
              const index = this.loadedCount + i;
              if (index < updated.length) {
                updated[index] = pokemon[i];
              }
            }
            return updated;
          });
          this.loadedCount += pokemon.length;
          this.isLoading.set(false);
        },
        error: () => this.isLoading.set(false)
      });
    }
  }
  
  /**
   * Triggers when scroll index changes in virtual viewport
   * @param index - Current scroll index
   */
  onScrollIndexChange(index: number) {
    const buffer = 10;
    if (index + buffer >= this.loadedCount) {
      this.loadBatch(this.loadedCount);
    }
  }
  
  trackByPokemonId(index: number, item: Pokemon | null): number {
    return item?.id || index;
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