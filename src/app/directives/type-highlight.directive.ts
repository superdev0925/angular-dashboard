import { Directive, HostBinding, inject, input, effect, signal } from '@angular/core';
import { PokemonSelectors } from '../state/pokemon.selectors';

/**
 * Bonus 3: Highlights Pokédex rows by type matchup (signal-based).
 * Green border = attacking type is super effective; red = weak matchup.
 */
@Directive({
  selector: 'tr[appTypeHighlight]',
  standalone: true,
})
export class TypeHighlightDirective {
  /** Attacking type used for matchup (e.g. fire). */
  appTypeHighlight = input<string>('');
  /** Defending types on the Pokémon row. */
  defendingTypes = input<string[]>([]);

  private selectors = inject(PokemonSelectors);
  private matchup = signal<'super' | 'weak' | 'neutral'>('neutral');

  constructor() {
    effect(() => {
      const attacker = this.appTypeHighlight();
      const defenders = this.defendingTypes();
      if (!attacker || !defenders?.length) {
        this.matchup.set('neutral');
        return;
      }
      this.matchup.set(this.selectors.getMatchup(attacker, defenders));
    });
  }

  @HostBinding('class.type-super-effective')
  get isSuperEffective(): boolean {
    return this.matchup() === 'super';
  }

  @HostBinding('class.type-weak')
  get isWeak(): boolean {
    return this.matchup() === 'weak';
  }
}
