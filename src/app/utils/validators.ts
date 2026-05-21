import { AbstractControl, ValidationErrors, AsyncValidatorFn } from '@angular/forms';
import { Observable, of } from 'rxjs';
import { debounceTime, distinctUntilChanged, map, switchMap } from 'rxjs/operators';

/**
 * Returns true when competitive EV spread totals exactly 510.
 */
export function isValidEvTotal(hp: number, atk: number, def: number, spAtk: number, spDef: number, speed: number): boolean {
  return hp + atk + def + spAtk + spDef + speed === 510;
}

/**
 * Async validator ensuring team name is unique among existing team names (case-insensitive).
 */
export function uniqueTeamNameValidator(
  getExistingNames: () => string[],
  getExcludeName?: () => string | null | undefined
): AsyncValidatorFn {
  return (control: AbstractControl): Observable<ValidationErrors | null> => {
    return of(control.value).pipe(
      debounceTime(500),
      distinctUntilChanged(),
      switchMap((name: string) => {
        const normalized = (name ?? '').trim().toLowerCase();
        const exclude = (getExcludeName?.() ?? '').trim().toLowerCase();
        const exists = getExistingNames().some((existing) => {
          const existingNorm = existing.trim().toLowerCase();
          return existingNorm === normalized && existingNorm !== exclude;
        });
        return of(exists ? { uniqueName: true } : null);
      })
    );
  };
}

/**
 * Sync validator for competitive mode EV spread (must sum to 510).
 */
export function evSpreadValidator(control: AbstractControl): ValidationErrors | null {
  const group = control.parent;
  if (!group) {
    return null;
  }
  const total =
    (group.get('evHp')?.value ?? 0) +
    (group.get('evAtk')?.value ?? 0) +
    (group.get('evDef')?.value ?? 0) +
    (group.get('evSpAtk')?.value ?? 0) +
    (group.get('evSpDef')?.value ?? 0) +
    (group.get('evSpeed')?.value ?? 0);
  return total === 510 ? null : { evTotal: { actual: total, required: 510 } };
}
