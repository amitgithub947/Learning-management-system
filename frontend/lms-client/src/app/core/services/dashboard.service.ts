import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Dashboard } from '../models/models';
@Injectable({ providedIn: 'root' })
export class DashboardService {
  private api = inject(ApiService);
  get() {
    return this.api.get<Dashboard>('/dashboard');
  }
}
