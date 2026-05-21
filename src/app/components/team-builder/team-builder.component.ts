import {
  Component,
  OnInit,
  signal,
  input,
  output,
  inject,
  ChangeDetectionStrategy,
  DestroyRef,
  effect,
  computed,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import {
  FormsModule,
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  Validators,
  AbstractControl,
} from '@angular/forms';
import { take } from 'rxjs/operators';
import { PokemonStore, Pokemon } from '../../state/pokemon.store';
import { TrainerStore, Team } from '../../state/trainer.store';
import { uniqueTeamNameValidator, evSpreadValidator } from '../../utils/validators';
import { StatsAnalysisService } from '../../services/stats-analysis.service';
import { TeamCoverageResult } from '../../workers/stats-analysis.worker';

interface PokemonOption {
  id: number;
  name: string;
  types: string[];
  sprite: string;
}

@Component({
  selector: 'app-team-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink, DragDropModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="team-builder-container">
      <div class="team-builder-header">
        <a routerLink="/teams" class="back-link" (click)="onBackClick($event)">← Back to Teams</a>
        <h2>{{ isEditMode() ? 'Edit Team' : 'Advanced Team Builder' }}</h2>
        <p>{{ isEditMode() ? 'Update your squad, nicknames, held items, and competitive EV spreads.' : 'Build your ultimate Pokémon team with custom nicknames and items.' }}</p>
      </div>
      
      <form [formGroup]="teamForm" (ngSubmit)="saveTeam()" class="team-form">
        <!-- Team Name -->
        <div class="form-group">
          <label for="team-name-input">Team Name <span class="required">*</span></label>
          <input
            id="team-name-input"
            type="text"
            formControlName="teamName"
            placeholder="Enter team name (3–30 characters)"
            [class.error]="showControlError('teamName')"
          >
          <div class="error-messages" *ngIf="showControlError('teamName') || teamForm.get('teamName')?.pending">
            <small *ngIf="teamForm.get('teamName')?.pending">Checking name availability…</small>
            <small *ngIf="teamForm.get('teamName')?.errors?.['required']">Team name is required</small>
            <small *ngIf="teamForm.get('teamName')?.errors?.['minlength']">Team name must be at least 3 characters</small>
            <small *ngIf="teamForm.get('teamName')?.errors?.['maxlength']">Team name cannot exceed 30 characters</small>
            <small *ngIf="teamForm.get('teamName')?.errors?.['uniqueName']">Team name already exists</small>
          </div>
        </div>

        <!-- Pokémon roster -->
        <div class="form-group">
          <label for="pokemon-roster-select">Pokémon roster <span class="required">*</span> ({{ selectedPokemon().length }}/6)</label>
          <select
            id="pokemon-roster-select"
            class="pokemon-select"
            [ngModel]="pickerPokemonId()"
            (ngModelChange)="onPokemonSelect($event)"
            [ngModelOptions]="{ standalone: true }"
            [disabled]="selectedPokemon().length >= 6 || catalogLoading()"
          >
            <option [ngValue]="''">
              {{ catalogLoading() ? 'Loading Pokémon...' : 'Choose a Pokémon to add...' }}
            </option>
            <option *ngFor="let pokemon of availablePokemonOptions()" [ngValue]="pokemon.id">
              #{{ pokemon.id }} — {{ pokemon.name | titlecase }}{{ pokemon.types.length ? ' (' + pokemon.types.join(', ') + ')' : '' }}
            </option>
          </select>
          <p class="picker-hint" *ngIf="selectedPokemon().length >= 6">Team is full (6/6). Remove a Pokémon to add another.</p>

          <p class="drag-hint" *ngIf="selectedPokemon().length">Drag chips to reorder your squad.</p>
          <div
            class="selected-pokemon"
            cdkDropList
            (cdkDropListDropped)="dropReorderTeam($event)"
            [class.empty-roster]="!selectedPokemon().length">
            <div *ngFor="let pokemon of selectedPokemon(); let i = index" class="pokemon-chip" cdkDrag>
              <img [src]="pokemon.sprite" [alt]="pokemon.name">
              <span>{{ pokemon.name | titlecase }}</span>
              <button type="button" class="remove-chip" (click)="removePokemon(i)" aria-label="Remove Pokémon">✕</button>
            </div>
            <p class="roster-empty" *ngIf="!selectedPokemon().length">Add at least one Pokémon from the list above.</p>
          </div>
          <div class="error-messages" *ngIf="showSquadErrors()">
            <small *ngIf="selectedPokemon().length === 0">At least 1 Pokémon is required</small>
            <small *ngIf="selectedPokemon().length > 6">Maximum 6 Pokémon allowed</small>
          </div>
        </div>

        <!-- Competitive Mode Toggle -->
        <div class="form-group competitive-toggle">
          <label class="toggle-switch">
            <input type="checkbox" [ngModel]="competitiveMode()" (ngModelChange)="toggleCompetitiveMode($event)" [ngModelOptions]="{standalone: true}">
            <span class="toggle-slider"></span>
          </label>
          <span class="toggle-label">Competitive Mode</span>
        </div>

        <div class="form-group" *ngIf="competitiveMode()">
          <label for="tier-select">Tier</label>
          <select id="tier-select" formControlName="tier">
            <option value="ou">OverUsed (OU)</option>
            <option value="uu">UnderUsed (UU)</option>
            <option value="ru">RarelyUsed (RU)</option>
            <option value="nu">NeverUsed (NU)</option>
          </select>
        </div>

        <!-- Pokémon Sub-forms (Dynamic FormArray) -->
<div class="pokemon-subforms" formArrayName="pokemonArray">
  <div *ngFor="let pokemonCtrl of pokemonArray.controls; let i = index" [formGroupName]="i" class="pokemon-subform">
    <div class="subform-header">
      <h4>{{ selectedPokemon()[i].name | titlecase }}</h4>
      <div class="pokemon-types">
        <span *ngFor="let type of selectedPokemon()[i].types" [class]="'type-badge type-' + type">
          {{ type }}
        </span>
      </div>
    </div>
    <div class="subform-content">
      <div class="form-group">
        <label>Nickname (optional)</label>
        <input type="text" formControlName="nickname" placeholder="Enter a nickname">
      </div>
      <div class="form-group">
        <label>Held Item</label>
        <select formControlName="heldItem">
          <option value="">None</option>
          <option value="leftovers">Leftovers</option>
          <option value="choice-band">Choice Band</option>
          <option value="choice-specs">Choice Specs</option>
          <option value="choice-scarf">Choice Scarf</option>
          <option value="life-orb">Life Orb</option>
          <option value="focus-sash">Focus Sash</option>
          <option value="berry">Sitrus Berry</option>
          <option value="expert-belt">Expert Belt</option>
        </select>
      </div>
      
        <!-- Competitive Mode Fields -->
        <div class="competitive-fields" *ngIf="competitiveMode()">
          <div class="form-group">
            <label>EV Spread for {{ selectedPokemon()[i].name | titlecase }} (Total must be 510)</label>
            <div class="ev-grid">
              <div class="ev-input">
                <label>HP</label>
                <input type="number" formControlName="evHp" min="0" max="252" (change)="validateEvTotal()" (blur)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Attack</label>
                <input type="number" formControlName="evAtk" min="0" max="252" (change)="validateEvTotal()" (blur)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Defense</label>
                <input type="number" formControlName="evDef" min="0" max="252" (change)="validateEvTotal()" (blur)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Sp. Atk</label>
                <input type="number" formControlName="evSpAtk" min="0" max="252" (change)="validateEvTotal()" (blur)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Sp. Def</label>
                <input type="number" formControlName="evSpDef" min="0" max="252" (change)="validateEvTotal()" (blur)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Speed</label>
                <input type="number" formControlName="evSpeed" min="0" max="252" (change)="validateEvTotal()" (blur)="validateEvTotal()">
              </div>
            </div>
            <small
              class="ev-error"
              *ngIf="competitiveMode() && showEvError(pokemonCtrl)">
              EV total must be exactly 510 for {{ selectedPokemon()[i].name }} (current: {{ getEvTotal(pokemonCtrl) }})
            </small>
          </div>
        </div>
      </div>
    </div>
  </div>

        <!-- Web Worker coverage (Bonus 4) -->
        <div class="coverage-banner" *ngIf="coverageResult() as cov">
          <strong>Worker analysis ({{ cov.elapsedMs | number:'1.0-1' }}ms):</strong>
          <p>Super effective vs: {{ cov.superEffectiveAgainst.join(', ') || '—' }}</p>
          <p>Weak coverage: {{ cov.uncoveredTypes.join(', ') || '—' }}</p>
          <p *ngIf="cov.suggestions?.length">
            Synergy picks:
            <span *ngFor="let s of cov.suggestions; let last = last">{{ s.name | titlecase }}<span *ngIf="!last">, </span></span>
          </p>
        </div>

        <!-- Advisory: type coverage (does not block save) -->
        <div class="warning-banner advisory" *ngIf="hasTypeWeaknessGap()">
          <span class="warning-icon">⚠️</span>
          <div class="warning-content">
            <strong>Advisory: type weakness gap</strong>
            <p>Your squad may struggle against {{ weaknessTypes().join(', ') }} types. Consider adding counters — you can still save this team.</p>
          </div>
        </div>
        
        <!-- Form Actions -->
        <div class="form-actions">
          <button type="button" class="btn-secondary" (click)="resetForm()">Reset</button>
          <button
            type="submit"
            class="btn-primary"
            [disabled]="teamForm.invalid || selectedPokemon().length === 0 || selectedPokemon().length > 6 || teamForm.get('teamName')?.pending">
            {{ isEditMode() ? 'Update Team' : 'Save Team' }}
          </button>
        </div>
      </form>
      
      <!-- Toast Notification -->
      <div class="toast" [class.show]="toastMessage()" [ngClass]="toastType()">
        {{ toastMessage() }}
      </div>

      <!-- <small class="ev-error" *ngIf="getEvTotal(pokemonCtrl) !== 510 && getEvTotal(pokemonCtrl) !== 0">
        EV total must be exactly 510 for {{ selectedPokemon[i].name }} (current: {{ getEvTotal(pokemonCtrl) }})
      </small> -->
    </div>
  `,
  styles: [`
    :host {
      display: block;
      width: 100%;
    }

    .team-builder-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 28px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      border-radius: 16px;
      backdrop-filter: blur(12px);
      color: var(--text-body);
      box-shadow: var(--shadow);
    }
    
    .team-builder-header {
      margin-bottom: 32px;
      
      .back-link {
        color: var(--accent);
        text-decoration: none;
        font-size: 14px;
      }
      
      h2 {
        color: var(--text-heading);
        margin: 12px 0 8px;
      }
      
      p {
        color: var(--text-muted);
      }
    }
    
    .team-form {
      .form-group {
        margin-bottom: 24px;
        
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: var(--text-muted);
          
          .required {
            color: #EF4444;
          }
        }
        
        input, select {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid var(--surface-border);
          border-radius: 10px;
          font-size: 14px;
          background: var(--surface-deep);
          color: var(--text-body);
          transition: all 0.3s;
          
          &:focus {
            outline: none;
            border-color: #7c3aed;
            box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
          }
          
          &.error {
            border-color: #EF4444;
          }
        }
        
        .error-messages {
          margin-top: 6px;
          
          small {
            color: #EF4444;
            font-size: 12px;
            display: block;
          }
        }
      }
      
      .pokemon-select {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid var(--surface-border);
        border-radius: 10px;
        background: var(--surface-deep);
        color: var(--text-body);
        font-size: 14px;
        cursor: pointer;

        &:focus {
          outline: none;
          border-color: #7c3aed;
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.2);
        }

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        option {
          background: var(--surface-elevated);
          color: var(--text-body);
        }
      }

      .picker-hint {
        font-size: 12px;
        color: var(--text-muted);
        margin-top: 6px;
      }
      
      .selected-pokemon {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
        min-height: 44px;

        &.empty-roster {
          align-items: center;
        }

        .roster-empty {
          margin: 0;
          font-size: 13px;
          color: var(--text-muted);
        }
        
        .pokemon-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: var(--surface-deep);
          border: 1px solid var(--glass-border);
          border-radius: 30px;
          color: var(--text-body);
          
          img {
            width: 24px;
            height: 24px;
          }
          
          span {
            font-size: 13px;
            font-weight: 500;
          }
          
          .remove-chip {
            background: none;
            border: none;
            cursor: pointer;
            color: #94A3B8;
            font-size: 14px;
            padding: 0 4px;
            
            &:hover {
              color: #EF4444;
            }
          }
        }
      }
      
      .pokemon-subforms {
        .pokemon-subform {
          background: var(--surface-card);
          border: 1px solid var(--glass-border);
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          
          .subform-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid var(--glass-border);
            
            h4 {
              margin: 0;
              color: var(--text-heading);
            }
            
            .pokemon-types {
              display: flex;
              gap: 6px;
              
              span {
                padding: 4px 10px;
                border-radius: 20px;
                font-size: 11px;
                color: white;
              }
            }
          }
          
          .subform-content {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 16px;
            
            .form-group {
              margin-bottom: 0;
            }
          }
          
          .competitive-fields {
            grid-column: span 2;
            
            .ev-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 12px;
              margin-top: 8px;
              
              .ev-input {
                label {
                  font-size: 11px;
                  margin-bottom: 4px;
                }
                
                input {
                  padding: 6px 10px;
                  font-size: 13px;
                }
              }
            }
            
            .ev-error {
              color: #EF4444;
              font-size: 11px;
              margin-top: 8px;
              display: block;
            }
          }
        }
      }
      
      .competitive-toggle {
        display: flex;
        align-items: center;
        gap: 12px;
        
        .toggle-switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 24px;
          
          input {
            opacity: 0;
            width: 0;
            height: 0;
          }
          
          .toggle-slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: #CBD5E1;
            transition: 0.3s;
            border-radius: 24px;
            
            &:before {
              position: absolute;
              content: "";
              height: 18px;
              width: 18px;
              left: 3px;
              bottom: 3px;
              background-color: white;
              transition: 0.3s;
              border-radius: 50%;
            }
          }
          
          input:checked + .toggle-slider {
            background-color: #6366F1;
          }
          
          input:checked + .toggle-slider:before {
            transform: translateX(26px);
          }
        }
        
        .toggle-label {
          font-weight: 500;
          color: var(--text-body);
        }
      }
      
      .warning-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: var(--warning-bg);
        border: 1px solid var(--warning-border);
        border-radius: 12px;
        margin-bottom: 24px;

        &.advisory {
          border-style: dashed;
        }
        
        .warning-icon {
          font-size: 24px;
        }
        
        .warning-content {
          flex: 1;
          
          strong {
            display: block;
            margin-bottom: 4px;
            color: var(--warning-title);
          }
          
          p {
            margin: 0;
            font-size: 13px;
            color: var(--warning-text);
          }
        }
      }
      
      .form-actions {
        display: flex;
        gap: 16px;
        justify-content: flex-end;
        padding-top: 16px;
        border-top: 1px solid var(--glass-border);
        
        button {
          padding: 10px 24px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
          
          &.btn-secondary {
            background: var(--btn-secondary-bg);
            border: 1px solid var(--btn-secondary-border);
            color: var(--btn-secondary-text);
            
            &:hover {
              background: var(--surface-border);
              color: var(--text-heading);
            }
          }
          
          &.btn-primary {
            background: linear-gradient(135deg, #7c3aed, #6d28d9);
            color: white;
            
            &:hover:not(:disabled) {
              background: #4F46E5;
              transform: translateY(-1px);
            }
            
            &:disabled {
              opacity: 0.5;
              cursor: not-allowed;
            }
          }
        }
      }
    }
    
    .toast {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      border-radius: 10px;
      background: #333;
      color: white;
      transform: translateX(400px);
      transition: transform 0.3s;
      z-index: 1000;
      
      &.show {
        transform: translateX(0);
      }
      
      &.success {
        background: #10B981;
      }
      
      &.error {
        background: #EF4444;
      }
      
      &.warning {
        background: #F59E0B;
      }
    }
    
    .type-badge {
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 11px;
      color: white;
    }
    
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

    .drag-hint {
      font-size: 12px;
      color: var(--text-muted);
      margin: 8px 0 4px;
    }

    .selected-pokemon .pokemon-chip {
      cursor: grab;
    }

    .coverage-banner {
      margin: 16px 0;
      padding: 12px 16px;
      border-radius: 10px;
      background: rgba(59, 130, 246, 0.12);
      border: 1px solid rgba(96, 165, 250, 0.35);
      font-size: 13px;
      color: var(--text-body);
    }
  `]
})
export class TeamBuilderComponent implements OnInit {
  private fb = inject(FormBuilder);
  private pokemonStore = inject(PokemonStore);
  private trainerStore = inject(TrainerStore);
  private statsAnalysis = inject(StatsAnalysisService);
  private destroyRef = inject(DestroyRef);

  /** When set, loads and updates this team instead of creating a new one. */
  teamId = input<number | null>(null);
  trainerId = input<number>(1);

  /** Emitted when a team is persisted successfully. */
  teamSaved = output<Team>();
  cancelEdit = output<void>();

  isEditMode = computed(() => this.teamId() != null);

  teamForm!: FormGroup;
  pickerPokemonId = signal<number | ''>('');
  catalogLoading = signal(false);
  squadTouched = signal(false);
  selectedPokemon = signal<PokemonOption[]>([]);
  competitiveMode = signal(false);
  toastMessage = signal('');
  toastType = signal('');
  existingTeams: Team[] = [];
  coverageResult = signal<TeamCoverageResult | null>(null);
  /** Catalog for the roster dropdown; must be a signal so OnPush + computed stay in sync. */
  private allPokemon = signal<Pokemon[]>([]);
  private loadedEditTeamId: number | null = null;

  /** Pokémon not yet on the team, for the add dropdown. */
  availablePokemonOptions = computed((): PokemonOption[] => {
    const selectedIds = new Set(this.selectedPokemon().map((p) => p.id));
    return this.allPokemon()
      .filter((p) => !selectedIds.has(p.id))
      .map((p) => this.toPokemonOption(p))
      .sort((a, b) => a.id - b.id);
  });

  constructor() {
    effect(() => {
      const types = this.selectedPokemon().flatMap((p) => p.types);
      if (!types.length) {
        this.coverageResult.set(null);
        return;
      }
      const catalog = this.allPokemon().map((p) => ({
        id: p.id,
        name: p.name,
        types: p.types?.map((t) => t.name) ?? [],
      }));
      this.statsAnalysis
        .analyzeTeamCoverage(types, catalog)
        .pipe(take(1), takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (result) => this.coverageResult.set(result),
          error: () => this.coverageResult.set(null),
        });
    }, { allowSignalWrites: true });

    effect(() => {
      if (this.teamId() == null && this.loadedEditTeamId != null) {
        this.loadedEditTeamId = null;
        this.resetForm(false);
      }
    }, { allowSignalWrites: true });
  }

  onBackClick(event: Event): void {
    event.preventDefault();
    this.cancelEdit.emit();
  }

  get pokemonArray(): FormArray {
    return this.teamForm.get('pokemonArray') as FormArray;
  }
  
  ngOnInit() {
    this.initForm();
    this.loadExistingTeams();
    this.setupAsyncValidator();
    this.loadPokemonCatalog();
  }

  onPokemonSelect(id: number | string | ''): void {
    if (id === '' || id == null) {
      return;
    }
    const pokemon = this.availablePokemonOptions().find((p) => p.id === Number(id));
    if (!pokemon) {
      return;
    }
    this.addPokemon(pokemon);
    this.pickerPokemonId.set('');
  }

  showControlError(controlName: string): boolean {
    const ctrl = this.teamForm.get(controlName);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty));
  }

  showSquadErrors(): boolean {
    const count = this.selectedPokemon().length;
    return this.squadTouched() && (count === 0 || count > 6);
  }

  showSubcontrolError(group: AbstractControl, name: string): boolean {
    const ctrl = group.get(name);
    return !!(ctrl && ctrl.invalid && (ctrl.touched || ctrl.dirty));
  }

  showEvError(pokemonCtrl: AbstractControl): boolean {
    const touched = Object.keys((pokemonCtrl as FormGroup).controls).some((key) => {
      const c = pokemonCtrl.get(key);
      return c && (c.touched || c.dirty);
    });
    const total = this.getEvTotal(pokemonCtrl);
    return touched && total !== 0 && total !== 510;
  }

  /** Loads Pokémon list from store cache or fetches from PokéAPI for the add dropdown. */
  loadPokemonCatalog() {
    this.pokemonStore.pokemon$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        this.allPokemon.set(list ?? []);
        if (list?.length) {
          this.catalogLoading.set(false);
          this.tryLoadTeamForEdit();
        }
      });
    const cached = this.pokemonStore.getState().pokemon?.length ?? 0;
    if (cached > 0) {
      this.allPokemon.set(this.pokemonStore.getState().pokemon);
      this.catalogLoading.set(false);
      this.tryLoadTeamForEdit();
      return;
    }
    this.catalogLoading.set(true);
    this.pokemonStore
      .fetchAllPokemon()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.allPokemon.set(this.pokemonStore.getState().pokemon);
          this.catalogLoading.set(false);
          this.tryLoadTeamForEdit();
        },
        error: () => {
          this.catalogLoading.set(false);
          if (!this.allPokemon().length) {
            this.showToast('Could not load Pokémon list.', 'error');
          }
        },
      });
  }

  /** Maps store Pokémon to dropdown/chip option shape. */
  toPokemonOption(p: Pokemon): PokemonOption {
    return {
      id: p.id,
      name: p.name,
      types: p.types?.map((t) => t.name) ?? [],
      sprite: p.sprites || this.getPokemonSprite(p.id),
    };
  }

  initForm() {
    this.teamForm = this.fb.group({
      teamName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      pokemonArray: this.fb.array([]),
      tier: ['ou']
    });
  }
  
  loadExistingTeams() {
    this.trainerStore
      .fetchTeams(this.trainerId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((teams) => {
        this.existingTeams = teams;
        this.teamForm.get('teamName')?.updateValueAndValidity();
        this.tryLoadTeamForEdit();
      });
  }

  /** Loads team data into the form when editing (after catalog + teams are ready). */
  private tryLoadTeamForEdit(): void {
    const id = this.teamId();
    if (!id || !this.allPokemon().length) {
      return;
    }
    const team = this.existingTeams.find((t) => t.id === id);
    if (!team || this.loadedEditTeamId === id) {
      return;
    }
    this.populateFromTeam(team);
    this.loadedEditTeamId = id;
  }

  private populateFromTeam(team: Team): void {
    this.resetForm(false);
    this.teamForm.patchValue({ teamName: team.name });
    for (const id of team.pokemon_ids.slice(0, 6)) {
      const fromCatalog = this.allPokemon().find((p) => p.id === id);
      const option: PokemonOption = fromCatalog
        ? this.toPokemonOption(fromCatalog)
        : {
            id,
            name: `pokemon-${id}`,
            types: [],
            sprite: this.getPokemonSprite(id),
          };
      this.addPokemon(option);
    }
  }

  setupAsyncValidator() {
    this.teamForm.get('teamName')?.setAsyncValidators(
      uniqueTeamNameValidator(
        () => this.existingTeams.map((team) => team.name),
        () => {
          const id = this.teamId();
          if (!id) {
            return null;
          }
          return this.existingTeams.find((t) => t.id === id)?.name ?? null;
        }
      )
    );
  }

  /**
   * Reorders selected Pokémon and matching FormArray rows after drag-drop.
   *
   * @param event - CDK drop event
   */
  dropReorderTeam(event: CdkDragDrop<PokemonOption[]>): void {
    const list = [...this.selectedPokemon()];
    moveItemInArray(list, event.previousIndex, event.currentIndex);
    const ctrl = this.pokemonArray.at(event.previousIndex);
    this.pokemonArray.removeAt(event.previousIndex);
    this.pokemonArray.insert(event.currentIndex, ctrl);
    this.selectedPokemon.set(list);
  }
  
  getPokemonSprite(id: number): string {
    return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  }
  
  addPokemon(pokemon: PokemonOption) {
    if (this.selectedPokemon().length >= 6) {
      this.showToast('Maximum 6 Pokémon allowed!', 'warning');
      return;
    }

    if (this.selectedPokemon().some((p) => p.id === pokemon.id)) {
      this.showToast('This Pokémon is already in your team!', 'warning');
      return;
    }

    this.selectedPokemon.update((list) => [...list, pokemon]);

    // Add to FormArray
    const pokemonGroup = this.fb.group({
      nickname: [''],
      heldItem: [''],
      evHp: [0, [Validators.min(0), Validators.max(252)]],
      evAtk: [0, [Validators.min(0), Validators.max(252)]],
      evDef: [0, [Validators.min(0), Validators.max(252)]],
      evSpAtk: [0, [Validators.min(0), Validators.max(252)]],
      evSpDef: [0, [Validators.min(0), Validators.max(252)]],
      evSpeed: [0, [Validators.min(0), Validators.max(252)]]
    });
    
    this.pokemonArray.push(pokemonGroup);
    this.applyEvValidators();
    this.teamForm.get('pokemonArray')?.updateValueAndValidity();
  }
  
  removePokemon(index: number) {
    this.selectedPokemon.update((list) => list.filter((_, i) => i !== index));
    this.pokemonArray.removeAt(index);
  }
  
  toggleCompetitiveMode(enabled: boolean) {
    this.competitiveMode.set(enabled);
    this.applyEvValidators();
  }

  /**
   * Applies or removes shared EV spread validator on each Pokémon row.
   */
  applyEvValidators(): void {
    this.pokemonArray.controls.forEach((ctrl) => {
      const speed = ctrl.get('evSpeed');
      if (!speed) return;
      if (this.competitiveMode()) {
        speed.addValidators(evSpreadValidator);
      } else {
        speed.removeValidators(evSpreadValidator);
      }
      speed.updateValueAndValidity();
    });
  }
  
  getEvTotal(pokemonCtrl: AbstractControl): number {
    const group = pokemonCtrl as FormGroup;
    return (
      (group.get('evHp')?.value || 0) +
      (group.get('evAtk')?.value || 0) +
      (group.get('evDef')?.value || 0) +
      (group.get('evSpAtk')?.value || 0) +
      (group.get('evSpDef')?.value || 0) +
      (group.get('evSpeed')?.value || 0)
    );
  }
  
  /**
 * Validates EV total for each Pokémon in competitive mode.
 * EV total must be either 0 or exactly 510.
 */
  validateEvTotal() {
    for (let i = 0; i < this.pokemonArray.length; i++) {
      const total = this.getEvTotal(this.pokemonArray.at(i));
      if (total !== 0 && total !== 510) {
        this.pokemonArray.at(i).setErrors({ evInvalid: true });
      } else {
        const errors = this.pokemonArray.at(i).errors;
        if (errors) {
          // Use bracket notation to delete index signature property
          delete errors['evInvalid'];
          this.pokemonArray.at(i).setErrors(Object.keys(errors).length ? errors : null);
        }
      }
    }
  }
  
  hasTypeWeaknessGap(): boolean {
    if (this.selectedPokemon().length === 0) return false;

    const teamTypes = new Set<string>();
    this.selectedPokemon().forEach((p) => {
      p.types.forEach((t) => teamTypes.add(t));
    });
    
    const weaknesses = ['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy', 'fighting', 'poison', 'ground', 'flying', 'rock', 'bug', 'ghost', 'steel'];
    const missingCounters = weaknesses.filter(w => !teamTypes.has(w));
    
    return missingCounters.length > 8;
  }
  
  weaknessTypes(): string[] {
    const teamTypes = new Set<string>();
    this.selectedPokemon().forEach((p) => {
      p.types.forEach((t) => teamTypes.add(t));
    });
    
    const weaknesses = ['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy', 'fighting', 'poison', 'ground', 'flying', 'rock', 'bug', 'ghost', 'steel'];
    return weaknesses.filter(w => !teamTypes.has(w)).slice(0, 3);
  }
  
  saveTeam() {
    this.teamForm.markAllAsTouched();
    this.squadTouched.set(true);
    this.pokemonArray.controls.forEach((ctrl) => ctrl.markAllAsTouched());
    this.validateEvTotal();

    if (this.teamForm.invalid) {
      this.showToast('Please fix all errors before saving', 'error');
      return;
    }

    if (this.selectedPokemon().length === 0 || this.selectedPokemon().length > 6) {
      this.showToast('Team must have between 1 and 6 Pokémon', 'error');
      return;
    }

    // Validate EV totals if competitive mode is on
    if (this.competitiveMode()) {
      for (let i = 0; i < this.pokemonArray.length; i++) {
        const total = this.getEvTotal(this.pokemonArray.at(i));
        if (total !== 0 && total !== 510) {
          this.showToast(`EV total must be 0 or 510 for ${this.selectedPokemon()[i].name}`, 'error');
          return;
        }
      }
    }

    const teamData = {
      name: this.teamForm.get('teamName')?.value,
      pokemon_ids: this.selectedPokemon().map((p) => p.id),
      nicknames: this.pokemonArray.controls.map(c => c.get('nickname')?.value),
      heldItems: this.pokemonArray.controls.map(c => c.get('heldItem')?.value),
      tier: this.competitiveMode() ? this.teamForm.get('tier')?.value : null,
      evSpreads: this.competitiveMode() ? this.pokemonArray.controls.map(c => ({
        hp: c.get('evHp')?.value,
        attack: c.get('evAtk')?.value,
        defense: c.get('evDef')?.value,
        specialAttack: c.get('evSpAtk')?.value,
        specialDefense: c.get('evSpDef')?.value,
        speed: c.get('evSpeed')?.value
      })) : null
    };
    
    const editId = this.teamId();
    const request$ = editId
      ? this.trainerStore.updateTeam(editId, teamData.name, teamData.pokemon_ids)
      : this.trainerStore.createTeam(this.trainerId(), teamData.name, teamData.pokemon_ids);

    request$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (team) => {
        this.teamSaved.emit(team);
        this.showToast(
          editId ? 'Team updated successfully!' : 'Team saved successfully!',
          'success'
        );
        this.loadedEditTeamId = null;
        this.resetForm(false);
      },
      error: () =>
        this.showToast(
          editId
            ? 'Failed to update team. Run: npm run mock:graphql'
            : 'Failed to save team. Run: npm run mock:graphql',
          'error'
        ),
    });
  }

  resetForm(showMessage = true) {
    this.teamForm.reset({ tier: 'ou' });
    this.selectedPokemon.set([]);
    while (this.pokemonArray.length) {
      this.pokemonArray.removeAt(0);
    }
    this.pickerPokemonId.set('');
    this.squadTouched.set(false);
    this.competitiveMode.set(false);
    if (!this.teamId()) {
      this.loadedEditTeamId = null;
    }
    if (showMessage) {
      this.showToast('Form reset', 'info');
    }
  }

  showToast(message: string, type: string) {
    this.toastMessage.set(message);
    this.toastType.set(type);
    setTimeout(() => this.toastMessage.set(''), 3000);
  }
}