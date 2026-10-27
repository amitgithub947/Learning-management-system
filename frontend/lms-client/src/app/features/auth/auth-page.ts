import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { errorMessage } from '../../core/interceptors/error.interceptor';
import { IconComponent } from '../../shared/components/icon';
@Component({
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  template: `<section class="auth-section container">
    <div class="auth-story">
      <span class="eyebrow">A LITTLE PROGRESS, EVERY DAY</span>
      <h1>There’s more<br />in you than<br /><span>you know.</span></h1>
      <p>Learn a new skill. Open a new door.<br />Start with a little curiosity.</p>
      <div class="auth-story-art">
        <app-icon name="book" /><span class="auth-orbit"></span><span class="auth-star">✦</span>
      </div>
      <span class="auth-story-note"
        ><app-icon name="shield" />A space to learn, grow, and move forward.</span
      >
    </div>
    <div class="auth-form-wrap">
      <span class="eyebrow">{{ register ? 'YOUR NEXT CHAPTER' : 'GOOD TO SEE YOU AGAIN' }}</span>
      <h2>{{ register ? 'Let’s get you started.' : 'Welcome back.' }}</h2>
      <p>
        {{
          register
            ? 'Create your account. Keep your curiosity going.'
            : 'Your next small step is waiting for you.'
        }}
      </p>
      <form [formGroup]="form" (ngSubmit)="submit()" class="form-stack">
        @if (register) {
          <label
            >Full name<input
              formControlName="name"
              autocomplete="name"
              placeholder="Your full name"
            />
            @if (invalid('name')) {
              <small class="field-error">Enter your name (up to 150 characters).</small>
            }
          </label>
        }
        <label
          >Email address<input
            formControlName="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
          />
          @if (invalid('email')) {
            <small class="field-error">Enter a valid email address.</small>
          }
        </label>
        <label
          >Password<span class="password-input"
            ><input
              formControlName="password"
              [type]="showPassword() ? 'text' : 'password'"
              [autocomplete]="register ? 'new-password' : 'current-password'"
              placeholder="Your password"
            /><button
              type="button"
              [attr.aria-label]="showPassword() ? 'Hide password' : 'Show password'"
              (click)="showPassword.set(!showPassword())"
            >
              {{ showPassword() ? 'Hide' : 'Show' }}
            </button></span
          >
          @if (invalid('password')) {
            <small class="field-error">{{
              register
                ? 'Use 12–128 characters with uppercase, lowercase, a number, and a symbol.'
                : 'Enter your password.'
            }}</small>
          }
        </label>
        @if (register) {
          <label
            >Confirm password<input
              formControlName="confirmPassword"
              type="password"
              autocomplete="new-password"
              placeholder="One more time"
            />
            @if (form.touched && form.hasError('mismatch')) {
              <small class="field-error">Your passwords don’t match.</small>
            }
          </label>
          <p class="form-hint">
            Use at least 12 characters, including uppercase, lowercase, a number, and a symbol.
          </p>
        }
        @if (error()) {
          <div class="form-error" role="alert">{{ error() }}</div>
        }
        <button class="btn btn-primary btn-block btn-lg" [disabled]="busy()">
          {{ busy() ? 'Just a moment…' : register ? 'Create my account' : 'Log in'
          }}<app-icon name="arrow" />
        </button>
      </form>
      <p class="auth-switch">
        {{ register ? 'Already part of Learnwell?' : 'New around here?' }}
        <a
          [routerLink]="register ? '/login' : '/register'"
          [queryParams]="returnUrl ? { returnUrl } : {}"
          >{{ register ? 'Log in' : 'Create an account' }}</a
        >
      </p>
      <div class="auth-bottom-note">
        <app-icon name="lock" />Your learning journey, securely connected.
      </div>
    </div>
  </section>`,
})
export class AuthPage {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private auth = inject(AuthService);
  register = this.route.snapshot.data['register'] === true;
  returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
  busy = signal(false);
  error = signal('');
  showPassword = signal(false);
  form = this.fb.nonNullable.group(
    {
      name: ['', this.register ? [Validators.required, Validators.maxLength(150)] : []],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(256)]],
      password: [
        '',
        this.register
          ? [
              Validators.required,
              Validators.minLength(12),
              Validators.maxLength(128),
              Validators.pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).+$/),
            ]
          : [Validators.required],
      ],
      confirmPassword: ['', this.register ? [Validators.required] : []],
    },
    {
      validators: (control) =>
        this.register && control.get('password')?.value !== control.get('confirmPassword')?.value
          ? { mismatch: true }
          : null,
    },
  );
  invalid(field: string) {
    const c = this.form.get(field);
    return c?.invalid && c.touched;
  }
  async submit() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    const v = this.form.getRawValue();
    try {
      if (this.register) await this.auth.register(v.name, v.email, v.password);
      else await this.auth.login(v.email, v.password);
      const safe =
        this.returnUrl?.startsWith('/') && !this.returnUrl.startsWith('//')
          ? this.returnUrl
          : this.auth.home();
      await this.router.navigateByUrl(safe);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
