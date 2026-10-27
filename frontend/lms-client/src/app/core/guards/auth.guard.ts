import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { Role } from '../models/models';
export const authGuard: CanActivateFn = (_, state) => {
  const auth = inject(AuthService);
  return (
    auth.authenticated() ||
    inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } })
  );
};
export const roleGuard: CanActivateFn = (route) => {
  const auth = inject(AuthService);
  const roles = route.data['roles'] as Role[];
  return (
    (!!auth.user() && roles.includes(auth.user()!.role)) || inject(Router).parseUrl(auth.home())
  );
};
