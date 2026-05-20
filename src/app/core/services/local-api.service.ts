// src/app/services/local-api.service.ts
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Trainer {
  id: number;
  name: string;
  badge_count: number;
  region: string;
  avatar_url: string;
  rank: string;
}

export interface Team {
  id: number;
  trainer_id: number;
  name: string;
  pokemon_ids: number[];
  created_at: string;
}

export interface Battle {
  id: number;
  trainer_id: number;
  opponent_name: string;
  team_id: number;
  result: 'win' | 'loss';
  date: string;
  score_trainer: number;
  score_opponent: number;
}

export interface BattleLog {
  id: number;
  battle_id: number;
  timestamp: string;
  message: string;
  severity: 'success' | 'info' | 'danger' | 'warning';
}

@Injectable({ providedIn: 'root' })
export class LocalApiService {
  private http = inject(HttpClient);
  private baseUrl = 'http://localhost:4000';

  // Trainer endpoints
  getTrainers(): Observable<Trainer[]> {
    return this.http.get<Trainer[]>(`${this.baseUrl}/trainers`);
  }

  getTrainer(id: number): Observable<Trainer> {
    return this.http.get<Trainer>(`${this.baseUrl}/trainers/${id}`);
  }

  updateTrainer(id: number, data: Partial<Trainer>): Observable<Trainer> {
    return this.http.patch<Trainer>(`${this.baseUrl}/trainers/${id}`, data);
  }

  // Team endpoints
  getTeams(trainerId?: number): Observable<Team[]> {
    const url = trainerId ? `${this.baseUrl}/teams?trainer_id=${trainerId}` : `${this.baseUrl}/teams`;
    return this.http.get<Team[]>(url);
  }

  getTeam(id: number): Observable<Team> {
    return this.http.get<Team>(`${this.baseUrl}/teams/${id}`);
  }

  createTeam(team: Omit<Team, 'id'>): Observable<Team> {
    return this.http.post<Team>(`${this.baseUrl}/teams`, team);
  }

  updateTeam(id: number, data: Partial<Team>): Observable<Team> {
    return this.http.patch<Team>(`${this.baseUrl}/teams/${id}`, data);
  }

  deleteTeam(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/teams/${id}`);
  }

  // Battle endpoints
  getBattles(trainerId?: number): Observable<Battle[]> {
    const url = trainerId ? `${this.baseUrl}/battles?trainer_id=${trainerId}` : `${this.baseUrl}/battles`;
    return this.http.get<Battle[]>(url);
  }

  createBattle(battle: Omit<Battle, 'id'>): Observable<Battle> {
    return this.http.post<Battle>(`${this.baseUrl}/battles`, battle);
  }

  // Battle Log endpoints
  getBattleLogs(battleId?: number): Observable<BattleLog[]> {
    const url = battleId ? `${this.baseUrl}/battle_logs?battle_id=${battleId}` : `${this.baseUrl}/battle_logs`;
    return this.http.get<BattleLog[]>(url);
  }

  createBattleLog(log: Omit<BattleLog, 'id'>): Observable<BattleLog> {
    return this.http.post<BattleLog>(`${this.baseUrl}/battle_logs`, log);
  }

  // Polling for real-time battle logs (subscription simulation)
  pollBattleLogs(lastId: number = 0, intervalMs: number = 5000): Observable<BattleLog[]> {
    return new Observable(observer => {
      const interval = setInterval(() => {
        this.getBattleLogs().subscribe({
          next: (logs) => {
            const newLogs = logs.filter(log => log.id > lastId);
            if (newLogs.length > 0) {
              observer.next(newLogs);
            }
          },
          error: (err) => observer.error(err)
        });
      }, intervalMs);
      
      return () => clearInterval(interval);
    });
  }
}