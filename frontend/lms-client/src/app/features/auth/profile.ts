import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { InitialsPipe } from '../../shared/pipes/initials.pipe';
import { IconComponent } from '../../shared/components/icon';
import { uiHelpers } from '../../shared/components/ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
@Component({
  imports: [ReactiveFormsModule, DatePipe, InitialsPipe, IconComponent],
  template: `<div class="page-heading">
      <span class="eyebrow">MAKE YOURSELF AT HOME</span>
      <h1>Account settings</h1>
      <p>Your profile and security, in one place.</p>
    </div>
    <div class="profile-grid">
      <section class="panel profile-card">
        <span class="avatar large">{{ auth.user()?.name | initials }}</span>
        <h2>{{ auth.user()?.name }}</h2>
        <span class="pill">{{ auth.user()?.role }}</span>
        <dl>
          <dt>Email address</dt>
          <dd>{{ auth.user()?.email }}</dd>
          <dt>Member since</dt>
          <dd>{{ auth.user()?.createdAt | date: 'longDate' }}</dd>
          <dt>Account status</dt>
          <dd><span class="status-dot"></span>Active</dd>
        </dl>
        <p class="muted small">Contact your administrator if your profile details need updating.</p>
      </section>
      <section class="panel">
        <div class="panel-heading">
          <span class="icon-tile"><app-icon name="lock" /></span>
          <div>
            <h2>Change your password</h2>
            <p>Keep your account secure with a strong password.</p>
          </div>
        </div>
        <form [formGroup]="form" (ngSubmit)="save()" class="form-stack">
          <label
            >Current password<input
              type="password"
              formControlName="currentPassword"
              autocomplete="current-password" /></label
          ><label
            >New password<input
              type="password"
              formControlName="newPassword"
              autocomplete="new-password"
            /><small
              >12–128 characters, including uppercase, lowercase, a number, and a symbol.</small
            ></label
          ><label
            >Confirm new password<input
              type="password"
              formControlName="confirmPassword"
              autocomplete="new-password"
          /></label>
          @if (form.touched && form.invalid) {
            <div class="form-error">
              Enter your current password and matching new passwords that meet the requirements.
            </div>
          }
          @if (error()) {
            <div class="form-error" role="alert">{{ error() }}</div>
          }
          <p class="form-hint">
            After changing your password, you’ll sign in again on all devices.
          </p>
          <button class="btn btn-primary" [disabled]="busy()">
            {{ busy() ? 'Updating…' : 'Update password' }}<app-icon name="arrow" />
          </button>
        </form>
      </section>
    </div>`,
})
export class Profile {
  auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private ui = uiHelpers();
  busy = signal(false);
  error = signal('');
  form = this.fb.nonNullable.group(
    {
      currentPassword: ['', Validators.required],
      newPassword: [
        '',
        [
          Validators.required,
          Validators.minLength(12),
          Validators.maxLength(128),
          Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/),
        ],
      ],
      confirmPassword: ['', Validators.required],
    },
    {
      validators: (c) =>
        c.get('newPassword')?.value === c.get('confirmPassword')?.value ? null : { mismatch: true },
    },
  );
  async save() {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set('');
    try {
      const v = this.form.getRawValue();
      await firstValueFrom(this.auth.changePassword(v.currentPassword, v.newPassword));
      this.auth.clear();
      this.ui.toast('Password updated. Please sign in again.');
      await this.router.navigateByUrl('/login');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
