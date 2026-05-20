import { ChangeDetectionStrategy, Component, OnInit, effect, inject, input, output, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { PokemonService } from '../../services/pokemon.service';
import { PokemonStore } from '../../state/pokemon.store';
import { TrainerStore, Team } from '../../state/trainer.store';

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
          <button type="button" class="back-btn" (click)="handleClose()">←</button>
          <h2>Create New Team</h2>
          <button type="button" class="close-btn" (click)="handleClose()">✕</button>
        </div>
        
        <div class="modal-body">
          <form [formGroup]="teamForm" (ngSubmit)="handleSubmit()">
            <div class="form-group">
              <label>Team Name <span class="required">*</span></label>
              <input type="text" formControlName="teamName" placeholder="e.g. Team Alpha">
              <div class="error-messages" *ngIf="teamForm.get('teamName')?.invalid && teamForm.get('teamName')?.touched">
                <small *ngIf="teamForm.get('teamName')?.errors?.['required']">Team name is required</small>
                <small *ngIf="teamForm.get('teamName')?.errors?.['minlength']">Minimum 3 characters</small>
                <small *ngIf="teamForm.get('teamName')?.errors?.['maxlength']">Maximum 30 characters</small>
              </div>
            </div>
            
            <div class="form-group">
              <label>Select Pokémon ({{ selectedPokemon.length }}/6)</label>
              <div class="slot-grid">
                <div
                  *ngFor="let slot of slots; let i = index"
                  class="slot-card"
                  [class.filled]="selectedPokemon[i]"
                  (click)="openSlotPicker(i)">
                  <ng-container *ngIf="selectedPokemon[i] as pokemon; else emptySlot">
                    <img [src]="pokemon.sprite" [alt]="pokemon.name">
                    <span>{{ pokemon.name | titlecase }}</span>
                    <button type="button" class="remove-slot" (click)="removePokemon(i); $event.stopPropagation()">✕</button>
                  </ng-container>
                  <ng-template #emptySlot>
                    <span class="plus">+</span>
                    <span>Add Pokémon</span>
                  </ng-template>
                </div>
              </div>
              <select
                #picker
                class="pokemon-select hidden-picker"
                [(ngModel)]="selectedPokemonId"
                (ngModelChange)="onPokemonSelect($event)"
                [ngModelOptions]="{ standalone: true }"
                [disabled]="selectedPokemon.length >= 6 || loadingPokemon">
                <option [ngValue]="''">{{ loadingPokemon ? 'Loading...' : 'Choose...' }}</option>
                <option *ngFor="let pokemon of availablePokemon" [ngValue]="pokemon.id">
                  {{ pokemon.name | titlecase }}
                </option>
              </select>

              <div class="picker-fallback">
                <select
                  class="pokemon-select"
                  [(ngModel)]="selectedPokemonId"
                  (ngModelChange)="onPokemonSelect($event)"
                  [ngModelOptions]="{ standalone: true }"
                [disabled]="selectedPokemon.length >= 6 || loadingPokemon">
                  <option [ngValue]="''">{{ loadingPokemon ? 'Loading...' : 'Add Pokémon from list' }}</option>
                  <option *ngFor="let pokemon of availablePokemon" [ngValue]="pokemon.id">
                    {{ pokemon.name | titlecase }}
                  </option>
                </select>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="handleClose()">Cancel</button>
              <button type="submit" class="btn-create" [disabled]="teamForm.invalid || selectedPokemon.length === 0">Create Team</button>
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
      background: rgba(0,0,0,0.5);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s;
      
      &.show {
        opacity: 1;
        visibility: visible;
      }
    }
    
    .modal-container {
      background: white;
      border-radius: 16px;
      width: 90%;
      max-width: 640px;
      max-height: 80vh;
      overflow-y: auto;
      transform: translateY(-50px);
      transition: transform 0.3s;
      
      &.slide-up {
        transform: translateY(0);
      }
    }
    
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;

      h2 { flex: 1; font-size: 1.25rem; margin: 0; }

      .back-btn, .close-btn {
        background: none;
        border: none;
        font-size: 20px;
        cursor: pointer;
        color: #6b7280;
      }
    }
    
    .modal-body {
      padding: 20px;
    }
    
    .form-group {
      margin-bottom: 20px;
      
      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
      }
      
      input,
      select {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        background: white;
      }

      select:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    }
    
    .slot-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .slot-card {
      border: 2px dashed #d1d5db;
      border-radius: 12px;
      min-height: 120px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 6px;
      cursor: pointer;
      padding: 12px;
      position: relative;
      background: #f9fafb;
      font-size: 12px;
      color: #6b7280;

      &.filled {
        border-style: solid;
        border-color: #e5e7eb;
        background: #fff;
      }

      img { width: 56px; height: 56px; image-rendering: pixelated; }

      .plus { font-size: 28px; color: #7c3aed; font-weight: 300; }

      .remove-slot {
        position: absolute;
        top: 6px;
        right: 6px;
        border: none;
        background: #f3f4f6;
        border-radius: 50%;
        width: 22px;
        height: 22px;
        cursor: pointer;
        font-size: 12px;
      }
    }

    .hidden-picker {
      position: absolute;
      opacity: 0;
      pointer-events: none;
      height: 0;
      width: 0;
    }

    .picker-fallback {
      margin-top: 12px;
    }
    
    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #e5e7eb;

      .btn-cancel {
        padding: 10px 20px;
        border: 1px solid #d1d5db;
        border-radius: 10px;
        background: white;
        cursor: pointer;
        font-weight: 500;
      }

      .btn-create {
        padding: 10px 24px;
        border: none;
        border-radius: 10px;
        background: #7c3aed;
        color: white;
        font-weight: 600;
        cursor: pointer;

        &:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
      }
    }
    
    .type-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      background: #ddd;
    }
  `]
})
export class TeamBuilderModalComponent implements OnInit {
  isOpen = input(false);
  initialPokemonIds = input<number[]>([]);
  closeModal = output<void>();
  createTeam = output<{ name: string; pokemon_ids: number[] }>();
  
  private fb = inject(FormBuilder);
  private pokemonService = inject(PokemonService);
  private pokemonStore = inject(PokemonStore);
  private trainerStore = inject(TrainerStore);
  
  teamForm!: FormGroup;
  allPokemonOptions: PokemonOption[] = [];
  selectedPokemonId: number | '' = '';
  loadingPokemon = false;
  selectedPokemon: PokemonOption[] = [];
  existingTeams: Team[] = [];
  readonly slots = [0, 1, 2, 3, 4, 5];
  activeSlotIndex: number | null = null;

  @ViewChild('picker') picker?: ElementRef<HTMLSelectElement>;

  /** Pokémon not yet on the team, for the dropdown. */
  get availablePokemon(): PokemonOption[] {
    const selectedIds = new Set(this.selectedPokemon.map((p) => p.id));
    return this.allPokemonOptions.filter((p) => !selectedIds.has(p.id));
  }
  
  ngOnInit(): void {
    this.initForm();
  }
  
  constructor() {
    effect(() => {
      const open = this.isOpen();
      const initialIds = this.initialPokemonIds();
      if (!open) return;
      this.loadPokemonOptions();
      if (initialIds?.length) {
        this.applyInitialPokemon();
      }
    });
  }

  /** Pre-fills selected Pokémon from Pokédex bulk action. */
  private applyInitialPokemon(): void {
    const ids = this.initialPokemonIds();
    if (!ids?.length || !this.allPokemonOptions.length) {
      return;
    }
    this.selectedPokemon = [];
    for (const id of ids.slice(0, 6)) {
      const pokemon = this.allPokemonOptions.find((p) => p.id === id);
      if (pokemon && !this.selectedPokemon.some((p) => p.id === id)) {
        this.selectedPokemon.push(pokemon);
      }
    }
  }
  
  private initForm(): void {
    this.teamForm = this.fb.group({
      teamName: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(30)]]
    });
  }
  
  /**
   * Loads Pokémon options from the store cache or PokéAPI for the select dropdown.
   */
  loadPokemonOptions(): void {
    const cached = this.pokemonStore.getState().pokemon;
    if (cached?.length) {
      this.allPokemonOptions = this.mapToOptions(cached);
      this.applyInitialPokemon();
      return;
    }

    this.loadingPokemon = true;
    this.pokemonService.getPokemon(100, 0).subscribe({
      next: (data: PokemonData[]) => {
        this.allPokemonOptions = this.mapToOptions(data);
        this.loadingPokemon = false;
        this.applyInitialPokemon();
      },
      error: () => {
        this.loadingPokemon = false;
      }
    });
  }

  /**
   * Adds the Pokémon chosen from the select to the team.
   */
  openSlotPicker(index: number): void {
    if (this.selectedPokemon.length >= 6 && !this.selectedPokemon[index]) {
      return;
    }
    if (index > this.selectedPokemon.length) {
      return;
    }
    this.activeSlotIndex = index;
    this.picker?.nativeElement?.focus();
    this.picker?.nativeElement?.click();
  }

  onPokemonSelect(id: number | ''): void {
    if (id === '' || id == null) {
      return;
    }
    const pokemon = this.allPokemonOptions.find((p) => p.id === Number(id));
    if (!pokemon) {
      return;
    }
    if (this.activeSlotIndex !== null) {
      const copy = [...this.selectedPokemon];
      if (this.activeSlotIndex < copy.length) {
        copy[this.activeSlotIndex] = pokemon;
      } else {
        copy.push(pokemon);
      }
      this.selectedPokemon = copy.filter(
        (p, i, arr) => arr.findIndex((x) => x.id === p.id) === i
      );
    } else {
      this.addPokemon(pokemon);
    }
    this.activeSlotIndex = null;
    this.selectedPokemonId = '';
  }

  private mapToOptions(data: PokemonData[] | { id: number; name: string; types?: { name: string }[] }[]): PokemonOption[] {
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      types: p.types?.map((t: { name: string }) => t.name) ||
        p.pokemon_v2_pokemontypes?.map((t: { pokemon_v2_type: { name: string } }) => t.pokemon_v2_type.name) || [],
      sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png`
    }));
  }
  
  addPokemon(pokemon: PokemonOption): void {
    if (this.selectedPokemon.length >= 6) {
      alert('Maximum 6 Pokémon allowed!');
      return;
    }
    
    if (this.selectedPokemon.some(p => p.id === pokemon.id)) {
      alert('Pokémon already in team!');
      return;
    }
    
    this.selectedPokemon.push(pokemon);
    this.selectedPokemonId = '';
  }
  
  removePokemon(index: number): void {
    this.selectedPokemon.splice(index, 1);
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
      alert('Please fix errors');
      return;
    }
    
    if (this.selectedPokemon.length === 0) {
      alert('Add at least 1 Pokémon');
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
    this.selectedPokemonId = '';
  }
}