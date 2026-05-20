import { Routes } from '@angular/router';
import { AppComponent } from './app.component';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard', component: AppComponent, data: { tab: 'dashboard' } },
  { path: 'pokedex', component: AppComponent, data: { tab: 'pokedex' } },
  { path: 'pokedex-virtual', component: AppComponent, data: { tab: 'pokedex-virtual' } },
  { path: 'teams', component: AppComponent, data: { tab: 'teams' } },
  { path: 'battles', component: AppComponent, data: { tab: 'battles' } },
  { path: 'profile', component: AppComponent, data: { tab: 'profile' } },
  { path: 'team-builder', component: AppComponent, data: { tab: 'team-builder' } },
  { path: '**', redirectTo: 'dashboard' },
];
