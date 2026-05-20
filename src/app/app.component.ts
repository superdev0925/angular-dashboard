import { Component, OnInit, signal, model, computed, inject, ChangeDetectionStrategy, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { PokemonStore, Pokemon } from './state/pokemon.store';
import { PokemonSelectors, PokemonFilter } from './state/pokemon.selectors';
import { TrainerStore, Trainer, Team, Battle, BattleLog } from './state/trainer.store';
import { TrainerSelectors } from './state/trainer.selectors';
import { BehaviorSubject, Subject, fromEvent } from 'rxjs';
import { takeUntil, tap } from 'rxjs/operators';
import { TeamBuilderModalComponent } from './components/team-builder-modal/team-builder-modal.component';
import { TeamBuilderComponent } from './components/team-builder/team-builder.component';
import { PokemonDetailComponent } from './components/pokemon-detail/pokemon-detail.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { DoughnutChartComponent } from './components/charts/doughnut-chart/doughnut-chart.component';
import { ToastContainerComponent } from './components/toast-container/toast-container.component';
import { TypeHighlightDirective } from './directives/type-highlight.directive';
import { VirtualPokedexComponent } from './components/virtual-pokedex/virtual-pokedex.component';
import { ToastService } from './services/toast.service';
import { OfflineService } from './services/offline.service';
import { tabContentAnimation } from './animations/route.animations';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, TeamBuilderModalComponent, TeamBuilderComponent,
    PokemonDetailComponent, DashboardComponent, DoughnutChartComponent, ToastContainerComponent, TypeHighlightDirective,
    VirtualPokedexComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  animations: [tabContentAnimation],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {
  private pokemonStore = inject(PokemonStore);
  private pokemonSelectors = inject(PokemonSelectors);
  private trainerStore = inject(TrainerStore);
  private trainerSelectors = inject(TrainerSelectors);
  private toastService = inject(ToastService);
  readonly offlineService = inject(OfflineService);

  /** Placeholder row indices for skeleton shimmer (Bonus 5). */
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];

  /** Timestamp of the last battle-log poll (updates every 5s on Battles tab). */
  lastBattleFeedPollAt = signal<Date | null>(null);

  private battleLogPollStop$ = new Subject<void>();
  private destroyRef = inject(DestroyRef);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  /** Filter stream for selector pipeline (debounceTime 300 in getFilteredPokemon). */
  private filter$ = new BehaviorSubject<PokemonFilter>({
    searchTerm: '',
    typeFilter: '',
    sortBy: 'id',
    sortOrder: 'asc',
    minTotalStats: 0,
    maxTotalStats: 800,
  });

  /** Bridged from PokemonSelectors via toSignal (requirement). */
  debouncedFilteredPokemon = toSignal(this.pokemonSelectors.getFilteredPokemon(this.filter$), {
    initialValue: [] as Pokemon[],
  });

  storeWinRate = toSignal(this.trainerSelectors.getWinRate(), { initialValue: 0 });
  // Add this property
  defaultSprite = 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';

  // Signals
  sidebarCollapsed = signal(false);
  selectedPokemon = signal<Pokemon | null>(null);
  loading = signal(false);
  currentTrainerId = signal(1);
  
  // Search and filter signals
  searchTerm = signal('');
  typeFilter = signal('');
  minStats = signal(0);
  /** Upper bound matches Pokédex toolbar slider (max="800") so filters stay consistent. */
  maxStats = signal(800);
  sortBy = signal('id');
  sortOrder = signal<'asc' | 'desc'>('asc');
  currentPage = signal(1);
  /** Pokédex page size — 10 / 25 / 50 per spec. */
  itemsPerPage = model(25);
  selectedRowIds = signal<Set<number>>(new Set());
  modalPreselectedIds = signal<number[]>([]);
  profileName = signal('');
  profileRegion = signal('');
  profileRank = signal('');
  profileAvatar = signal('');
  private profileDraftDirty = signal(false);
  /** Two-way filter for type-highlight directive (model API requirement). */
  typeHighlightFilter = model('');
  battleOpponent = signal('');
  battleFilter = signal<'all' | 'win' | 'loss'>('all');
  profileEditing = signal(false);
  readonly gymBadges = [
    'Boulder', 'Cascade', 'Thunder', 'Rainbow', 'Soul', 'Marsh', 'Volcano', 'Earth',
  ];
  battleResult = signal<'win' | 'loss'>('win');
  battleTeamId = signal(1);

  // Trainer data signals
  currentTrainer = signal<Trainer | null>(null);
  teams = signal<Team[]>([]);
  battles = signal<Battle[]>([]);
  battleLogs = signal<BattleLog[]>([]);

  // Pokemon data signals
  pokemonList = signal<Pokemon[]>([]);
  allTypes = signal<any[]>([]);

  /** Unified trainer avatar used across header/sidebar/profile with instant upload preview. */
  trainerAvatarUrl = computed(() =>
    this.profileAvatar() ||
    this.currentTrainer()?.avatar_url ||
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/1.png'
  );

  filteredPokemon = computed(() => this.debouncedFilteredPokemon() ?? []);

  paginatedPokemon = computed(() => {
    const filtered = this.filteredPokemon();
    if (!filtered || filtered.length === 0) return [];
    const start = (this.currentPage() - 1) * this.itemsPerPage();
    const end = start + this.itemsPerPage();
    return filtered.slice(start, end);
  });

  totalPages = computed(() => {
    const total = this.filteredPokemon().length;
    const items = this.itemsPerPage();
    return Math.ceil(total / items) || 1;
  });
  
  totalResults = computed(() => this.filteredPokemon().length);
  showingFrom = computed(() => {
    const total = this.totalResults();
    if (total === 0) return 0;
    return (this.currentPage() - 1) * this.itemsPerPage() + 1;
  });
  showingTo = computed(() => {
    const total = this.totalResults();
    const end = this.currentPage() * this.itemsPerPage();
    return Math.min(end, total);
  });

  winRate = computed(() => {
    const battlesList = this.battles();
    if (!battlesList || battlesList.length === 0) return 0;
    const wins = battlesList.filter(b => b?.result === 'win').length;
    return (wins / battlesList.length) * 100;
  });

  totalWins = computed(() => {
    const battlesList = this.battles();
    return battlesList?.filter(b => b?.result === 'win').length || 0;
  });
  
  totalLosses = computed(() => {
    const battlesList = this.battles();
    return battlesList?.filter(b => b?.result === 'loss').length || 0;
  });

  dashboardChartPokemonId = signal(94);

  chartPokemonOptions = computed(() => this.pokemonList().slice(0, 151));

  dashboardChartPokemon = computed(() => {
    const id = this.dashboardChartPokemonId();
    return this.pokemonList().find((p) => p.id === id) ?? this.selectedPokemon();
  });

  recentBattles = computed(() =>
    [...this.battles()]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
  );

  trainerLevel = computed(() => {
    const trainer = this.currentTrainer();
    return trainer?.id ? 70 + trainer.id * 8 : 78;
  });

  pokedexCatalogTotal = computed(() => {
    return this.pokemonList().length;
  });

  statRangeDistribution = computed(() => {
    const list = this.filteredPokemon();
    const ranges = [
      { name: '0–300', min: 0, max: 300, color: '#6366f1' },
      { name: '301–400', min: 301, max: 400, color: '#8b5cf6' },
      { name: '401–500', min: 401, max: 500, color: '#a78bfa' },
      { name: '501–600', min: 501, max: 600, color: '#c4b5fd' },
      { name: '601+', min: 601, max: 9999, color: '#7c3aed' },
    ];
    const counts = ranges.map((r) => ({
      name: r.name,
      count: list.filter((p) => {
        const t = this.getTotalStats(p);
        return t >= r.min && t <= r.max;
      }).length,
      color: r.color,
    }));
    return counts.filter((c) => c.count > 0);
  });

  typeBreakdownChart = computed(() => {
    const counts = new Map<string, number>();
    const list = this.pokemonList();
    list.forEach((p) => {
      p.types?.forEach((t) => {
        const key = t.name;
        counts.set(key, (counts.get(key) || 0) + 1);
      });
    });
    if (counts.size === 0) return [];
    const sorted = Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, count]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        count,
        color: this.getTypeColor(name),
      }));
    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6).reduce((s, x) => s + x.count, 0);
    if (rest > 0) {
      top.push({ name: 'Others', count: rest, color: '#64748b' });
    }
    return top;
  });

  featuredTypeIcons = computed(() => this.allTypes().slice(0, 4));

  activeTab = signal<'dashboard' | 'pokedex' | 'pokedex-virtual' | 'teams' | 'battles' | 'profile' | 'team-builder'>('dashboard');

  constructor() {
    const savedId = localStorage.getItem('currentTrainerId');
    if (savedId) {
      this.currentTrainerId.set(Number(savedId));
    }

    effect(() => {
      localStorage.setItem('currentTrainerId', String(this.currentTrainerId()));
    });

    effect(() => {
      const pokemon = this.selectedPokemon();
      if (pokemon) {
        console.info('[analytics] pokemon_view', { id: pokemon.id, name: pokemon.name });
      }
    });

    effect(() => {
      this.filter$.next({
        searchTerm: this.searchTerm(),
        typeFilter: this.typeFilter(),
        sortBy: this.sortBy(),
        sortOrder: this.sortOrder(),
        minTotalStats: this.minStats(),
        maxTotalStats: this.maxStats(),
      });
    });

    effect(() => {
      const tab = this.activeTab();
      this.battleLogPollStop$.next();

      if (tab !== 'battles') {
        return;
      }

      this.trainerStore.resetBattleLogPollCursor();
      this.trainerStore
        .fetchBattleLogs()
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.lastBattleFeedPollAt.set(new Date()));

      this.trainerStore
        .pollBattleLogFeed(5000)
        .pipe(
          tap(() => this.lastBattleFeedPollAt.set(new Date())),
          takeUntil(this.battleLogPollStop$),
          takeUntilDestroyed(this.destroyRef)
        )
        .subscribe((newLogs) => {
          if (newLogs.length) {
            this.showToast(`${newLogs.length} new battle log entr${newLogs.length === 1 ? 'y' : 'ies'}`, 'info');
          }
        });
    }, { allowSignalWrites: true });
  }

  /** Switches tab and updates the URL route. */
  setActiveTab(tab: 'dashboard' | 'pokedex' | 'teams' | 'battles' | 'profile' | 'team-builder') {
    this.activeTab.set(tab);
    this.router.navigate(['/' + tab]);
  }
  // Also update the getTitle method to handle 'dashboard'
  getTitle(): string {
    const titles: { [key: string]: string } = {
      dashboard: 'Dashboard',
      pokedex: 'Pokédex',
      teams: 'My Teams',
      battles: 'Battle Log',
      profile: 'Profile',
      'team-builder': 'Team Builder',
    };
    return titles[this.activeTab()] || 'Pokédex';
  }

  onDashboardPokemonChange(id: number): void {
    this.dashboardChartPokemonId.set(id);
    const pokemon = this.pokemonList().find((p) => p.id === id);
    if (pokemon) {
      this.selectedPokemon.set(pokemon);
    }
  }

  onLogout(): void {
    this.showToast('Logged out (demo)', 'info');
  }

  /** Search placeholder text based on the active tab. */
  getSearchPlaceholder(): string {
    const placeholders: Record<string, string> = {
      dashboard: 'Search Pokémon, moves, etc...',
      pokedex: 'Search Pokémon, moves, abilities...',
      teams: 'Search teams...',
      battles: 'Search battles...',
      profile: 'Search profile...',
      'team-builder': 'Search Pokémon to add to your team...',
    };
    return placeholders[this.activeTab()] ?? 'Search...';
  }

  getSubtitle(): string {
    const subtitles: Record<string, string> = {
      dashboard: 'Welcome back — here is your trainer overview',
      pokedex: 'Browse and compare Pokémon stats',
      teams: 'Build and manage your battle squads',
      battles: 'Track your victories and defeats',
      profile: 'Trainer info, badges, and statistics',
      'team-builder': 'Advanced team form — nicknames, items, and competitive EVs',
    };
    return subtitles[this.activeTab()] || '';
  }

  filteredBattles = computed(() => {
    const filter = this.battleFilter();
    const list = this.battles();
    if (filter === 'all') {
      return list;
    }
    return list.filter((b) => b.result === filter);
  });

  ngOnInit() {
    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      const tab = data['tab'] as 'dashboard' | 'pokedex' | 'teams' | 'battles' | 'profile' | 'team-builder' | undefined;
      if (tab) {
        this.activeTab.set(tab);
      }
    });

    this.offlineService.refreshPendingCount();
    fromEvent(window, 'online')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => {
        void this.offlineService.syncPendingMutations().then((count) => {
          this.offlineService.refreshPendingCount();
          if (count > 0) {
            this.showToast(`Synced ${count} queued change(s)`, 'success');
            this.trainerStore.fetchTeams(this.currentTrainerId()).subscribe();
            this.trainerStore.fetchBattles(this.currentTrainerId()).subscribe();
          }
        });
      });

    this.loading.set(true);
    
    this.pokemonStore.pokemon$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.pokemonList.set(data || []);
      this.loading.set(false);
      const gengar = data?.find((p) => p.id === 94);
      if (gengar && !this.selectedPokemon()) {
        this.dashboardChartPokemonId.set(94);
      }
    });
    
    this.pokemonStore.types$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.allTypes.set(data || []);
    });
    
    this.trainerStore.currentTrainer$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.currentTrainer.set(data);
      if (data && !this.profileDraftDirty()) {
        this.profileName.set(data.name);
        this.profileRegion.set(data.region);
        this.profileRank.set(data.rank);
        this.profileAvatar.set(data.avatar_url);
      }
    });
    
    this.trainerStore.teams$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.teams.set(data || []);
    });
    
    this.trainerStore.battles$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.battles.set(data || []);
    });
    
    this.trainerStore.battleLogs$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(data => {
      this.battleLogs.set(data || []);
    });
    
    this.pokemonStore.fetchPokemon(20, 0).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        if (!rows?.length) {
          this.showToast('No Pokémon returned from PokéAPI. Check your connection.', 'error');
        }
      },
      error: () => {
        this.loading.set(false);
        this.showToast('Could not load Pokémon from PokéAPI.', 'error');
      },
    });
    
    this.pokemonStore.fetchTypes().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.pokemonSelectors.typeEffectiveness$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    const trainerId = this.currentTrainerId();
    this.trainerStore.fetchTrainer(trainerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.trainerStore.fetchTeams(trainerId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
    this.trainerStore.fetchBattles(trainerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (data) => {
          if (data?.length) {
            this.battles.set(data);
          }
        },
        error: (err) => console.error(err)
      });

  }

  /**
   * Navigates to Team Builder page
   */
  goToTeamBuilder() {
    this.setActiveTab('team-builder');
  }

  /**
   * Returns the sprite URL for a table/detail row (CDN fallback by ID).
   *
   * @param pokemon - Pokémon row data
   * @returns string - Image URL
   */
  getPokemonSprite(pokemon: Pokemon | null | undefined): string {
    if (!pokemon?.id) {
      return this.defaultSprite;
    }
    const url = pokemon.sprites?.trim();
    if (url && !url.endsWith('/0.png')) {
      return url;
    }
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokemon.id}.png`;
  }

  getStat(pokemon: any, statName: string): number {
    if (!pokemon || !pokemon.stats) return 0;
    const stat = pokemon.stats.find((s: any) => s?.stat?.name === statName);
    return stat?.base_stat || 0;
  }

  getTotalStats(pokemon: any): number {
    if (!pokemon || !pokemon.stats) return 0;
    return pokemon.stats.reduce((sum: number, stat: any) => sum + (stat?.base_stat || 0), 0);
  }

  getTypeColor(type: string | null | undefined): string {
    if (!type) return '#A8A878';
    const colors: {[key: string]: string} = {
      normal: '#A8A878', fire: '#F08030', water: '#6890F0', electric: '#F8D030',
      grass: '#78C850', ice: '#98D8D8', fighting: '#C03028', poison: '#A040A0',
      ground: '#E0C068', flying: '#A890F0', psychic: '#F85888', bug: '#A8B820',
      rock: '#B8A038', ghost: '#705898', dragon: '#7038F8', dark: '#705848',
      steel: '#B8B8D0', fairy: '#EE99AC'
    };
    return colors[type.toLowerCase()] || '#A8A878';
  }

  selectPokemon(pokemon: Pokemon): void {
    // Fetch detailed information including abilities
    this.pokemonStore.fetchPokemonById(pokemon.id).subscribe({
      next: (detailed) => {
        this.selectedPokemon.set(detailed);
      }
    });
  }

  closeDetail(): void {
    this.selectedPokemon.set(null);
  }

  onSearchChange(): void {
    this.currentPage.set(1);
  }

  onTypeFilterChange(): void {
    this.currentPage.set(1);
  }

  onSortChange(column: string): void {
    if (this.sortBy() === column) {
      this.sortOrder.set(this.sortOrder() === 'asc' ? 'desc' : 'asc');
    } else {
      this.sortBy.set(column);
      this.sortOrder.set('asc');
    }
  }

  prevPage(): void {
    if (this.currentPage() > 1) {
      this.currentPage.update(p => p - 1);
    }
  }

  nextPage(): void {
    if (this.currentPage() < this.totalPages()) {
      this.currentPage.update(p => p + 1);
    }
  }

  goToPage(page: number | string): void {
    const pageNum = typeof page === 'number' ? page : parseInt(page, 10);
    if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= this.totalPages()) {
      this.currentPage.set(pageNum);
    }
  }

  getPageNumbers(): (number | string)[] {
    const total = this.totalPages();
    const current = this.currentPage();
    const pages: (number | string)[] = [];
    
    if (total <= 7) {
      for (let i = 1; i <= total; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      let start = Math.max(2, current - 1);
      let end = Math.min(total - 1, current + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (current < total - 2) pages.push('...');
      pages.push(total);
    }
    return pages;
  }

  clearFilters(): void {
    this.searchTerm.set('');
    this.typeFilter.set('');
    this.minStats.set(0);
    this.maxStats.set(800);
    this.currentPage.set(1);
  }

  changeItemsPerPage(value: number | string): void {
    this.itemsPerPage.set(Number(value));
    this.currentPage.set(1);
  }

  toggleSidebar(): void {
    this.sidebarCollapsed.update(v => !v);
  }


  // Add these properties to the AppComponent class
  // Add these methods
  showTeamModal = signal(false);

  /** Opens create-team modal, optionally with pre-selected Pokémon from bulk action. */
  openTeamModal(preselectedIds: number[] = []) {
    this.modalPreselectedIds.set(preselectedIds);
    this.showTeamModal.set(true);
  }

  closeTeamModal() {
    this.showTeamModal.set(false);
    this.modalPreselectedIds.set([]);
  }

  toggleRowSelection(id: number, event: Event): void {
    event.stopPropagation();
    const next = new Set(this.selectedRowIds());
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    this.selectedRowIds.set(next);
  }

  isRowSelected(id: number): boolean {
    return this.selectedRowIds().has(id);
  }

  addSelectedToTeam(): void {
    const ids = Array.from(this.selectedRowIds());
    if (!ids.length) {
      this.showToast('Select at least one Pokémon', 'warning');
      return;
    }
    this.openTeamModal(ids);
  }

  /** Persists trainer profile edits via local GraphQL mutation. */
  saveProfile(): void {
    const trainer = this.currentTrainer();
    if (!trainer) {
      return;
    }
    this.trainerStore
      .updateTrainerProfile({
        id: trainer.id,
        name: this.profileName(),
        region: this.profileRegion(),
        rank: this.profileRank(),
        avatar_url: this.profileAvatar(),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          const updatedAvatar = this.profileAvatar();
          const trainerNow = this.currentTrainer();
          if (trainerNow) {
            this.currentTrainer.set({
              ...trainerNow,
              name: this.profileName(),
              region: this.profileRegion(),
              rank: this.profileRank(),
              avatar_url: updatedAvatar,
            });
          }
          this.profileDraftDirty.set(false);
          this.showToast('Profile updated successfully!', 'success');
        },
        error: () => this.showToast('Failed to update profile. Is mock:graphql running?', 'error'),
      });
  }

  /** Reads an uploaded avatar image and stores it as a data URL for profile save. */
  onAvatarFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    const file = input?.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      this.showToast('Please select an image file', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        this.showToast('Failed to read image file', 'error');
        return;
      }
      this.profileAvatar.set(result);
      this.profileDraftDirty.set(true);
      this.showToast('Avatar ready. Click Save Profile to apply.', 'info');
    };
    reader.onerror = () => this.showToast('Failed to read image file', 'error');
    reader.readAsDataURL(file);
  }

   createTeam(teamData: { name: string; pokemon_ids: number[] }) {
    this.trainerStore.createTeam(this.currentTrainerId(), teamData.name, teamData.pokemon_ids).subscribe({
      next: (newTeam) => {
        this.showTeamModal.set(false);
        this.trainerStore.fetchTeams(this.currentTrainerId()).subscribe((teams) => {
          this.teams.set(teams);
        });
        this.offlineService.refreshPendingCount();
        this.showToast(
          navigator.onLine
            ? `Team "${newTeam.name}" created successfully!`
            : `Team "${newTeam.name}" queued offline — will sync when online`,
          navigator.onLine ? 'success' : 'info'
        );
      },
      error: (error) => {
        console.error('Error creating team:', error);
        const msg = error?.message || error?.graphQLErrors?.[0]?.message;
        this.showToast(
          msg?.includes('Failed to fetch') || msg?.includes('Network')
            ? 'Failed to create team. Start: npm run mock:graphql'
            : `Failed to create team${msg ? ': ' + msg : ''}`,
          'error'
        );
        this.trainerStore.fetchTeams(this.currentTrainerId()).pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
      }
    });
  }

  onTeamCreated(team: Team) {
    this.showTeamModal.set(false);
    this.trainerStore.fetchTeams(this.currentTrainerId()).subscribe((teams) => {
      this.teams.set(teams);
    });
    this.showToast('Team created successfully!', 'success');
  }

  /** Shows a toast notification (Bonus 5). */
  showToast(message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') {
    this.toastService.show(message, type);
  }

  /** Logs a new battle via local GraphQL mutation. */
  logBattle(): void {
    const opponent = this.battleOpponent().trim();
    if (!opponent) {
      this.showToast('Enter an opponent name', 'warning');
      return;
    }
    this.trainerStore
      .logBattle({
        trainer_id: this.currentTrainerId(),
        opponent_name: opponent,
        team_id: this.battleTeamId(),
        result: this.battleResult(),
        date: new Date().toISOString().slice(0, 10),
        score_trainer: this.battleResult() === 'win' ? 3 : 1,
        score_opponent: this.battleResult() === 'win' ? 1 : 3,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.offlineService.refreshPendingCount();
          this.showToast(
            navigator.onLine ? 'Battle logged!' : 'Battle queued offline — will sync when online',
            navigator.onLine ? 'success' : 'info'
          );
          this.battleOpponent.set('');
          if (navigator.onLine) {
            this.trainerStore.fetchBattles(this.currentTrainerId()).subscribe();
          }
        },
        error: () => this.showToast('Failed to log battle. Run npm run mock:graphql', 'error'),
      });
  }

  /** Deletes a team by id. */
  deleteTeam(teamId: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('Delete this team?')) {
      return;
    }
    this.trainerStore
      .deleteTeam(teamId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showToast('Team deleted', 'success');
          this.trainerStore.fetchTeams(this.currentTrainerId()).subscribe();
        },
        error: () => this.showToast('Failed to delete team', 'error'),
      });
  }

  /** Sum of base stats for Pokémon on a team. */
  teamTotalStats(team: Team): number {
    return team.pokemon_ids.reduce((sum, id) => {
      const p = this.pokemonList().find((x) => x.id === id);
      return sum + (p ? this.pokemonSelectors.calculateTotalStats(p) : 0);
    }, 0);
  }

  emptyTeamSlots(team: Team): number[] {
    const empty = Math.max(0, 6 - team.pokemon_ids.length);
    return Array.from({ length: empty });
  }

  getTeamStrategy(team: Team): string {
    const power = this.teamTotalStats(team);
    if (power >= 2500) return 'Offensive';
    if (power >= 1800) return 'Balanced';
    return 'Defensive';
  }

  getTeamName(teamId: number): string {
    return this.teams().find((t) => t.id === teamId)?.name ?? '—';
  }

  getOpponentAvatar(name: string): string {
    const id = (name.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 16) + 1;
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/trainers/${id}.png`;
  }

  getBattleType(battle: Battle): string {
    return battle.result === 'win' ? 'Ranked' : 'Casual';
  }

  formatRelativeTime(dateStr: string): string {
    const date = new Date(dateStr);
    if (Number.isNaN(date.getTime())) {
      return dateStr;
    }
    const diffMs = Date.now() - date.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `${Math.max(1, mins)}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return date.toLocaleDateString();
  }

  getDefendingTypes(pokemon: Pokemon): string[] {
    return (pokemon.types || []).map((t) => t.name);
  }


 handleTeamCreated(team: Team) {
    this.onTeamCreated(team);
  } 
  // Add these properties
  selectedPokemonForChart = computed(() => this.selectedPokemon());

  teamTypeDistribution = computed(() => {
    const teamTypes = new Map<string, number>();
    
    this.teams().forEach(team => {
      team.pokemon_ids.forEach(id => {
        const pokemon = this.pokemonList().find(p => p.id === id);
        if (pokemon && pokemon.types) {
          pokemon.types.forEach(type => {
            teamTypes.set(type.name, (teamTypes.get(type.name) || 0) + 1);
          });
        }
      });
    });
    
    return Array.from(teamTypes.entries()).map(([name, count]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      count,
      color: this.getTypeColor(name)
    })).slice(0, 6); // Show top 6 types
  });

  
}
