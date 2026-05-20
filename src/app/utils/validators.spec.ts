import { FormControl } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { isValidEvTotal, uniqueTeamNameValidator } from './validators';

describe('validators', () => {
  it('isValidEvTotal returns true only when EVs sum to 510', () => {
    expect(isValidEvTotal(252, 252, 0, 0, 0, 6)).toBeTrue();
    expect(isValidEvTotal(100, 100, 100, 100, 100, 100)).toBeFalse();
  });

  it('uniqueTeamNameValidator rejects duplicate team names', async () => {
    const validator = uniqueTeamNameValidator(() => ['Kanto Starters', 'Johto Squad']);
    const control = new FormControl('kanto starters');
    const result = await firstValueFrom(validator(control)!);
    expect(result).toEqual({ uniqueName: true });
  });

  it('uniqueTeamNameValidator accepts a new team name', async () => {
    const validator = uniqueTeamNameValidator(() => ['Kanto Starters']);
    const control = new FormControl('Paldea Dream Team');
    const result = await firstValueFrom(validator(control)!);
    expect(result).toBeNull();
  });
});
