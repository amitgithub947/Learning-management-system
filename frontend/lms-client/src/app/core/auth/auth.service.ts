import { Injectable, computed, inject, signal } from '@angular/core';
import { HttpBackend, HttpClient } from '@angular/common/http';
import {
  Observable,
  catchError,
  finalize,
  firstValueFrom,
  map,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse, AuthResponse, User } from '../models/models';
@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = new HttpClient(inject(HttpBackend));
  private apiHttp = inject(HttpClient);
  private readonly key = 'lms.refresh';
  private refreshRequest?: Observable<AuthResponse>;
  private revision = 0;
  readonly user = signal<User | null>(null);
  readonly accessToken = signal<string | null>(null);
  readonly authenticated = computed(() => this.user() !== null);
  readonly home = computed(() =>
    this.user() ? `/${this.user()!.role.toLowerCase()}/dashboard` : '/login',
  );
  private accept(auth: AuthResponse) {
    this.user.set(auth.user);
    this.accessToken.set(auth.accessToken);
    sessionStorage.setItem(this.key, auth.refreshToken);
  }
  async restore() {
    if (!sessionStorage.getItem(this.key)) return;
    try {
      await firstValueFrom(this.refresh());
    } catch {
      this.clear();
    }
  }
  async login(email: string, password: string) {
    const auth = await firstValueFrom(
      this.http.post<ApiResponse<AuthResponse>>(`${environment.apiBaseUrl}/auth/login`, {
        email,
        password,
      }),
    );
    this.revision++;
    this.accept(auth.data);
  }
  async register(name: string, email: string, password: string) {
    const auth = await firstValueFrom(
      this.http.post<ApiResponse<AuthResponse>>(`${environment.apiBaseUrl}/auth/register`, {
        name,
        email,
        password,
      }),
    );
    this.revision++;
    this.accept(auth.data);
  }
  refresh(): Observable<AuthResponse> {
    if (this.refreshRequest) return this.refreshRequest;
    const token = sessionStorage.getItem(this.key);
    const revision = this.revision;
    if (!token) return throwError(() => new Error('Please sign in again.'));
    this.refreshRequest = this.http
      .post<ApiResponse<AuthResponse>>(`${environment.apiBaseUrl}/auth/refresh`, {
        refreshToken: token,
      })
      .pipe(
        map((r) => r.data),
        tap((r) => {
          if (revision === this.revision) this.accept(r);
        }),
        catchError((error) => {
          if (revision === this.revision) this.clear();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshRequest = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.refreshRequest;
  }
  async logout() {
    const refreshToken = sessionStorage.getItem(this.key);
    this.clear();
    if (refreshToken)
      await firstValueFrom(
        this.http.post(`${environment.apiBaseUrl}/auth/logout`, { refreshToken }),
      );
  }
  changePassword(currentPassword: string, newPassword: string) {
    return this.apiHttp.post(`${environment.apiBaseUrl}/auth/change-password`, {
      currentPassword,
      newPassword,
    });
  }
  clear() {
    this.revision++;
    this.user.set(null);
    this.accessToken.set(null);
    sessionStorage.removeItem(this.key);
  }
}
