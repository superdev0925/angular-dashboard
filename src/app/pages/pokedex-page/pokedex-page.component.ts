import { Component, OnInit, signal, computed, inject, ChangeDetectionStrategy, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { toSignal } from '@angular/core/rxjs-interop';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PokemonStore, Pokemon } from '../../state/pokemon.store';
import { PokemonSelectors, PokemonFilter } from '../../state/pokemon.selectors';
import { Subject, BehaviorSubject, combineLatest } from 'rxjs';
import { debounceTime, distinctUntilChanged, map } from 'rxjs/operators';

@Component({
  selector: 'app-pokedex-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pokedex-container">
      <h1>Pokédex</h1>
      
      <!-- Filters -->
      <div class="filters">
        <input 
          type="text" 
          [ngModel]="searchTerm()" 
          (ngModelChange)="searchTerm.set($event)"
          placeholder="Search Pokémon..." 
          class="search-input"
        />
        
        <select [ngModel]="typeFilter()" (ngModelChange)="typeFilter.set($event)">
          <option value="">All Types</option>
          <option *ngFor="let type of types()" [value]="type.name">{{ type.name | titlecase }}</option>
        </select>
        
        <div class="stat-filter">
          <label>Total Stats: {{ minStats() }} - {{ maxStats() }}</label>
          <input type="range" [ngModel]="minStats()" (ngModelChange)="minStats.set($event)" min="0" max="1000" />
          <input type="range" [ngModel]="maxStats()" (ngModelChange)="maxStats.set($event)" min="0" max="1000" />
        </div>
      </div>
      
      <!-- Loading State -->
      @if (loading()) {
        <div class="loading-spinner">
          <div class="pokeball-spin"></div>
          <p>Loading Pokémon...</p>
        </div>
      }
      
      <!-- Pokémon Grid -->
      <div class="pokemon-grid" *ngIf="!loading()">
        @for (pokemon of filteredPokemon(); track pokemon.id) {
          <div class="pokemon-card" (click)="selectPokemon(pokemon)">
            <img [src]="getPokemonImage(pokemon)" [alt]="pokemon.name" class="pokemon-image">
            <h3>{{ pokemon.name | titlecase }}</h3>
            <div class="types">
              @for (type of pokemon.types; track type.id) {
                <span [class]="'type-badge type-' + type.name">{{ type.name }}</span>
              }
            </div>
            <div class="stats-preview">
              <div class="stat">Total: {{ calculateTotalStats(pokemon) }}</div>
            </div>
          </div>
        }
      </div>
      
      <!-- Pagination -->
      <div class="pagination" *ngIf="!loading()">
        <button (click)="previousPage()" [disabled]="currentPage() === 1">Previous</button>
        <span>Page {{ currentPage() }} of {{ totalPages() }}</span>
        <button (click)="nextPage()">Next</button>
      </div>
    </div>
    
    <!-- Pokémon Detail Side Panel -->
    <div class="detail-panel" [class.open]="selectedPokemon()" [class.slide-in]="selectedPokemon()">
      @if (selectedPokemon()) {
        <div class="detail-content">
          <button class="close-btn" (click)="closeDetail()">✕</button>
          <h2>{{ selectedPokemon()?.name | titlecase }}</h2>
          <img [src]="getPokemonImage(selectedPokemon()!)" [alt]="selectedPokemon()?.name">
          
          <!-- Radar Chart will go here -->
          <canvas #radarChart></canvas>
          
          <div class="abilities">
            <h3>Abilities</h3>
            @for (ability of selectedPokemon()?.abilities; track ability.pokemon_v2_ability.name) {
              <div class="ability">
                <strong>{{ ability.pokemon_v2_ability.name | titlecase }}</strong>
                <p>{{ ability.pokemon_v2_ability.pokemon_v2_abilityeffecttexts[0]?.short_effect }}</p>
              </div>
            }
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .pokedex-container { padding: 20px; max-width: 1400px; margin: 0 auto; }
    .filters { display: flex; gap: 20px; margin-bottom: 30px; flex-wrap: wrap; }
    .search-input, select { padding: 10px; border-radius: 5px; border: 1px solid #ddd; }
    .stat-filter { display: flex; gap: 10px; align-items: center; }
    .pokemon-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; }
    .pokemon-card { background: white; border-radius: 10px; padding: 20px; text-align: center; cursor: pointer; transition: transform 0.3s; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .pokemon-card:hover { transform: translateY(-5px); box-shadow: 0 4px 16px rgba(0,0,0,0.2); }
    .pokemon-image { width: 120px; height: 120px; }
    .types { display: flex; justify-content: center; gap: 5px; margin: 10px 0; flex-wrap: wrap; }
    .type-badge { padding: 4px 8px; border-radius: 4px; font-size: 12px; color: white; text-transform: capitalize; }
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
    .loading-spinner { text-align: center; padding: 50px; }
    .pokeball-spin { width: 50px; height: 50px; border: 4px solid #f3f3f3; border-top: 4px solid #ff4444; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
    @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    .pagination { display: flex; justify-content: center; gap: 20px; margin-top: 30px; }
    .pagination button { padding: 10px 20px; background: #667eea; color: white; border: none; border-radius: 5px; cursor: pointer; }
    .pagination button:disabled { opacity: 0.5; cursor: not-allowed; }
    .detail-panel { position: fixed; right: -500px; top: 0; width: 500px; height: 100vh; background: white; box-shadow: -2px 0 8px rgba(0,0,0,0.1); transition: right 0.3s ease-in-out; z-index: 1000; overflow-y: auto; }
    .detail-panel.open { right: 0; }
    .detail-panel.slide-in { animation: slideIn 0.3s ease-out; }
    @keyframes slideIn { from { right: -500px; } to { right: 0; } }
    .detail-content { padding: 20px; position: relative; text-align: center; }
    .close-btn { position: absolute; top: 10px; right: 10px; background: none; border: none; font-size: 24px; cursor: pointer; }
    .abilities { text-align: left; margin-top: 20px; }
    .ability { background: #f5f5f5; padding: 10px; margin: 10px 0; border-radius: 5px; }
  `]
})
export class PokedexPageComponent implements OnInit {
  private pokemonStore = inject(PokemonStore);
  private pokemonSelectors = inject(PokemonSelectors);
  private destroyRef = inject(DestroyRef);
  
  // Signals for UI state
  loading = signal(true);
  currentPage = signal(1);
  searchTerm = signal('');
  typeFilter = signal('');
  minStats = signal(0);
  maxStats = signal(1000);
  selectedPokemon = signal<Pokemon | null>(null);
  types = signal<any[]>([]);
  
  // Computed values
  totalPages = computed(() => Math.ceil(1000 / 20));
  filteredPokemon = signal<Pokemon[]>([]);
  
  private filterSubject = new BehaviorSubject<PokemonFilter>({
    searchTerm: '',
    typeFilter: '',
    sortBy: 'id',
    sortOrder: 'asc',
    minTotalStats: 0,
    maxTotalStats: 1000
  });
  
  // Effect to persist selected trainer to localStorage
  saveSelectedPokemon = effect(() => {
    const pokemon = this.selectedPokemon();
    if (pokemon) {
      localStorage.setItem('lastViewedPokemon', JSON.stringify({ id: pokemon.id, name: pokemon.name, timestamp: new Date() }));
      console.log(`Analytics: User viewed Pokémon ${pokemon.name} (ID: ${pokemon.id})`);
    }
  });
  
  ngOnInit() {
    // Load Pokémon data
    this.pokemonStore.fetchPokemon(20, 0).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe({
      next: () => this.loading.set(false),
      error: () => this.loading.set(false)
    });
    
    // Load types
    this.pokemonStore.fetchTypes().pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(types => this.types.set(types));
    
    // Setup filtered Pokémon with debounce
    combineLatest([
      this.pokemonStore.pokemon$,
      this.filterSubject.asObservable().pipe(debounceTime(300), distinctUntilChanged())
    ]).pipe(
      map(([pokemon, filter]) => {
        let filtered = [...pokemon];
        
        if (filter.searchTerm) {
          const term = filter.searchTerm.toLowerCase();
          filtered = filtered.filter(p => p.name.toLowerCase().includes(term));
        }
        
        if (filter.typeFilter) {
          filtered = filtered.filter(p => p.types.some(t => t.name === filter.typeFilter));
        }
        
        filtered = filtered.filter(p => {
          const total = this.pokemonSelectors.calculateTotalStats(p);
          return total >= filter.minTotalStats && total <= filter.maxTotalStats;
        });
        
        return filtered;
      }),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(filtered => this.filteredPokemon.set(filtered));
    
    // Watch search term changes
    effect(() => {
      this.filterSubject.next({
        searchTerm: this.searchTerm(),
        typeFilter: this.typeFilter(),
        sortBy: 'id',
        sortOrder: 'asc',
        minTotalStats: this.minStats(),
        maxTotalStats: this.maxStats()
      });
    });
  }
  
  getPokemonImage(pokemon: Pokemon): string {
    return pokemon.sprites;
  }
  
  calculateTotalStats(pokemon: Pokemon): number {
    return this.pokemonSelectors.calculateTotalStats(pokemon);
  }
  
  selectPokemon(pokemon: Pokemon) {
    this.selectedPokemon.set(pokemon);
    this.pokemonStore.fetchPokemonById(pokemon.id).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }
  
  closeDetail() {
    this.selectedPokemon.set(null);
  }
  
  previousPage() {
    if (this.currentPage() > 1) {
      this.currentPage.update(page => page - 1);
      const offset = (this.currentPage() - 1) * 20;
      this.pokemonStore.fetchPokemon(20, offset).pipe(
        takeUntilDestroyed(this.destroyRef)
      ).subscribe();
    }
  }
  
  nextPage() {
    this.currentPage.update(page => page + 1);
    const offset = (this.currentPage() - 1) * 20;
    this.pokemonStore.fetchPokemon(20, offset).pipe(
      takeUntilDestroyed(this.destroyRef)
    ).subscribe();
  }
}