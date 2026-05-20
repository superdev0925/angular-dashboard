import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TrainerStore, Trainer } from '../../state/trainer.store';
import { DEFAULT_TRAINER_AVATAR, resolveTrainerAvatarUrl } from '../../utils/avatar-url';

@Component({
  selector: 'app-profile-page',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="profile-page">
      <h1>Trainer Profile</h1>
      
      <div class="profile-card" *ngIf="trainer() as t">
        <div class="avatar">
          <img [src]="trainerAvatarUrl(t.avatar_url)" [alt]="t.name" (error)="onAvatarError($event)">
        </div>
        
        <div class="profile-info">
          <div class="info-group">
            <label>Name:</label>
            <input [(ngModel)]="editTrainer.name" [placeholder]="t.name">
          </div>
          
          <div class="info-group">
            <label>Region:</label>
            <input [(ngModel)]="editTrainer.region" [placeholder]="t.region">
          </div>
          
          <div class="info-group">
            <label>Rank:</label>
            <input [(ngModel)]="editTrainer.rank" [placeholder]="t.rank">
          </div>
          
          <div class="info-group">
            <label>Badges:</label>
            <span class="badge-count">{{ t.badge_count }}</span>
          </div>
          
          <button class="save-btn" (click)="saveProfile()">Save Changes</button>
        </div>
      </div>
      
      <div class="teams-section">
        <h2>My Teams</h2>
        <div class="teams-grid">
          <div *ngFor="let team of teams()" class="team-card">
            <h3>{{ team.name }}</h3>
            <p>Pokémon: {{ team.pokemon_ids.length }}/6</p>
            <p>Created: {{ team.created_at | date }}</p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-page { padding: 20px; max-width: 1200px; margin: 0 auto; }
    .profile-card { background: white; border-radius: 10px; padding: 30px; margin-bottom: 30px; display: flex; gap: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .avatar img { width: 150px; height: 150px; border-radius: 50%; object-fit: cover; }
    .profile-info { flex: 1; }
    .info-group { margin-bottom: 20px; }
    .info-group label { display: block; font-weight: 600; margin-bottom: 5px; color: #666; }
    .info-group input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 5px; font-size: 16px; }
    .badge-count { font-size: 24px; font-weight: bold; color: #ffc107; }
    .save-btn { background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 5px; cursor: pointer; font-size: 16px; }
    .save-btn:hover { background: #45a049; }
    .teams-section { background: white; border-radius: 10px; padding: 20px; margin-top: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
    .teams-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; margin-top: 20px; }
    .team-card { border: 1px solid #eee; border-radius: 8px; padding: 15px; transition: transform 0.3s; }
    .team-card:hover { transform: translateY(-3px); box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
    .team-card h3 { margin: 0 0 10px 0; color: #333; }
  `]
})
export class ProfilePageComponent implements OnInit {
  private trainerStore = inject(TrainerStore);
  
  trainer = signal<Trainer | null>(null);
  teams = signal<any[]>([]);
  editTrainer: Partial<Trainer> = {};
  trainerAvatarUrl(url?: string | null): string {
    return resolveTrainerAvatarUrl(url);
  }

  onAvatarError(event: Event): void {
    const img = event.target as HTMLImageElement;
    if (!img.src.includes(DEFAULT_TRAINER_AVATAR)) {
      img.src = DEFAULT_TRAINER_AVATAR;
    }
  }

  ngOnInit() {
    this.trainerStore.currentTrainer$.subscribe(trainer => {
      this.trainer.set(trainer);
      if (trainer) {
        this.editTrainer = { ...trainer };
      }
    });
    
    this.trainerStore.teams$.subscribe(teams => {
      this.teams.set(teams);
    });
    
    this.trainerStore.fetchTrainer(1).subscribe();
    this.trainerStore.fetchTeams(1).subscribe();
  }
  
  saveProfile() {
    const currentTrainer = this.trainer();
    if (currentTrainer && this.editTrainer) {
      this.trainerStore.updateTrainerProfile({
        id: currentTrainer.id,
        name: this.editTrainer.name || currentTrainer.name,
        region: this.editTrainer.region || currentTrainer.region,
        avatar_url: this.editTrainer.avatar_url || currentTrainer.avatar_url,
        rank: this.editTrainer.rank || currentTrainer.rank,
      }).subscribe();
    }
  }
}