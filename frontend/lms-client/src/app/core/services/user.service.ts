import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { User, Role, Page, Query } from '../models/models';
@Injectable({ providedIn: 'root' })
export class UserService {
  private api = inject(ApiService);
  list(q: Query = {}) {
    return this.api.get<Page<User>>('/users', q);
  }
  get(id: string) {
    return this.api.get<User>(`/users/${id}`);
  }
  role(id: string, role: Role) {
    return this.api.patch(`/users/${id}/role`, { role });
  }
  status(id: string, isActive: boolean) {
    return this.api.patch(`/users/${id}/status`, { isActive });
  }
}
