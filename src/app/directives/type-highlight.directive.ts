import { Directive, HostBinding, inject, input, effect } from '@angular/core';
import { PokemonSelectors } from '../state/pokemon.selectors';

/**
 * Highlights Pokédex rows by type matchup when an attacking type filter is set.
 * Green = super effective, red = not very effective / weak matchup.
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
  private matchup: 'super' | 'weak' | 'neutral' = 'neutral';

  constructor() {
    effect(() => {
      const attacker = this.appTypeHighlight();
      const defenders = this.defendingTypes();
      if (!attacker || !defenders?.length) {
        this.matchup = 'neutral';
        return;
      }
      this.matchup = this.selectors.getMatchup(attacker, defenders);
    });
  }

  @HostBinding('class.type-super-effective')
  get isSuperEffective(): boolean {
    return this.matchup === 'super';
  }

  @HostBinding('class.type-weak')
  get isWeak(): boolean {
    return this.matchup === 'weak';
  }
}
