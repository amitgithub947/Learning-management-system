import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';
import { AuthResponse } from '../models/models';
const session: AuthResponse = {
  accessToken: 'test-access-token',
  refreshToken: 'test-refresh-token',
  accessTokenExpiresAt: new Date(Date.now() + 900000).toISOString(),
  user: {
    userId: 'test-student',
    name: 'Test Student',
    email: 'student@example.test',
    role: 'Student',
    createdAt: new Date().toISOString(),
    isActive: true,
  },
};
describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  it('keeps access tokens in memory and refresh tokens out of localStorage', async () => {
    const login = auth.login('student@example.test', 'Test!Password123');
    const request = http.expectOne('/api/auth/login');
    expect(request.request.body.email).toBe('student@example.test');
    request.flush({ success: true, data: session });
    await login;
    expect(auth.user()?.role).toBe('Student');
    expect(auth.accessToken()).toBe(session.accessToken);
    expect(sessionStorage.getItem('lms.refresh')).toBe(session.refreshToken);
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.getItem('accessToken')).toBeNull();
    expect(auth.home()).toBe('/student/dashboard');
  });
  it('restores the session using a rotated refresh token', async () => {
    sessionStorage.setItem('lms.refresh', 'old-refresh');
    const restoration = auth.restore();
    const request = http.expectOne('/api/auth/refresh');
    expect(request.request.body.refreshToken).toBe('old-refresh');
    request.flush({ success: true, data: session });
    await restoration;
    expect(auth.authenticated()).toBe(true);
    expect(sessionStorage.getItem('lms.refresh')).toBe(session.refreshToken);
  });
  it('shares a single refresh request between concurrent callers', async () => {
    sessionStorage.setItem('lms.refresh', 'old-refresh');
    const a = firstValueFrom(auth.refresh());
    const b = firstValueFrom(auth.refresh());
    http.expectOne('/api/auth/refresh').flush({ success: true, data: session });
    expect(await a).toEqual(await b);
    http.expectNone('/api/auth/refresh');
  });
  it('clears the session if refresh fails', async () => {
    sessionStorage.setItem('lms.refresh', 'expired-refresh');
    const restoration = auth.restore();
    http
      .expectOne('/api/auth/refresh')
      .flush({ message: 'Expired' }, { status: 401, statusText: 'Unauthorized' });
    await restoration;
    expect(auth.authenticated()).toBe(false);
    expect(sessionStorage.getItem('lms.refresh')).toBeNull();
  });
  it('revokes the backend session and clears local state on logout', async () => {
    sessionStorage.setItem('lms.refresh', 'old-refresh');
    auth.user.set(session.user);
    auth.accessToken.set(session.accessToken);
    const logout = auth.logout();
    expect(auth.authenticated()).toBe(false);
    const request = http.expectOne('/api/auth/logout');
    expect(request.request.body.refreshToken).toBe('old-refresh');
    request.flush({ success: true, data: null });
    await logout;
    expect(sessionStorage.length).toBe(0);
  });
  it('does not resurrect a session after logout during a refresh', async () => {
    sessionStorage.setItem('lms.refresh', 'old-refresh');
    const refresh = firstValueFrom(auth.refresh());
    const request = http.expectOne('/api/auth/refresh');
    const logout = auth.logout();
    http.expectOne('/api/auth/logout').flush({ success: true, data: null });
    request.flush({ success: true, data: session });
    await Promise.all([refresh, logout]);
    expect(auth.authenticated()).toBe(false);
    expect(sessionStorage.getItem('lms.refresh')).toBeNull();
  });
});
