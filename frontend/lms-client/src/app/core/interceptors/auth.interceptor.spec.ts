import { TestBed } from '@angular/core/testing';
import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { authInterceptor } from './auth.interceptor';
import { AuthService } from '../auth/auth.service';
describe('Authentication interceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
    auth.accessToken.set('old-token');
    sessionStorage.setItem('lms.refresh', 'refresh-token');
  });
  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });
  it('attaches bearer tokens only to the configured API', async () => {
    const local = firstValueFrom(client.get('/api/courses'));
    const request = http.expectOne('/api/courses');
    expect(request.request.headers.get('Authorization')).toBe('Bearer old-token');
    request.flush({});
    await local;
    const remote = firstValueFrom(client.get('https://example.test/api'));
    const external = http.expectOne('https://example.test/api');
    expect(external.request.headers.has('Authorization')).toBe(false);
    external.flush({});
    await remote;
  });
  it('coordinates simultaneous 401 responses and retries with one rotated token', async () => {
    const a = firstValueFrom(client.get('/api/courses'));
    const b = firstValueFrom(client.get('/api/users'));
    http.expectOne('/api/courses').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/users').flush({}, { status: 401, statusText: 'Unauthorized' });
    http.expectOne('/api/auth/refresh').flush({
      success: true,
      data: {
        accessToken: 'new-token',
        refreshToken: 'new-refresh',
        accessTokenExpiresAt: new Date().toISOString(),
        user: {
          userId: 'user',
          name: 'Test',
          role: 'Admin',
          email: 'admin@example.test',
          isActive: true,
          createdAt: new Date().toISOString(),
        },
      },
    });
    const retriedA = http.expectOne('/api/courses');
    const retriedB = http.expectOne('/api/users');
    expect(retriedA.request.headers.get('Authorization')).toBe('Bearer new-token');
    expect(retriedB.request.headers.get('Authorization')).toBe('Bearer new-token');
    retriedA.flush({ ok: true });
    retriedB.flush({ ok: true });
    await Promise.all([a, b]);
    expect(sessionStorage.getItem('lms.refresh')).toBe('new-refresh');
  });
});
