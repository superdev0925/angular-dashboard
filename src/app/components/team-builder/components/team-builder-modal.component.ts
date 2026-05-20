import { ChangeDetectionStrategy, Component, OnInit, inject, input, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators, AbstractControl } from '@angular/forms';
import { PokemonService } from '../../services/pokemon.service';
import { TrainerStore, Team } from '../../state/trainer.store';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import { of } from 'rxjs';

interface PokemonOption {
  id: number;
  name: string;
  types: string[];
  sprite: string;
}

interface PokemonData {
  id: number;
  name: string;
  pokemon_v2_pokemontypes?: Array<{ pokemon_v2_type: { name: string } }>;
}

@Component({
  selector: 'app-team-builder-modal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  template: `
    <div class="modal-overlay" [class.show]="isOpen()" (click)="handleOverlayClick()">
      <div class="modal-container" (click)="$event.stopPropagation()" [class.slide-up]="isOpen()">
        <div class="modal-header">
          <h2>Create New Team</h2>
          <button class="close-btn" (click)="handleClose()">✕</button>
        </div>
        
        <div class="modal-body">
          <form [formGroup]="teamForm" (ngSubmit)="handleSubmit()">
            <!-- Team Name -->
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
            
            <!-- Pokémon Search -->
            <div class="form-group">
              <label>Add Pokémon <span class="required">*</span> ({{ selectedPokemon.length }}/6)</label>
              <div class="search-container">
                <input 
                  type="text" 
                  [(ngModel)]="searchTerm"
                  (ngModelChange)="onSearchChange($event)"
                  [ngModelOptions]="{standalone: true}"
                  placeholder="Search Pokémon by name..."
                  class="search-input"
                >
                <div class="autocomplete-dropdown" *ngIf="searchResults.length > 0 && searchTerm">
                  <div 
                    *ngFor="let pokemon of searchResults" 
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
                <div *ngFor="let pokemon of selectedPokemon; let i = index" class="pokemon-chip">
                  <img [src]="pokemon.sprite" [alt]="pokemon.name">
                  <span>{{ pokemon.name | titlecase }}</span>
                  <button type="button" class="remove-chip" (click)="removePokemon(i)">✕</button>
                </div>
              </div>
            </div>
            
            <!-- Pokémon Sub-forms -->
            <div class="pokemon-subforms" formArrayName="pokemonArray">
              <div *ngFor="let pokemonCtrl of pokemonArray.controls; let i = index" [formGroupName]="i" class="pokemon-subform">
                <div class="subform-header">
                  <h4>{{ selectedPokemon[i].name | titlecase }}</h4>
                  <div class="pokemon-types">
                    <span *ngFor="let type of selectedPokemon[i].types" [class]="'type-badge type-' + type">
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
                    </select>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Warning Banner -->
            <div class="warning-banner" *ngIf="hasTypeWeaknessGap()">
              <span class="warning-icon">⚠️</span>
              <div class="warning-content">
                <strong>Type Weakness Detected!</strong>
                <p>Your team has a weakness gap against {{ weaknessTypes().join(', ') }} types.</p>
              </div>
            </div>
            
            <!-- Form Actions -->
            <div class="form-actions">
              <button type="button" class="btn-secondary" (click)="handleClose()">Cancel</button>
              <button type="submit" class="btn-primary" [disabled]="teamForm.invalid || selectedPokemon.length === 0 || selectedPokemon.length > 6">
                Create Team
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(4px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
      
      &.show {
        opacity: 1;
        visibility: visible;
      }
    }
    
    .modal-container {
      background: white;
      border-radius: 20px;
      width: 90%;
      max-width: 700px;
      max-height: 85vh;
      overflow-y: auto;
      transform: translateY(50px);
      transition: transform 0.3s ease;
      box-shadow: 0 20px 40px rgba(0,0,0,0.2);
      
      &.slide-up {
        transform: translateY(0);
      }
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      border-radius: 20px 20px 0 0;
      
      h2 {
        margin: 0;
        color: white;
        font-size: 20px;
      }
      
      .close-btn {
        background: rgba(255,255,255,0.2);
        border: none;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        font-size: 18px;
        cursor: pointer;
        color: white;
        transition: all 0.3s;
        
        &:hover {
          background: rgba(255,255,255,0.3);
          transform: scale(1.1);
        }
      }
    }
    
    .modal-body {
      padding: 24px;
      max-height: calc(85vh - 80px);
      overflow-y: auto;
    }
    
    .form-group {
      margin-bottom: 20px;
      
      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        color: #334155;
        
        .required {
          color: #EF4444;
        }
      }
      
      input, select {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        font-size: 14px;
        
        &:focus {
          outline: none;
          border-color: #6366F1;
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
        }
      }
    }
    
    .search-container {
      position: relative;
      
      .search-input {
        width: 100%;
      }
      
      .autocomplete-dropdown {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: white;
        border: 1px solid #E2E8F0;
        border-radius: 10px;
        max-height: 250px;
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
        }
      }
    }
    
    .selected-pokemon {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
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
        
        .remove-chip {
          background: none;
          border: none;
          cursor: pointer;
          color: #94A3B8;
          
          &:hover {
            color: #EF4444;
          }
        }
      }
    }
    
    .pokemon-subforms {
      margin-top: 20px;
      
      .pokemon-subform {
        background: #F8FAFC;
        border-radius: 12px;
        padding: 16px;
        margin-bottom: 16px;
        
        .subform-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid #E2E8F0;
        }
        
        .subform-content {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
      }
    }
    
    .warning-banner {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 14px;
      background: #FEF3C7;
      border: 1px solid #F59E0B;
      border-radius: 12px;
      margin: 20px 0;
      
      .warning-icon {
        font-size: 24px;
      }
    }
    
    .form-actions {
      display: flex;
      gap: 16px;
      justify-content: flex-end;
      margin-top: 24px;
      padding-top: 20px;
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
export class TeamBuilderModalComponent implements OnInit {
  isOpen = input(false);
  closeModal = output<void>();
  createTeam = output<{ name: string; pokemon_ids: number[] }>();
  
  private fb = inject(FormBuilder);
  private pokemonService = inject(PokemonService);
  private trainerStore = inject(TrainerStore);
  
  teamForm!: FormGroup;
  searchTerm = '';
  searchResults: PokemonOption[] = [];
  selectedPokemon: PokemonOption[] = [];
  existingTeams: Team[] = [];
  
  get pokemonArray(): FormArray {
    return this.teamForm.get('pokemonArray') as FormArray;
  }
  
  ngOnInit(): void {
    this.initForm();
    this.loadExistingTeams();
  }
  
  private initForm(): void {
    this.teamForm = this.fb.group({
      teamName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]],
      pokemonArray: this.fb.array([])
    });
  }
  
  private loadExistingTeams(): void {
    this.trainerStore.fetchTeams(1).subscribe({
      next: (teams: Team[]) => {
        this.existingTeams = teams;
        this.setupAsyncValidator();
      },
      error: (error: Error) => {
        console.error('Error loading teams:', error);
      }
    });
  }
  
  private setupAsyncValidator(): void {
    this.teamForm.get('teamName')?.setAsyncValidators((control: AbstractControl) => {
      return of(control.value).pipe(
        debounceTime(500),
        distinctUntilChanged(),
        switchMap((name: string) => {
          const exists = this.existingTeams.some(team => 
            team.name.toLowerCase() === name?.toLowerCase()
          );
          return of(exists ? { uniqueName: true } : null);
        })
      );
    });
  }
  
  onSearchChange(term: string): void {
    this.searchTerm = term;
    if (term.length < 2) {
      this.searchResults = [];
      return;
    }
    
    this.pokemonService.getPokemon(50, 0).subscribe({
      next: (data: PokemonData[]) => {
        const results: PokemonOption[] = data
          .filter(p => p.name.toLowerCase().includes(term.toLowerCase()))
          .slice(0, 10)
          .map((p: PokemonData) => ({
            id: p.id,
            name: p.name,
            types: p.pokemon_v2_pokemontypes?.map((t: any) => t.pokemon_v2_type.name) || [],
            sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`
          }));
        this.searchResults = results;
      },
      error: (error: Error) => {
        console.error('Error searching Pokémon:', error);
      }
    });
  }
  
  addPokemon(pokemon: PokemonOption): void {
    if (this.selectedPokemon.length >= 6) {
      alert('Maximum 6 Pokémon allowed!');
      return;
    }
    
    if (this.selectedPokemon.some(p => p.id === pokemon.id)) {
      alert('This Pokémon is already in your team!');
      return;
    }
    
    this.selectedPokemon.push(pokemon);
    this.searchTerm = '';
    this.searchResults = [];
    
    const pokemonGroup = this.fb.group({
      nickname: [''],
      heldItem: ['']
    });
    
    this.pokemonArray.push(pokemonGroup);
  }
  
  removePokemon(index: number): void {
    this.selectedPokemon.splice(index, 1);
    this.pokemonArray.removeAt(index);
  }
  
  hasTypeWeaknessGap(): boolean {
    if (this.selectedPokemon.length === 0) return false;
    
    const teamTypes = new Set<string>();
    this.selectedPokemon.forEach(p => {
      p.types.forEach(t => teamTypes.add(t));
    });
    
    const allTypes = ['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy', 'fighting', 'poison', 'ground', 'flying', 'rock', 'bug', 'ghost', 'steel'];
    const missingCounters = allTypes.filter(w => !teamTypes.has(w));
    
    return missingCounters.length > 8;
  }
  
  weaknessTypes(): string[] {
    const teamTypes = new Set<string>();
    this.selectedPokemon.forEach(p => {
      p.types.forEach(t => teamTypes.add(t));
    });
    
    const allTypes = ['fire', 'water', 'grass', 'electric', 'psychic', 'ice', 'dragon', 'dark', 'fairy', 'fighting', 'poison', 'ground', 'flying', 'rock', 'bug', 'ghost', 'steel'];
    return allTypes.filter(w => !teamTypes.has(w)).slice(0, 3);
  }
  
  handleOverlayClick(): void {
    this.handleClose();
  }
  
  handleClose(): void {
    this.closeModal.emit();
    this.resetForm();
  }
  
  handleSubmit(): void {
    if (this.teamForm.invalid) {
      alert('Please fix all errors before saving');
      return;
    }
    
    if (this.selectedPokemon.length === 0 || this.selectedPokemon.length > 6) {
      alert('Team must have between 1 and 6 Pokémon');
      return;
    }
    
    const teamData = {
      name: this.teamForm.get('teamName')?.value,
      pokemon_ids: this.selectedPokemon.map(p => p.id)
    };
    
    this.createTeam.emit(teamData);
    this.handleClose();
  }
  
  private resetForm(): void {
    this.teamForm.reset();
    this.selectedPokemon = [];
    while (this.pokemonArray.length) {
      this.pokemonArray.removeAt(0);
    }
    this.searchTerm = '';
    this.searchResults = [];
  }
}