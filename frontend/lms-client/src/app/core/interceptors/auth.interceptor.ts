import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { environment } from '../../../environments/environment';
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!req.url.startsWith(`${environment.apiBaseUrl}/`)) return next(req);
  const token = auth.accessToken();
  const request = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || !token) return throwError(() => error);
      const retry = (accessToken: string) =>
        next(req.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } }));
      // A concurrent request may already have rotated the token.
      if (auth.accessToken() && auth.accessToken() !== token) return retry(auth.accessToken()!);
      return auth.refresh().pipe(
        switchMap((session) => retry(session.accessToken)),
        catchError((refreshError) => {
          auth.clear();
          void router.navigate(['/login'], { queryParams: { returnUrl: router.url } });
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
