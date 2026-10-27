import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, Query } from '../models/models';
@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private url(path: string) {
    return `${environment.apiBaseUrl}${path}`;
  }
  get<T>(path: string, query: Query = {}) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query))
      if (value !== undefined && value !== null && value !== '')
        params = params.set(key, String(value));
    return this.http.get<ApiResponse<T>>(this.url(path), { params }).pipe(map((r) => r.data));
  }
  post<T>(path: string, body: unknown) {
    return this.http.post<ApiResponse<T>>(this.url(path), body).pipe(map((r) => r.data));
  }
  put<T>(path: string, body: unknown) {
    return this.http.put<ApiResponse<T>>(this.url(path), body).pipe(map((r) => r.data));
  }
  patch<T>(path: string, body: unknown = {}) {
    return this.http.patch<ApiResponse<T>>(this.url(path), body).pipe(map((r) => r.data));
  }
  delete(path: string) {
    return this.http.delete<ApiResponse<null>>(this.url(path));
  }
}
