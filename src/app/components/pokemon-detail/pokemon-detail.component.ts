import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { Pokemon } from '../../state/pokemon.store';

/** Static map: Pokémon ID → YouTube video ID (embed) — first 20 species. */
const POKEMON_VIDEO_MAP: Record<number, string> = {
  1: 'yQEV3s7x1B4',
  2: 'yQEV3s7x1B4',
  3: 'yQEV3s7x1B4',
  4: '2nk9oZuQJ7k',
  5: '2nk9oZuQJ7k',
  6: 'k7x5zY9wQ2A',
  7: '2nk9oZuQJ7k',
  8: '2nk9oZuQJ7k',
  9: 'k7x5zY9wQ2A',
  10: 'yQEV3s7x1B4',
  11: 'yQEV3s7x1B4',
  12: 'yQEV3s7x1B4',
  13: 'yQEV3s7x1B4',
  14: 'yQEV3s7x1B4',
  15: 'b6WPko7BM8o',
  16: 'yQEV3s7x1B4',
  17: 'yQEV3s7x1B4',
  18: 'yQEV3s7x1B4',
  19: 'yQEV3s7x1B4',
  20: 'yQEV3s7x1B4',
};

@Component({
  selector: 'app-pokemon-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="detail-overlay" [class.open]="isOpen()" (click)="close()">
      <div class="detail-panel" [class.slide-in]="isOpen()" (click)="$event.stopPropagation()">
        <div class="detail-header">
          <div class="header-info">
            <span class="pokemon-id">#{{ pokemon()?.id || 0 }}</span>
            <h2>{{ (pokemon()?.name || 'Unknown') | titlecase }}</h2>
          </div>
          <button type="button" class="close-btn" (click)="close()" aria-label="Close">✕</button>
        </div>

        <div class="detail-content">
          <div class="pokemon-image-container">
            <img
              [src]="spriteUrl()"
              [alt]="pokemon()?.name"
              class="pokemon-image" />
          </div>

          <div class="types-container">
            <span
              *ngFor="let type of (pokemon()?.types || [])"
              [class]="'type-badge type-' + (type?.name || 'normal')">
              {{ type?.name || 'normal' }}
            </span>
          </div>

          <!-- Cry player (bonus) -->
          <section class="cry-section" aria-label="Pokémon cry">
            <div class="cry-header">
              <h3>Pokémon Cry</h3>
              <span class="cry-status">{{ cryStatus() }}</span>
            </div>
            <div class="cry-player">
              <button
                type="button"
                class="cry-play-btn"
                (click)="toggleCry()"
                [attr.aria-label]="isCryPlaying() ? 'Pause cry' : 'Play cry'">
                {{ isCryPlaying() ? '⏸' : '▶' }}
              </button>
              <div class="waveform" [class.active]="isCryPlaying()">
                <span
                  *ngFor="let bar of waveformBars; let i = index"
                  class="wave-bar"
                  [style.animation-delay.ms]="i * 45"
                  [style.height.%]="barHeights()[i]"></span>
              </div>
            </div>
          </section>

          <!-- Video player -->
          <section class="media-section" aria-label="Pokémon video">
            <h3>{{ videoLabel() }}</h3>

            <div class="video-wrap" *ngIf="hasVideo(); else noVideo">
              <div class="video-frame">
                <iframe
                  *ngIf="videoPlaying()"
                  [src]="safeVideoUrl()"
                  title="Pokémon video"
                  frameborder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowfullscreen></iframe>

                <div
                  class="video-poster"
                  *ngIf="!videoPlaying()"
                  [style.backgroundImage]="'url(' + youtubeThumbnail() + ')'"></div>

                <button
                  type="button"
                  class="video-overlay-btn"
                  (click)="toggleVideoPlayback()"
                  [attr.aria-label]="videoPlaying() ? 'Pause video' : 'Play video'">
                  <span class="overlay-icon">{{ videoPlaying() ? '⏸' : '▶' }}</span>
                  <span class="overlay-text">{{ videoPlaying() ? 'Pause' : 'Play' }}</span>
                </button>
              </div>
            </div>

            <ng-template #noVideo>
              <div class="video-placeholder">
                <img
                  [src]="officialArtworkUrl()"
                  [alt]="(pokemon()?.name || 'Pokémon') + ' official artwork'"
                  class="placeholder-art" />
                <div class="placeholder-overlay">
                  <span class="placeholder-icon">🎬</span>
                  <p>No video available</p>
                </div>
              </div>
            </ng-template>
          </section>

          <div class="stats-section">
            <h3>Base Stats</h3>
            <div class="stats-grid">
              <div *ngFor="let stat of (pokemon()?.stats || [])" class="stat-row">
                <span class="stat-name">{{ formatStatName(stat?.stat?.name) }}</span>
                <div class="stat-bar-container">
                  <div
                    class="stat-bar"
                    [style.width.%]="((stat?.base_stat || 0) / 255) * 100"></div>
                </div>
                <span class="stat-value">{{ stat?.base_stat || 0 }}</span>
              </div>
            </div>
          </div>

          <section class="detail-section" *ngIf="abilityEntries().length">
            <h3>Abilities</h3>
            <ul class="tag-list">
              <li *ngFor="let ability of abilityEntries()" class="detail-tag">
                {{ ability.name | titlecase }}
                <span *ngIf="ability.hidden" class="hidden-badge">Hidden</span>
              </li>
            </ul>
          </section>

          <section class="detail-section" *ngIf="pokemon()?.moves?.length">
            <h3>Moves</h3>
            <ul class="tag-list moves-list">
              <li *ngFor="let move of pokemon()!.moves!.slice(0, 12)" class="detail-tag">{{ move | titlecase }}</li>
            </ul>
          </section>

          <section class="detail-section" *ngIf="pokemon()?.evolutionChain?.length">
            <h3>Evolution Chain</h3>
            <p class="evo-chain">{{ evolutionChainLabel() }}</p>
          </section>

          <div class="info-section">
            <div class="info-card">
              <span class="info-label">Height</span>
              <span class="info-value">{{ (pokemon()?.height || 0) / 10 }} m</span>
            </div>
            <div class="info-card">
              <span class="info-label">Weight</span>
              <span class="info-value">{{ (pokemon()?.weight || 0) / 10 }} kg</span>
            </div>
            <div class="info-card">
              <span class="info-label">Base EXP</span>
              <span class="info-value">{{ pokemon()?.base_experience || 0 }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .detail-overlay {
      position: fixed;
      inset: 0;
      background: var(--modal-overlay-bg);
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;
    }

    .detail-overlay.open {
      opacity: 1;
      visibility: visible;
    }

    .detail-panel {
      position: fixed;
      right: 0;
      top: 0;
      width: min(500px, 100vw);
      height: 100vh;
      background: var(--modal-panel-bg);
      color: var(--text-body);
      transform: translateX(100%);
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      overflow-y: auto;
      box-shadow: var(--modal-panel-shadow);
    }

    .detail-panel.slide-in {
      transform: translateX(0);
    }

    .detail-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
      background: linear-gradient(135deg, #4c1d95, #7c3aed);
      color: #f8fafc;
    }

    .header-info h2 {
      margin: 4px 0 0;
      font-size: 1.5rem;
      color: #f8fafc;
    }

    .pokemon-id {
      font-size: 0.85rem;
      color: #ddd6fe;
    }

    .close-btn {
      background: rgba(255, 255, 255, 0.15);
      border: none;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      font-size: 1.1rem;
      cursor: pointer;
      color: #f8fafc;
    }

    .detail-content {
      padding: 20px;
    }

    .pokemon-image-container {
      text-align: center;
      padding: 12px;
      background: var(--modal-section-bg);
      border-radius: 16px;
      border: 1px solid var(--modal-section-border);
    }

    .pokemon-image {
      width: 180px;
      height: 180px;
      image-rendering: pixelated;
    }

    .types-container {
      display: flex;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
      margin: 20px 0;
    }

    .type-badge {
      padding: 6px 16px;
      border-radius: 30px;
      font-size: 13px;
      color: #fff;
      text-transform: capitalize;
    }

    .cry-section,
    .media-section {
      margin: 16px 0;
    }

    .stats-section {
      margin-bottom: 24px;
    }

    .cry-section h3,
    .media-section h3,
    .stats-section h3 {
      margin: 0 0 12px;
      font-size: 1rem;
      color: var(--modal-heading);
      font-weight: 600;
    }

    .cry-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }

    .cry-status {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .cry-player {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--modal-section-bg);
      border: 1px solid var(--modal-section-border);
      border-radius: 12px;
    }

    .cry-play-btn {
      width: 44px;
      height: 44px;
      border: none;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      font-size: 1rem;
      cursor: pointer;
      flex-shrink: 0;
    }

    .waveform {
      display: flex;
      align-items: flex-end;
      gap: 4px;
      flex: 1;
      height: 40px;
    }

    .wave-bar {
      flex: 1;
      min-width: 4px;
      max-width: 10px;
      background: var(--modal-wave-bar);
      border-radius: 3px;
      height: 30%;
      transition: height 0.15s ease;
    }

    .waveform.active .wave-bar {
      animation: wave-pulse 0.7s ease-in-out infinite alternate;
      background: linear-gradient(180deg, #a78bfa, #6366f1);
    }

    @keyframes wave-pulse {
      from { transform: scaleY(0.35); opacity: 0.55; }
      to { transform: scaleY(1); opacity: 1; }
    }

    .video-wrap {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid var(--modal-section-border);
    }

    .video-frame {
      position: relative;
      width: 100%;
      aspect-ratio: 16 / 9;
      background: var(--modal-media-bg);
    }

    .video-frame iframe {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
      border: 0;
    }

    .video-poster {
      position: absolute;
      inset: 0;
      background-size: cover;
      background-position: center;
      filter: brightness(0.55);
    }

    .video-overlay-btn {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      border: none;
      background: var(--modal-video-overlay);
      cursor: pointer;
      color: var(--text-heading);
      transition: background 0.2s;
    }

    .video-overlay-btn:hover {
      background: var(--modal-placeholder-overlay);
    }

    .overlay-icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(124, 58, 237, 0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 1.4rem;
      box-shadow: 0 4px 20px rgba(124, 58, 237, 0.45);
    }

    .overlay-text {
      font-size: 0.85rem;
      font-weight: 600;
      color: var(--modal-overlay-text);
    }

    .video-placeholder {
      position: relative;
      border-radius: 12px;
      overflow: hidden;
      aspect-ratio: 16 / 9;
      background: var(--modal-media-bg);
      border: 1px solid var(--modal-section-border);
    }

    .placeholder-art {
      width: 100%;
      height: 100%;
      object-fit: cover;
      opacity: 0.85;
    }

    .placeholder-overlay {
      position: absolute;
      inset: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: var(--modal-placeholder-overlay);
      color: var(--text-body);
      gap: 8px;
    }

    .placeholder-icon {
      font-size: 2rem;
    }

    .placeholder-overlay p {
      margin: 0;
      font-weight: 600;
      color: var(--text-heading);
    }

    .stat-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin: 10px 0;
    }

    .stat-name {
      width: 72px;
      font-size: 0.72rem;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.03em;
    }

    .stat-bar-container {
      flex: 1;
      height: 8px;
      background: var(--modal-stat-track);
      border-radius: 4px;
      overflow: hidden;
    }

    .stat-bar {
      height: 100%;
      background: linear-gradient(90deg, #6366f1, #a855f7);
      border-radius: 4px;
      transition: width 0.5s ease;
    }

    .stat-value {
      width: 36px;
      text-align: right;
      font-weight: 700;
      color: var(--text-heading);
    }

    .detail-section {
      margin-top: 20px;
      padding-top: 16px;
      border-top: 1px solid var(--modal-section-border);

      h3 {
        margin: 0 0 10px;
        font-size: 0.95rem;
        color: var(--modal-heading);
      }
    }

    .tag-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .detail-tag {
      padding: 6px 12px;
      border-radius: 999px;
      background: var(--modal-section-bg);
      border: 1px solid var(--modal-section-border);
      font-size: 12px;
      color: var(--text-body);
      text-transform: capitalize;
    }

    .hidden-badge {
      margin-left: 6px;
      font-size: 10px;
      font-weight: 700;
      color: var(--primary);
      text-transform: uppercase;
    }

    .moves-list {
      max-height: 120px;
      overflow-y: auto;
    }

    .evo-chain {
      margin: 0;
      font-size: 14px;
      line-height: 1.6;
      color: var(--text-body);
    }

    .info-section {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .info-card {
      text-align: center;
      padding: 12px 8px;
      background: var(--modal-section-bg);
      border: 1px solid var(--modal-section-border);
      border-radius: 10px;
    }

    .info-label {
      display: block;
      font-size: 0.7rem;
      color: var(--text-muted);
      margin-bottom: 4px;
    }

    .info-value {
      font-weight: 700;
      color: var(--text-heading);
    }

    .type-normal { background: #a8a878; }
    .type-fire { background: #f08030; }
    .type-water { background: #6890f0; }
    .type-electric { background: #f8d030; color: #1e293b; }
    .type-grass { background: #78c850; }
    .type-ice { background: #98d8d8; color: #1e293b; }
    .type-fighting { background: #c03028; }
    .type-poison { background: #a040a0; }
    .type-ground { background: #e0c068; color: #1e293b; }
    .type-flying { background: #a890f0; }
    .type-psychic { background: #f85888; }
    .type-bug { background: #a8b820; color: #1e293b; }
    .type-rock { background: #b8a038; }
    .type-ghost { background: #705898; }
    .type-dragon { background: #7038f8; }
    .type-dark { background: #705848; }
    .type-steel { background: #b8b8d0; color: #1e293b; }
    .type-fairy { background: #ee99ac; color: #1e293b; }
  `],
})
export class PokemonDetailComponent {
  pokemon = input<Pokemon | null>(null);
  isOpen = input(false);
  closePanel = output<void>();

  private sanitizer = inject(DomSanitizer);
  private destroyRef = inject(DestroyRef);

  safeVideoUrl = signal<SafeResourceUrl | null>(null);
  videoPlaying = signal(false);
  isCryPlaying = signal(false);
  cryStatus = signal('Tap play to hear cry');
  videoKind = signal<'mapped' | 'none'>('none');

  readonly waveformBars = Array.from({ length: 16 }, (_, i) => i);
  barHeights = signal<number[]>(this.waveformBars.map(() => 25 + Math.random() * 55));

  defaultSprite =
    'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/0.png';

  private audio: HTMLAudioElement | null = null;
  private waveInterval: ReturnType<typeof setInterval> | null = null;

  videoLabel = computed(() =>
    this.videoKind() === 'mapped' ? 'Featured Video' : 'Video'
  );

  hasVideo = computed(() => this.videoKind() !== 'none');

  /** Normalized ability rows for the detail panel. */
  abilityEntries = computed((): { name: string; hidden: boolean }[] => {
    const raw = this.pokemon()?.abilities;
    if (!raw?.length) {
      return [];
    }
    return raw.map((entry: { pokemon_v2_ability?: { name: string }; is_hidden?: boolean; name?: string }) => ({
      name: entry.pokemon_v2_ability?.name ?? entry.name ?? 'unknown',
      hidden: !!entry.is_hidden,
    }));
  });

  /** Evolution chain as a readable arrow-separated label. */
  evolutionChainLabel = computed(() =>
    (this.pokemon()?.evolutionChain ?? [])
      .map((s) => s.replace(/-/g, ' '))
      .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
      .join(' → ')
  );

  spriteUrl = computed(() => {
    const p = this.pokemon();
    if (!p?.id) {
      return this.defaultSprite;
    }
    const url = p.sprites?.trim();
    if (url && !url.endsWith('/0.png')) {
      return url;
    }
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`;
  });

  constructor() {
    effect(
      () => {
        const p = this.pokemon();
        this.resetMediaForPokemonChange();

        if (!p?.id) {
          this.videoKind.set('none');
          this.safeVideoUrl.set(null);
          return;
        }

        const mappedId = POKEMON_VIDEO_MAP[p.id];
        if (mappedId) {
          this.videoKind.set('mapped');
          this.safeVideoUrl.set(this.buildSafeEmbedUrl(mappedId));
          return;
        }

        this.videoKind.set('none');
        this.safeVideoUrl.set(null);
      },
      { allowSignalWrites: true }
    );

    this.destroyRef.onDestroy(() => {
      this.stopVideo();
      this.stopCry();
    });
  }

  /**
   * Builds a trusted YouTube embed URL via DomSanitizer.
   *
   * @param videoId - YouTube video ID
   * @returns SafeResourceUrl for iframe [src]
   */
  buildSafeEmbedUrl(videoId: string): SafeResourceUrl {
    const url = `https://www.youtube.com/embed/${videoId}?rel=0&modestbranding=1`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  }

  /**
   * Returns YouTube thumbnail URL for the poster overlay.
   */
  youtubeThumbnail(): string {
    const p = this.pokemon();
    if (!p) return '';
    const id = POKEMON_VIDEO_MAP[p.id];
    if (!id) return this.officialArtworkUrl();
    return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  }

  /**
   * Official artwork URL for the no-video placeholder.
   */
  officialArtworkUrl(): string {
    const id = this.pokemon()?.id ?? 0;
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
  }

  /**
   * Toggles custom play/pause overlay (loads or unloads iframe).
   */
  toggleVideoPlayback(): void {
    if (this.videoPlaying()) {
      this.stopVideo();
    } else {
      const base = this.safeVideoUrl();
      if (!base || !this.pokemon()) return;
      const id = POKEMON_VIDEO_MAP[this.pokemon()!.id];
      if (!id) return;
      const autoplayUrl = `https://www.youtube.com/embed/${id}?rel=0&modestbranding=1&autoplay=1`;
      this.safeVideoUrl.set(this.sanitizer.bypassSecurityTrustResourceUrl(autoplayUrl));
      this.videoPlaying.set(true);
    }
  }

  /**
   * Resets video/cry UI when the selected Pokémon changes (used inside effect).
   */
  private resetMediaForPokemonChange(): void {
    this.videoPlaying.set(false);
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.isCryPlaying.set(false);
    this.stopWaveAnimation();
    if (!this.cryStatus().includes('unavailable') && !this.cryStatus().includes('blocked')) {
      this.cryStatus.set('Tap play to hear cry');
    }
  }

  /**
   * Stops video playback by removing the iframe.
   */
  stopVideo(): void {
    this.videoPlaying.set(false);
    const p = this.pokemon();
    if (!p) return;
    const id = POKEMON_VIDEO_MAP[p.id];
    if (id) {
      this.safeVideoUrl.set(this.buildSafeEmbedUrl(id));
    }
  }

  /**
   * Plays or pauses the Pokémon cry from PokeAPI cries CDN.
   */
  toggleCry(): void {
    const p = this.pokemon();
    if (!p?.id) return;

    if (this.isCryPlaying()) {
      this.stopCry();
      return;
    }

    const cryUrl = `https://raw.githubusercontent.com/PokeAPI/cries/main/cries/pokemon/latest/${p.id}.ogg`;
    this.audio = new Audio(cryUrl);
    this.cryStatus.set('Loading cry…');

    this.audio.addEventListener('playing', () => {
      this.isCryPlaying.set(true);
      this.cryStatus.set(`Playing ${p.name} cry`);
      this.startWaveAnimation();
    });

    this.audio.addEventListener('ended', () => this.stopCry());
    this.audio.addEventListener('error', () => {
      this.cryStatus.set('Cry unavailable for this Pokémon');
      this.stopCry();
    });

    this.audio.play().catch(() => {
      this.cryStatus.set('Could not play cry (browser blocked audio)');
      this.stopCry();
    });
  }

  /**
   * Stops cry audio and waveform animation.
   */
  stopCry(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio = null;
    }
    this.isCryPlaying.set(false);
    this.stopWaveAnimation();
    if (!this.cryStatus().includes('unavailable') && !this.cryStatus().includes('blocked')) {
      this.cryStatus.set('Tap play to hear cry');
    }
  }

  /**
   * Animates waveform bar heights while cry is playing.
   */
  startWaveAnimation(): void {
    this.stopWaveAnimation();
    this.waveInterval = setInterval(() => {
      this.barHeights.set(this.waveformBars.map(() => 20 + Math.random() * 75));
    }, 120);
  }

  /**
   * Clears waveform animation interval.
   */
  stopWaveAnimation(): void {
    if (this.waveInterval) {
      clearInterval(this.waveInterval);
      this.waveInterval = null;
    }
    this.barHeights.set(this.waveformBars.map(() => 25 + Math.random() * 30));
  }

  /**
   * Formats stat API names for display (e.g. special-attack → Sp. Atk).
   *
   * @param name - Raw stat name from API
   * @returns Human-readable label
   */
  formatStatName(name?: string): string {
    const map: Record<string, string> = {
      hp: 'HP',
      attack: 'ATK',
      defense: 'DEF',
      'special-attack': 'SP.ATK',
      'special-defense': 'SP.DEF',
      speed: 'SPD',
    };
    return map[name ?? ''] ?? (name ?? '—').toUpperCase();
  }

  /**
   * Closes the panel and stops all media playback.
   */
  close(): void {
    this.stopVideo();
    this.stopCry();
    this.closePanel.emit();
  }
}
