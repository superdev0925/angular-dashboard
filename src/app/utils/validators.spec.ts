import { FormControl } from '@angular/forms';
import { firstValueFrom, isObservable, Observable } from 'rxjs';
import { isValidEvTotal, uniqueTeamNameValidator } from './validators';
import { ValidationErrors, AsyncValidatorFn } from '@angular/forms';

/** Runs an async validator whether it returns Observable or Promise. */
async function runAsyncValidator(
  validator: AsyncValidatorFn,
  control: FormControl
): Promise<ValidationErrors | null> {
  const result = validator(control);
  if (!result) {
    return null;
  }
  if (isObservable(result)) {
    return firstValueFrom(result as Observable<ValidationErrors | null>);
  }
  return result;
}

describe('validators', () => {
  it('isValidEvTotal returns true only when EVs sum to 510', () => {
    expect(isValidEvTotal(252, 252, 0, 0, 0, 6)).toBeTrue();
    expect(isValidEvTotal(100, 100, 100, 100, 100, 100)).toBeFalse();
  });

  it('uniqueTeamNameValidator rejects duplicate team names', async () => {
    const validator = uniqueTeamNameValidator(() => ['Kanto Starters', 'Johto Squad']);
    const control = new FormControl('kanto starters');
    const result = await runAsyncValidator(validator, control);
    expect(result).toEqual({ uniqueName: true });
  });

  it('uniqueTeamNameValidator accepts a new team name', async () => {
    const validator = uniqueTeamNameValidator(() => ['Kanto Starters']);
    const control = new FormControl('Paldea Dream Team');
    const result = await runAsyncValidator(validator, control);
    expect(result).toBeNull();
  });
});
