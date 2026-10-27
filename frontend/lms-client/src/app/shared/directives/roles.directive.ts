import { Directive, ElementRef, effect, inject, input } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { Role } from '../../core/models/models';
@Directive({ selector: '[appRoles]' })
export class RolesDirective {
  appRoles = input.required<Role[]>();
  private auth = inject(AuthService);
  private el = inject(ElementRef<HTMLElement>);
  constructor() {
    effect(() => {
      this.el.nativeElement.hidden = !this.appRoles().includes(this.auth.user()?.role as Role);
    });
  }
}
