import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';
import { Page, Query } from '../models/models';
import { Certificate } from '../models/advanced';
@Injectable({ providedIn: 'root' })
export class CertificateService {
  private api = inject(ApiService);
  private http = inject(HttpClient);
  mine(q: Query = {}) {
    return this.api.get<Page<Certificate>>('/certificates/my', q);
  }
  issue(id: string) {
    return this.api.post<Certificate>(`/certificates/course/${id}/issue`, {});
  }
  verify(code: string) {
    return this.api.get<Certificate>(`/certificates/verify/${encodeURIComponent(code)}`);
  }
  download(id: string) {
    return this.http.get(`${environment.apiBaseUrl}/certificates/${id}/download`, {
      responseType: 'blob',
    });
  }
}
