import { TestBed } from '@angular/core/testing';
import {
  ActivatedRouteSnapshot,
  Router,
  RouterStateSnapshot,
  provideRouter,
} from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from '../auth/auth.service';
import { authGuard, roleGuard } from './auth.guard';
describe('Route guards', () => {
  beforeEach(() =>
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }),
  );
  it('preserves the requested route when authentication is required', () => {
    const result = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, { url: '/student/progress' } as RouterStateSnapshot),
    );
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe(
      '/login?returnUrl=%2Fstudent%2Fprogress',
    );
  });
  it('blocks a Student from the Admin workspace', () => {
    const auth = TestBed.inject(AuthService);
    auth.user.set({
      userId: 'test',
      name: 'Student',
      email: 'student@example.test',
      role: 'Student',
      isActive: true,
      createdAt: '',
    });
    const route = { data: { roles: ['Admin'] } } as unknown as ActivatedRouteSnapshot;
    const result = TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot));
    expect(TestBed.inject(Router).serializeUrl(result as never)).toBe('/student/dashboard');
  });
  it('allows an Admin into the Admin workspace', () => {
    TestBed.inject(AuthService).user.set({
      userId: 'test',
      name: 'Admin',
      email: 'admin@example.test',
      role: 'Admin',
      isActive: true,
      createdAt: '',
    });
    const route = { data: { roles: ['Admin'] } } as unknown as ActivatedRouteSnapshot;
    expect(TestBed.runInInjectionContext(() => roleGuard(route, {} as RouterStateSnapshot))).toBe(
      true,
    );
  });
});
