import { Component, OnInit, signal, model, computed, inject, ChangeDetectionStrategy, effect, DestroyRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { PokemonStore, Pokemon } from './state/pokemon.store';
import { PokemonSelectors, PokemonFilter } from './state/pokemon.selectors';
import { TrainerStore, Trainer, Team, Battle, BattleLog } from './state/trainer.store';
import { TrainerSelectors } from './state/trainer.selectors';
import { BehaviorSubject, fromEvent } from 'rxjs';
import { TeamBuilderModalComponent } from './components/team-builder-modal/team-builder-modal.component';
import { TeamBuilderComponent } from './components/team-builder/team-builder.component';
import { PokemonDetailComponent } from './components/pokemon-detail/pokemon-detail.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { ToastContainerComponent } from './components/toast-container/toast-container.component';
import { VirtualPokedexComponent } from './components/virtual-pokedex/virtual-pokedex.component';
import { ToastService } from './services/toast.service';
import { OfflineService } from './services/offline.service';
import { tabContentAnimation } from './animations/route.animations';
import {
  DEFAULT_TRAINER_AVATAR,
  resolveOpponentAvatarUrl,
  resolveTrainerAvatarUrl,
} from './utils/avatar-url';
import {
  PokedexTableRowStats,
  PokemonStatKey,
  getPokedexTableRowStats,
  getPokemonStat,
  getPokemonTotal,
} from './utils/pokemon-stats.util';
import { ThemeService, ThemeMode } from './services/theme.service';

@Component({
  selector: 'app-main',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, DragDropModule, TeamBuilderModalComponent, TeamBuilderComponent,
    PokemonDetailComponent, DashboardComponent, ToastContainerComponent,
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
  readonly themeService = inject(ThemeService);

  settingsOpen = signal(false);

  /** Placeholder row indices for skeleton shimmer (Bonus 5). */
  readonly skeletonRows = [0, 1, 2, 3, 4, 5, 6, 7];

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
  /** ≤768px: persistent icon-only sidebar rail (no expand drawer). */
  isMobile = signal(false);
  sidebarRail = computed(() => this.sidebarCollapsed() || this.isMobile());
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
  avatarFileName = signal('');
  private profileDraftDirty = signal(false);
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

  readonly defaultTrainerAvatar = DEFAULT_TRAINER_AVATAR;

  /** Unified trainer avatar used across header/sidebar/profile with instant upload preview. */
  trainerAvatarUrl = computed(() =>
    resolveTrainerAvatarUrl(
      this.profileAvatar() || this.currentTrainer()?.avatar_url
    )
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

  dashboardChartPokemonId = signal(1);

  chartPokemonOptions = computed(() => this.pokemonList());

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

  }

  /** Switches tab and updates the URL route. */
  setActiveTab(tab: 'dashboard' | 'pokedex' | 'pokedex-virtual' | 'teams' | 'battles' | 'profile' | 'team-builder') {
    if (tab !== 'team-builder') {
      this.editingTeamId.set(null);
    }
    this.activeTab.set(tab);
    this.router.navigate(['/' + tab]);
  }
  // Also update the getTitle method to handle 'dashboard'
  getTitle(): string {
    const titles: { [key: string]: string } = {
      dashboard: 'Dashboard',
      pokedex: 'Pokédex',
      'pokedex-virtual': 'Virtual Pokédex',
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
    return 'Search...';
  }

  getSubtitle(): string {
    const subtitles: Record<string, string> = {
      dashboard: 'Welcome back — here is your trainer overview',
      pokedex: 'Browse and compare Pokémon stats',
      'pokedex-virtual': 'CDK virtual scroll with lazy batches of 20',
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
    if (typeof window !== 'undefined') {
      const mq = window.matchMedia('(max-width: 768px)');
      const syncMobile = () => this.isMobile.set(mq.matches);
      syncMobile();
      mq.addEventListener('change', syncMobile);
      this.destroyRef.onDestroy(() => mq.removeEventListener('change', syncMobile));
    }

    this.route.data.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      const tab = data['tab'] as
        | 'dashboard'
        | 'pokedex'
        | 'pokedex-virtual'
        | 'teams'
        | 'battles'
        | 'profile'
        | 'team-builder'
        | undefined;
      if (tab) {
        this.activeTab.set(tab);
      }
    });

    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const raw = params.get('teamId');
      if (this.activeTab() === 'team-builder') {
        this.editingTeamId.set(raw ? Number(raw) : null);
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

    this.pokemonStore.loading$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((isLoading) => {
      this.loading.set(isLoading);
    });

    this.pokemonStore.pokemon$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((data) => {
      this.pokemonList.set(data || []);
      const list = data ?? [];
      if (list.length && !list.some((p) => p.id === this.dashboardChartPokemonId())) {
        this.dashboardChartPokemonId.set(list[0].id);
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
    
    this.pokemonStore.fetchAllPokemon().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (rows) => {
        if (!rows?.length) {
          this.showToast('No Pokémon returned from PokéAPI. Check your connection.', 'error');
        }
      },
      error: () => {
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

    this.trainerStore.fetchBattleLogs().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  /**
   * Opens Advanced Builder — create new, or edit when a team is passed.
   */
  goToTeamBuilder(team?: Team) {
    const teamId = team?.id ?? null;
    this.editingTeamId.set(teamId);
    this.activeTab.set('team-builder');
    this.router.navigate(
      ['/team-builder'],
      teamId != null ? { queryParams: { teamId } } : { queryParams: {} }
    );
  }

  /** Quick edit: name + Pokémon via modal (stays on Teams page). */
  editTeam(team: Team, event?: Event) {
    this.openEditTeamModal(team, event);
  }

  onTeamBuilderSaved(_team: Team) {
    this.editingTeamId.set(null);
    this.trainerStore.fetchTeams(this.currentTrainerId()).subscribe((teams) => {
      this.teams.set(teams);
    });
    this.setActiveTab('teams');
  }

  onTeamBuilderCancel() {
    this.editingTeamId.set(null);
    this.setActiveTab('teams');
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

  getStat(pokemon: Pokemon | null | undefined, statName: string): number {
    return getPokemonStat(pokemon?.stats, statName as PokemonStatKey);
  }

  getTotalStats(pokemon: Pokemon | null | undefined): number {
    return getPokemonTotal(pokemon?.stats);
  }

  /** Stable per-row stat bundle for the Pokédex table. */
  getTableRowStats(pokemon: Pokemon | null | undefined): PokedexTableRowStats {
    return getPokedexTableRowStats(pokemon?.stats);
  }

  trackByPokemonId(_index: number, pokemon: Pokemon): number {
    return pokemon.id;
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
    // Open panel immediately with list row data; enrich from API in background
    this.selectedPokemon.set(pokemon);
    this.pokemonStore.fetchPokemonById(pokemon.id).subscribe({
      next: (detailed) => {
        this.selectedPokemon.set(detailed);
      },
      error: () => {
        this.showToast('Could not load full Pokémon details — showing cached row data', 'warning');
      },
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
    if (this.isMobile()) {
      return;
    }
    this.sidebarCollapsed.update((v) => !v);
  }

  toggleSettingsPanel(): void {
    this.settingsOpen.update((open) => !open);
  }

  setTheme(mode: ThemeMode): void {
    this.themeService.setTheme(mode);
    this.settingsOpen.set(false);
  }


  // Add these properties to the AppComponent class
  // Add these methods
  showTeamModal = signal(false);
  /** Team being edited in the quick Edit modal (null = create new). */
  editingTeamForModal = signal<Team | null>(null);
  /** Team being edited in Advanced Builder (null = create new). */
  editingTeamId = signal<number | null>(null);

  /** Opens create-team modal, optionally with pre-selected Pokémon from bulk action. */
  openTeamModal(preselectedIds: number[] = []) {
    this.editingTeamForModal.set(null);
    this.modalPreselectedIds.set(preselectedIds);
    this.showTeamModal.set(true);
  }

  /** Opens the Edit Team modal with the selected squad loaded. */
  openEditTeamModal(team: Team, event?: Event) {
    event?.stopPropagation();
    this.editingTeamForModal.set(team);
    this.modalPreselectedIds.set([]);
    this.showTeamModal.set(true);
  }

  closeTeamModal() {
    this.showTeamModal.set(false);
    this.editingTeamForModal.set(null);
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

  /**
   * Handles drag-and-drop from the Pokédex table into the team queue (Bonus 2).
   *
   * @param event - CDK drop event carrying Pokémon row data
   */
  onPokemonDroppedToTeam(event: CdkDragDrop<Pokemon>): void {
    const pokemon = event.item.data as Pokemon;
    if (!pokemon?.id) {
      return;
    }
    const merged = [...new Set([...this.modalPreselectedIds(), pokemon.id])].slice(0, 6);
    this.modalPreselectedIds.set(merged);
    this.showToast(`${pokemon.name} queued for Team Builder`, 'success');
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
          this.avatarFileName.set('');
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
      this.avatarFileName.set(file.name);
      this.profileDraftDirty.set(true);
      this.showToast('Avatar ready. Click Save Profile to apply.', 'info');
      if (input) {
        input.value = '';
      }
    };
    reader.onerror = () => this.showToast('Failed to read image file', 'error');
    reader.readAsDataURL(file);
  }

  updateTeam(teamData: { id: number; name: string; pokemon_ids: number[] }) {
    this.trainerStore
      .updateTeam(teamData.id, teamData.name, teamData.pokemon_ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (updated) => {
          this.closeTeamModal();
          this.trainerStore.fetchTeams(this.currentTrainerId()).subscribe((teams) => {
            this.teams.set(teams);
          });
          this.showToast(`Team "${updated.name}" updated successfully!`, 'success');
        },
        error: (error) => {
          console.error('Error updating team:', error);
          const msg = error?.message || error?.graphQLErrors?.[0]?.message;
          this.showToast(
            msg?.includes('Failed to fetch') || msg?.includes('Network')
              ? 'Failed to update team. Start: npm run mock:graphql'
              : `Failed to update team${msg ? ': ' + msg : ''}`,
            'error'
          );
        },
      });
  }

  onTeamModalSave(teamData: { id?: number; name: string; pokemon_ids: number[] }) {
    if (teamData.id != null) {
      this.updateTeam({ id: teamData.id, name: teamData.name, pokemon_ids: teamData.pokemon_ids });
      return;
    }
    this.createTeam({ name: teamData.name, pokemon_ids: teamData.pokemon_ids });
  }

  createTeam(teamData: { name: string; pokemon_ids: number[] }) {
    this.trainerStore.createTeam(this.currentTrainerId(), teamData.name, teamData.pokemon_ids).subscribe({
      next: (newTeam) => {
        this.closeTeamModal();
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

  /** Team pending delete confirmation (null = modal closed). */
  deleteConfirmTeam = signal<Team | null>(null);

  /** Opens the delete confirmation modal. */
  requestDeleteTeam(team: Team, event: Event): void {
    event.stopPropagation();
    this.deleteConfirmTeam.set(team);
  }

  cancelDeleteTeam(): void {
    this.deleteConfirmTeam.set(null);
  }

  confirmDeleteTeam(): void {
    const team = this.deleteConfirmTeam();
    if (!team) {
      return;
    }
    this.trainerStore
      .deleteTeam(team.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.deleteConfirmTeam.set(null);
          this.showToast(`Team "${team.name}" deleted`, 'success');
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

  /** Swaps broken remote avatar URLs to the bundled default image. */
  onTrainerAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (img.src.includes(DEFAULT_TRAINER_AVATAR)) {
      return;
    }
    img.src = this.defaultTrainerAvatar;
  }

  getOpponentAvatar(name: string): string {
    return resolveOpponentAvatarUrl(name);
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
