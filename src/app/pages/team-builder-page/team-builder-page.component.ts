import { ChangeDetectionStrategy, Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-team-builder-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `<h1>Team Builder (Coming Soon)</h1>`,
  styles: []
})
export class TeamBuilderPageComponent {}

export class BattlesPageComponent {}
export class ProfilePageComponent {}