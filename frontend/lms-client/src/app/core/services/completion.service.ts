import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Analytics, Completion, CompletionSettings } from '../models/advanced';
@Injectable({ providedIn: 'root' })
export class CompletionService {
  private api = inject(ApiService);
  summary(id: string) {
    return this.api.get<Completion>(`/progress/courses/${id}/summary`);
  }
  analytics() {
    return this.api.get<Analytics>('/analytics');
  }
  settings(id: string) {
    return this.api.get<CompletionSettings>(`/courses/${id}/completion-settings`);
  }
  saveSettings(id: string, r: CompletionSettings) {
    return this.api.put(`/courses/${id}/completion-settings`, r);
  }
}
