import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { MatSnackBar } from '@angular/material/snack-bar';
export function errorMessage(error: unknown): string {
  if (error instanceof HttpErrorResponse) {
    const errors = error.error?.errors as Record<string, string[]> | undefined;
    if (errors) return Object.values(errors).flat().join(' ');
    return (
      error.error?.message ||
      (error.status === 0
        ? 'Cannot connect to the server. Please try again.'
        : 'We couldn’t complete that request. Please try again.')
    );
  }
  return error instanceof Error ? error.message : 'Something went wrong. Please try again.';
}
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const snack = inject(MatSnackBar);
  return next(req).pipe(
    catchError((error) => {
      if (req.method !== 'GET' && error.status !== 401)
        snack.open(errorMessage(error), 'Dismiss', { duration: 6000, panelClass: 'error-toast' });
      return throwError(() => error);
    }),
  );
};
