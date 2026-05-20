import { Component, OnInit, signal, inject, ChangeDetectionStrategy, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { PokemonStore, Pokemon } from '../../state/pokemon.store';
import { TrainerStore, Team } from '../../state/trainer.store';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

interface PokemonOption {
  id: number;
  name: string;
  types: string[];
  sprite: string;
}

@Component({
  selector: 'app-team-builder',
  standalone: true,
  imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="team-builder-container theme-dark-page">
      <div class="team-builder-header">
        <a routerLink="/teams" class="back-link">← Back to Teams</a>
        <h2>Team Builder</h2>
        <p>Build your ultimate Pokémon team with custom nicknames and items</p>
      </div>
      
      <form [formGroup]="teamForm" (ngSubmit)="saveTeam()" class="team-form">
        <!-- Team Name Field -->
        <div class="form-group">
          <label>Team Name <span class="required">*</span></label>
          <input 
            type="text" 
            formControlName="teamName" 
            placeholder="Enter team name (3-30 characters)"
            [class.error]="teamForm.get('teamName')?.invalid && teamForm.get('teamName')?.touched"
          >
          <div class="error-messages" *ngIf="teamForm.get('teamName')?.touched">
            <small *ngIf="teamForm.get('teamName')?.errors?.['required']">Team name is required</small>
            <small *ngIf="teamForm.get('teamName')?.errors?.['minlength']">Team name must be at least 3 characters</small>
            <small *ngIf="teamForm.get('teamName')?.errors?.['maxlength']">Team name cannot exceed 30 characters</small>
            <small *ngIf="teamForm.get('teamName')?.errors?.['uniqueName']">Team name already exists</small>
          </div>
        </div>
        
        <!-- Pokémon Search with Autocomplete -->
        <div class="form-group">
          <label>Add Pokémon <span class="required">*</span> ({{ selectedPokemon().length }}/6)</label>
          <div class="search-container">
            <input 
              type="text" 
              [ngModel]="searchTerm()"
              (ngModelChange)="onSearchChange($event)"
              [ngModelOptions]="{standalone: true}"
              placeholder="Search Pokémon by name..."
              class="search-input"
            >
            <div class="autocomplete-dropdown" *ngIf="searchResults().length > 0 && searchTerm()">
              <div 
                *ngFor="let pokemon of searchResults()" 
                class="autocomplete-item"
                (click)="addPokemon(pokemon)"
              >
                <img [src]="pokemon.sprite" [alt]="pokemon.name" class="autocomplete-sprite">
                <div class="autocomplete-info">
                  <strong>{{ pokemon.name | titlecase }}</strong>
                  <div class="pokemon-types">
                    <span *ngFor="let type of pokemon.types" [class]="'type-badge type-' + type">
                      {{ type }}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Selected Pokémon Chips -->
          <div class="selected-pokemon">
            <div *ngFor="let pokemon of selectedPokemon(); let i = index" class="pokemon-chip">
              <img [src]="pokemon.sprite" [alt]="pokemon.name">
              <span>{{ pokemon.name | titlecase }}</span>
              <button type="button" class="remove-chip" (click)="removePokemon(i)">✕</button>
            </div>
          </div>
          <div class="error-messages" *ngIf="teamForm.get('pokemonArray')?.touched">
            <small *ngIf="selectedPokemon().length === 0">At least 1 Pokémon is required</small>
            <small *ngIf="selectedPokemon().length > 6">Maximum 6 Pokémon allowed</small>
          </div>
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
                <input type="number" formControlName="evHp" min="0" max="252" (change)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Attack</label>
                <input type="number" formControlName="evAtk" min="0" max="252" (change)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Defense</label>
                <input type="number" formControlName="evDef" min="0" max="252" (change)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Sp. Atk</label>
                <input type="number" formControlName="evSpAtk" min="0" max="252" (change)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Sp. Def</label>
                <input type="number" formControlName="evSpDef" min="0" max="252" (change)="validateEvTotal()">
              </div>
              <div class="ev-input">
                <label>Speed</label>
                <input type="number" formControlName="evSpeed" min="0" max="252" (change)="validateEvTotal()">
              </div>
            </div>
            <small class="ev-error" *ngIf="getEvTotal(pokemonCtrl) !== 510 && getEvTotal(pokemonCtrl) !== 0">
              EV total must be exactly 510 for {{ selectedPokemon()[i].name }} (current: {{ getEvTotal(pokemonCtrl) }})
            </small>
          </div>
        </div>
      </div>
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
        
        <!-- Tier Select (Conditional) -->
        <div class="form-group" *ngIf="competitiveMode()">
          <label>Tier</label>
          <select formControlName="tier">
            <option value="ou">OverUsed (OU)</option>
            <option value="uu">UnderUsed (UU)</option>
            <option value="ru">RarelyUsed (RU)</option>
            <option value="nu">NeverUsed (NU)</option>
          </select>
        </div>
        
        <!-- Type Weakness Warning Banner -->
        <div class="warning-banner" *ngIf="hasTypeWeaknessGap()">
          <span class="warning-icon">⚠️</span>
          <div class="warning-content">
            <strong>Type Weakness Detected!</strong>
            <p>Your team has a weakness gap against {{ weaknessTypes().join(', ') }} types. Consider adding counters.</p>
          </div>
        </div>
        
        <!-- Form Actions -->
        <div class="form-actions">
          <button type="button" class="btn-secondary" (click)="resetForm()">Reset</button>
          <button type="submit" class="btn-primary" [disabled]="teamForm.invalid || selectedPokemon().length === 0 || selectedPokemon().length > 6">
            Save Team
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

    .team-builder-container.theme-dark-page {
      max-width: 1200px;
      margin: 0 auto;
      padding: 28px;
      background: rgba(30, 41, 59, 0.55);
      border: 1px solid rgba(148, 163, 184, 0.12);
      border-radius: 16px;
      backdrop-filter: blur(12px);
      color: #e2e8f0;
    }
    
    .team-builder-header {
      margin-bottom: 32px;
      
      .back-link {
        color: #a78bfa;
        text-decoration: none;
        font-size: 14px;
      }
      
      h2 {
        color: #f1f5f9;
        margin: 12px 0 8px;
      }
      
      p {
        color: #94a3b8;
      }
    }
    
    .team-form {
      .form-group {
        margin-bottom: 24px;
        
        label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
          color: #94a3b8;
          
          .required {
            color: #EF4444;
          }
        }
        
        input, select {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          border-radius: 10px;
          font-size: 14px;
          background: rgba(15, 23, 42, 0.8);
          color: #e2e8f0;
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
      
      .search-container {
        position: relative;
        
        .search-input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
        }
        
        .autocomplete-dropdown {
          position: absolute;
          top: 100%;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          max-height: 300px;
          overflow-y: auto;
          z-index: 10;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          
          .autocomplete-item {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px;
            cursor: pointer;
            transition: background 0.2s;
            
            &:hover {
              background: #F8FAFC;
            }
            
            .autocomplete-sprite {
              width: 40px;
              height: 40px;
            }
            
            .autocomplete-info {
              flex: 1;
              
              strong {
                display: block;
                margin-bottom: 4px;
              }
              
              .pokemon-types {
                display: flex;
                gap: 4px;
                
                span {
                  padding: 2px 8px;
                  border-radius: 12px;
                  font-size: 10px;
                  color: white;
                }
              }
            }
          }
        }
      }
      
      .selected-pokemon {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
        margin-top: 12px;
        
        .pokemon-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px;
          background: #F1F5F9;
          border-radius: 30px;
          
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
          background: #F8FAFC;
          border-radius: 12px;
          padding: 16px;
          margin-bottom: 16px;
          
          .subform-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
            padding-bottom: 12px;
            border-bottom: 1px solid #E2E8F0;
            
            h4 {
              margin: 0;
              color: #1E293B;
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
          color: #334155;
        }
      }
      
      .warning-banner {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 16px;
        background: #FEF3C7;
        border: 1px solid #F59E0B;
        border-radius: 12px;
        margin-bottom: 24px;
        
        .warning-icon {
          font-size: 24px;
        }
        
        .warning-content {
          flex: 1;
          
          strong {
            display: block;
            margin-bottom: 4px;
            color: #92400E;
          }
          
          p {
            margin: 0;
            font-size: 13px;
            color: #B45309;
          }
        }
      }
      
      .form-actions {
        display: flex;
        gap: 16px;
        justify-content: flex-end;
        padding-top: 16px;
        border-top: 1px solid #E2E8F0;
        
        button {
          padding: 10px 24px;
          border: none;
          border-radius: 10px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.3s;
          
          &.btn-secondary {
            background: #F1F5F9;
            color: #64748B;
            
            &:hover {
              background: #E2E8F0;
            }
          }
          
          &.btn-primary {
            background: #6366F1;
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
  `]
})
export class TeamBuilderComponent implements OnInit {
  private fb = inject(FormBuilder);
  private pokemonStore = inject(PokemonStore);
  private trainerStore = inject(TrainerStore);
  private router = inject(Router);
  private destroyRef = inject(DestroyRef);

  teamForm!: FormGroup;
  searchTerm = signal('');
  searchResults = signal<PokemonOption[]>([]);
  selectedPokemon = signal<PokemonOption[]>([]);
  competitiveMode = signal(false);
  toastMessage = signal('');
  toastType = signal('');
  existingTeams: Team[] = [];
  private allPokemon: Pokemon[] = [];
  
  get pokemonArray(): FormArray {
    return this.teamForm.get('pokemonArray') as FormArray;
  }
  
  ngOnInit() {
    this.initForm();
    this.loadExistingTeams();
    this.setupAsyncValidator();
    this.loadPokemonCatalog();
  }

  /** Loads Pokémon list from store cache or fetches from PokéAPI for autocomplete. */
  loadPokemonCatalog() {
    this.pokemonStore.pokemon$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((list) => {
        this.allPokemon = list ?? [];
      });
    const cached = this.pokemonStore.getState().pokemon?.length ?? 0;
    if (cached === 0) {
      this.pokemonStore
        .fetchPokemon(20, 0)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          error: () => this.showToast('Could not load Pokémon for search.', 'error'),
        });
    }
  }
  
  initForm() {
    this.teamForm = this.fb.group({
      teamName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      pokemonArray: this.fb.array([]),
      tier: ['ou']
    });
  }
  
  loadExistingTeams() {
    this.trainerStore.fetchTeams(1).pipe(takeUntilDestroyed(this.destroyRef)).subscribe((teams) => {
      this.existingTeams = teams;
      this.teamForm.get('teamName')?.updateValueAndValidity();
    });
  }
  
  setupAsyncValidator() {
    this.teamForm.get('teamName')?.setAsyncValidators((control: AbstractControl) => {
      return of(control.value).pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap(name => {
          const exists = this.existingTeams.some(team => 
            team.name.toLowerCase() === name?.toLowerCase()
          );
          return of(exists ? { uniqueName: true } : null);
        })
      );
    });
  }
  
  onSearchChange(term: string) {
    this.searchTerm.set(term);
    if (term.length < 2) {
      this.searchResults.set([]);
      return;
    }
    const lower = term.toLowerCase();
    const results = this.allPokemon
      .filter((p) => p.name.toLowerCase().includes(lower))
      .slice(0, 20)
      .map((p) => ({
        id: p.id,
        name: p.name,
        types: p.types?.map((t) => t.name) ?? [],
        sprite: p.sprites || this.getPokemonSprite(p.id),
      }));
    this.searchResults.set(results);
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
    this.searchTerm.set('');
    this.searchResults.set([]);
    
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
    this.teamForm.get('pokemonArray')?.updateValueAndValidity();
  }
  
  removePokemon(index: number) {
    this.selectedPokemon.update((list) => list.filter((_, i) => i !== index));
    this.pokemonArray.removeAt(index);
  }
  
  toggleCompetitiveMode(enabled: boolean) {
    this.competitiveMode.set(enabled);
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
    
    this.trainerStore
      .createTeam(1, teamData.name, teamData.pokemon_ids)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.showToast('Team saved successfully!', 'success');
          this.resetForm(false);
          this.router.navigate(['/teams']);
        },
        error: () =>
          this.showToast('Failed to save team. Run: npm run mock:graphql', 'error'),
      });
  }

  resetForm(showMessage = true) {
    this.teamForm.reset({ tier: 'ou' });
    this.selectedPokemon.set([]);
    while (this.pokemonArray.length) {
      this.pokemonArray.removeAt(0);
    }
    this.searchTerm.set('');
    this.searchResults.set([]);
    this.competitiveMode.set(false);
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