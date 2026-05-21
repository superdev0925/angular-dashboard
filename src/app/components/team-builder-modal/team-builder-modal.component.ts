import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  OnInit,
  computed,
  effect,
  inject,
  input,
  output,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
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
          <span class="header-spacer" aria-hidden="true"></span>
          <h2>{{ isEditMode() ? 'Edit Team' : 'Create New Team' }}</h2>
          <button type="button" class="close-btn" (click)="handleClose()" aria-label="Close">✕</button>
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
              <label>Select Pokémon ({{ selectedCount }}/6)</label>
              <div class="slot-grid">
                <div
                  *ngFor="let slot of slots; let i = index"
                  class="slot-card"
                  [class.filled]="getSlotPokemon(i)"
                  [class.picker-active]="activeSlotIndex === i"
                  role="button"
                  tabindex="0"
                  [attr.aria-label]="getSlotPokemon(i) ? 'Change ' + getSlotPokemon(i)!.name : 'Add Pokémon to slot ' + (i + 1)"
                  (click)="openSlotPicker(i)"
                  (keydown.enter)="openSlotPicker(i)"
                  (keydown.space)="openSlotPicker(i); $event.preventDefault()">
                  <ng-container *ngIf="getSlotPokemon(i) as pokemon; else emptySlot">
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
              <div class="picker-fallback">
                <label class="picker-label" for="team-modal-pokemon-picker">
                  {{ activeSlotIndex !== null ? 'Choose Pokémon for slot ' + (activeSlotIndex + 1) : 'Add Pokémon from list' }}
                </label>
                <select
                  #visiblePicker
                  id="team-modal-pokemon-picker"
                  class="pokemon-select"
                  [(ngModel)]="selectedPokemonId"
                  (ngModelChange)="onPokemonSelect($event)"
                  [ngModelOptions]="{ standalone: true }"
                  [disabled]="(selectedCount >= 6 && activeSlotIndex === null) || loadingPokemon">
                  <option [ngValue]="''">{{ loadingPokemon ? 'Loading Pokémon...' : 'Choose a Pokémon...' }}</option>
                  <option *ngFor="let pokemon of availablePokemon" [ngValue]="pokemon.id">
                    {{ pokemon.name | titlecase }}
                  </option>
                </select>
              </div>
            </div>
            
            <div class="form-actions">
              <button type="button" class="btn-cancel" (click)="handleClose()">Cancel</button>
              <button type="submit" class="btn-create" [disabled]="teamForm.invalid || selectedCount === 0">
                {{ isEditMode() ? 'Save Changes' : 'Create Team' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }

    .modal-overlay {
      position: fixed;
      inset: 0;
      background: var(--team-dialog-overlay);
      backdrop-filter: blur(6px);
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      opacity: 0;
      visibility: hidden;
      transition: opacity 0.3s, visibility 0.3s;

      &.show {
        opacity: 1;
        visibility: visible;
      }
    }

    .modal-container {
      background: var(--team-dialog-panel);
      border: 1px solid var(--team-dialog-border);
      border-radius: 16px;
      width: 90%;
      max-width: 640px;
      max-height: 85vh;
      overflow-y: auto;
      box-shadow: var(--team-dialog-panel-shadow);
      color: var(--team-dialog-text);
      transform: translateY(-24px);
      transition: transform 0.35s ease;

      &.slide-up {
        transform: translateY(0);
      }
    }

    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      padding: 18px 22px;
      border-bottom: 1px solid var(--team-dialog-border);
      background: var(--team-dialog-header-bg);

      h2 {
        flex: 1;
        font-size: 1.25rem;
        margin: 0;
        font-weight: 600;
        color: var(--team-dialog-text);
      }

      .header-spacer {
        width: 36px;
        height: 36px;
        flex-shrink: 0;
      }

      .close-btn {
        background: var(--team-dialog-close-bg);
        border: 1px solid var(--team-dialog-border);
        border-radius: 8px;
        width: 36px;
        height: 36px;
        font-size: 18px;
        cursor: pointer;
        color: var(--team-dialog-muted);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: background 0.2s, color 0.2s;

        &:hover {
          background: var(--team-dialog-close-hover-bg);
          color: var(--team-dialog-text);
        }
      }
    }

    .modal-body {
      padding: 22px;
    }

    .form-group {
      margin-bottom: 20px;

      label {
        display: block;
        margin-bottom: 8px;
        font-weight: 500;
        font-size: 13px;
        color: var(--team-dialog-muted);
      }

      .required {
        color: #f472b6;
      }

      input,
      select {
        width: 100%;
        padding: 10px 14px;
        border: 1px solid var(--team-dialog-border);
        border-radius: 10px;
        background: var(--team-dialog-input-bg);
        color: var(--team-dialog-text);
        font-size: 14px;
        transition: border-color 0.2s, box-shadow 0.2s;

        &::placeholder {
          color: var(--team-dialog-input-placeholder);
        }

        &:focus {
          outline: none;
          border-color: rgba(124, 58, 237, 0.6);
          box-shadow: 0 0 0 3px rgba(124, 58, 237, 0.15);
        }
      }

      select {
        cursor: pointer;

        option {
          background: var(--team-dialog-select-option-bg);
          color: var(--team-dialog-text);
        }
      }

      select:disabled {
        opacity: 0.5;
        cursor: not-allowed;
      }

      .error-messages small {
        color: #f87171;
        font-size: 12px;
      }
    }

    .slot-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .slot-card {
      border: 2px dashed var(--team-dialog-slot-border);
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
      background: var(--team-dialog-slot-bg);
      font-size: 12px;
      color: var(--team-dialog-muted);
      transition: border-color 0.2s, background 0.2s;

      &:hover {
        border-color: var(--team-dialog-slot-hover-border);
        background: var(--team-dialog-slot-hover-bg);
      }

      &.filled {
        border-style: solid;
        border-color: var(--team-dialog-slot-filled-border);
        background: var(--team-dialog-slot-filled-bg);
        color: var(--team-dialog-text);
      }

      &.picker-active {
        border-color: var(--primary, #7c3aed);
        box-shadow: 0 0 0 2px rgba(124, 58, 237, 0.25);
      }

      img {
        width: 56px;
        height: 56px;
        image-rendering: pixelated;
      }

      .plus {
        font-size: 28px;
        color: var(--team-dialog-plus-color);
        font-weight: 300;
      }

      .remove-slot {
        position: absolute;
        top: 6px;
        right: 6px;
        border: 1px solid var(--team-dialog-border);
        background: var(--team-dialog-remove-bg);
        color: var(--team-dialog-muted);
        border-radius: 50%;
        width: 22px;
        height: 22px;
        cursor: pointer;
        font-size: 12px;
        line-height: 1;

        &:hover {
          color: #f87171;
          border-color: rgba(248, 113, 113, 0.4);
        }
      }
    }

    .picker-fallback {
      margin-top: 12px;

      .picker-label {
        display: block;
        font-size: 12px;
        color: var(--team-dialog-muted);
        margin-bottom: 6px;
      }
    }

    .form-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid var(--team-dialog-border);

      .btn-cancel {
        padding: 10px 20px;
        border: 1px solid var(--team-dialog-border);
        border-radius: 10px;
        background: var(--team-dialog-btn-cancel-bg);
        color: var(--team-dialog-muted);
        cursor: pointer;
        font-weight: 500;
        transition: background 0.2s, color 0.2s;

        &:hover {
          background: var(--team-dialog-btn-cancel-hover-bg);
          color: var(--team-dialog-text);
        }
      }

      .btn-create {
        padding: 10px 24px;
        border: none;
        border-radius: 10px;
        background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
        color: #fff;
        font-weight: 600;
        cursor: pointer;
        box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35);
        transition: transform 0.15s, box-shadow 0.2s;

        &:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(124, 58, 237, 0.45);
        }

        &:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          box-shadow: none;
        }
      }
    }

    .type-badge {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 10px;
      background: rgba(124, 58, 237, 0.35);
      color: #e9d5ff;
    }
  `]
})
export class TeamBuilderModalComponent implements OnInit {
  isOpen = input(false);
  initialPokemonIds = input<number[]>([]);
  /** When set, modal edits this team instead of creating a new one. */
  editingTeam = input<Team | null>(null);
  closeModal = output<void>();
  saveTeam = output<{ id?: number; name: string; pokemon_ids: number[] }>();

  isEditMode = computed(() => this.editingTeam() != null);
  
  private fb = inject(FormBuilder);
  private pokemonStore = inject(PokemonStore);
  private trainerStore = inject(TrainerStore);
  private cdr = inject(ChangeDetectorRef);
  
  teamForm!: FormGroup;
  allPokemonOptions: PokemonOption[] = [];
  selectedPokemonId: number | '' = '';
  loadingPokemon = false;
  /** Sparse slots (index 0–5); undefined = empty slot. */
  selectedPokemon: (PokemonOption | undefined)[] = [];
  existingTeams: Team[] = [];
  readonly slots = [0, 1, 2, 3, 4, 5];
  activeSlotIndex: number | null = null;

  @ViewChild('visiblePicker') visiblePicker?: ElementRef<HTMLSelectElement>;

  get selectedCount(): number {
    return this.selectedPokemon.filter((p): p is PokemonOption => !!p).length;
  }

  getSlotPokemon(index: number): PokemonOption | undefined {
    return this.selectedPokemon[index];
  }

  /** Pokémon available in the dropdown (excludes other slots; active slot may be swapped). */
  get availablePokemon(): PokemonOption[] {
    const active = this.activeSlotIndex;
    const selectedIds = new Set(
      this.selectedPokemon
        .map((p, i) => (i === active ? null : p?.id))
        .filter((id): id is number => id != null)
    );
    return this.allPokemonOptions.filter((p) => !selectedIds.has(p.id));
  }
  
  ngOnInit(): void {
    this.initForm();
  }
  
  constructor() {
    effect(() => {
      const open = this.isOpen();
      const initialIds = this.initialPokemonIds();
      const editing = this.editingTeam();
      if (!open) {
        return;
      }
      if (editing) {
        this.loadPokemonOptions();
        return;
      }
      this.loadPokemonOptions();
      if (initialIds?.length) {
        this.applyInitialPokemon();
      }
    });
  }

  /** Pre-fills the form when editing an existing team. */
  private applyEditingTeam(team: Team): void {
    if (!this.teamForm) {
      this.initForm();
    }
    this.teamForm.patchValue({ teamName: team.name });
    const slots: (PokemonOption | undefined)[] = [];
    team.pokemon_ids.slice(0, 6).forEach((id, i) => {
      const found = this.allPokemonOptions.find((p) => p.id === id);
      slots[i] =
        found ?? {
          id,
          name: `pokemon-${id}`,
          types: [],
          sprite: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
        };
    });
    this.selectedPokemon = slots;
    this.cdr.markForCheck();
  }

  /** Pre-fills selected Pokémon from Pokédex bulk action. */
  private applyInitialPokemon(): void {
    const ids = this.initialPokemonIds();
    if (!ids?.length || !this.allPokemonOptions.length) {
      return;
    }
    const slots: (PokemonOption | undefined)[] = [];
    ids.slice(0, 6).forEach((id, i) => {
      const pokemon = this.allPokemonOptions.find((p) => p.id === id);
      if (pokemon) {
        slots[i] = pokemon;
      }
    });
    this.selectedPokemon = slots;
    this.cdr.markForCheck();
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
      const editing = this.editingTeam();
      if (editing) {
        this.applyEditingTeam(editing);
      } else {
        this.applyInitialPokemon();
      }
      return;
    }

    this.loadingPokemon = true;
    this.pokemonStore.fetchAllPokemon().subscribe({
      next: () => {
        this.allPokemonOptions = this.mapToOptions(this.pokemonStore.getState().pokemon);
        this.loadingPokemon = false;
        const editing = this.editingTeam();
        if (editing) {
          this.applyEditingTeam(editing);
        } else {
          this.applyInitialPokemon();
        }
        this.cdr.markForCheck();
      },
      error: () => {
        this.loadingPokemon = false;
        this.cdr.markForCheck();
      },
    });
  }

  /**
   * Opens the Pokémon select for a grid slot (Bonus 2 / create-team modal).
   */
  openSlotPicker(index: number): void {
    if (index < 0 || index > 5 || this.loadingPokemon) {
      return;
    }
    const slotFilled = !!this.getSlotPokemon(index);
    if (this.selectedCount >= 6 && !slotFilled) {
      return;
    }
    this.activeSlotIndex = index;
    this.selectedPokemonId = '';
    this.cdr.markForCheck();
    this.openPokemonSelect();
  }

  /** Opens the native / visible Pokémon dropdown. */
  private openPokemonSelect(): void {
    const el = this.visiblePicker?.nativeElement;
    if (!el || el.disabled) {
      return;
    }
    el.focus();
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        // Safari or unsupported context — fall back to click
      }
    }
    el.click();
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
      this.setPokemonAtSlot(this.activeSlotIndex, pokemon);
    } else {
      this.addPokemon(pokemon);
    }
    this.activeSlotIndex = null;
    this.selectedPokemonId = '';
    this.cdr.markForCheck();
  }

  private setPokemonAtSlot(index: number, pokemon: PokemonOption): void {
    const copy = [...this.selectedPokemon];
    while (copy.length <= index) {
      copy.push(undefined);
    }
    for (let j = 0; j < copy.length; j++) {
      if (j !== index && copy[j]?.id === pokemon.id) {
        copy[j] = undefined;
      }
    }
    copy[index] = pokemon;
    while (copy.length > 0 && !copy[copy.length - 1]) {
      copy.pop();
    }
    this.selectedPokemon = copy;
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
    if (this.selectedCount >= 6) {
      alert('Maximum 6 Pokémon allowed!');
      return;
    }

    if (this.selectedPokemon.some((p) => p?.id === pokemon.id)) {
      alert('Pokémon already in team!');
      return;
    }

    const firstEmpty = this.slots.find((i) => !this.getSlotPokemon(i)) ?? this.selectedPokemon.length;
    this.setPokemonAtSlot(firstEmpty, pokemon);
    this.selectedPokemonId = '';
  }

  removePokemon(index: number): void {
    if (index < 0 || index >= this.selectedPokemon.length) {
      return;
    }
    const copy = [...this.selectedPokemon];
    copy[index] = undefined;
    while (copy.length > 0 && !copy[copy.length - 1]) {
      copy.pop();
    }
    this.selectedPokemon = copy;
    this.cdr.markForCheck();
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
    
    if (this.selectedCount === 0) {
      alert('Add at least 1 Pokémon');
      return;
    }

    const editing = this.editingTeam();
    const teamData = {
      id: editing?.id,
      name: this.teamForm.get('teamName')?.value,
      pokemon_ids: this.slots
        .map((i) => this.getSlotPokemon(i)?.id)
        .filter((id): id is number => id != null),
    };

    this.saveTeam.emit(teamData);
    this.handleClose();
  }
  
  private resetForm(): void {
    this.teamForm.reset();
    this.selectedPokemon = [];
    this.selectedPokemonId = '';
  }
}