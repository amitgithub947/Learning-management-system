import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CertificateService } from '../../../core/services/certificate.service';
import { Certificate } from '../../../core/models/advanced';
import { IconComponent } from '../../../shared/components/icon';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [ReactiveFormsModule, DatePipe, IconComponent],
  template: `<section class="container section verification-page">
    <div class="verification-heading">
      <span class="icon-tile"><app-icon name="shield" /></span
      ><span class="eyebrow">AN ACHIEVEMENT YOU CAN TRUST</span>
      <h1>Verify a certificate.</h1>
      <p>
        Enter the verification code printed on a Learnwell certificate to confirm its authenticity.
      </p>
    </div>
    <form [formGroup]="form" (ngSubmit)="verify()" class="verification-form">
      <label class="sr-only" for="verification-code">Verification code</label
      ><input
        id="verification-code"
        formControlName="code"
        placeholder="32-character verification code"
        maxlength="32"
        autocomplete="off"
      /><button class="btn btn-primary" [disabled]="busy()">
        {{ busy() ? 'Verifying…' : 'Verify certificate' }}<app-icon name="arrow" />
      </button>
    </form>
    @if (form.touched && form.invalid) {
      <div class="form-error">
        Enter the 32-character hexadecimal verification code from the certificate.
      </div>
    }
    @if (error()) {
      <div class="form-error" role="alert">{{ error() }}</div>
    }
    @if (certificate(); as c) {
      <article class="panel verified-certificate">
        <div class="verified-heading">
          <span class="success-icon"><app-icon name="check" /></span>
          <div>
            <span class="eyebrow">VERIFIED ACHIEVEMENT</span>
            <h2>This certificate is authentic.</h2>
          </div>
        </div>
        <h3>{{ c.courseTitle }}</h3>
        <p>
          This achievement belongs to <strong>{{ c.studentName }}</strong
          >.
        </p>
        <dl>
          <dt>Course trainer</dt>
          <dd>{{ c.trainerName }}</dd>
          <dt>Completion date</dt>
          <dd>{{ c.completedAt | date: 'longDate' }}</dd>
          <dt>Issued</dt>
          <dd>{{ c.issuedAt | date: 'longDate' }}</dd>
          <dt>Certificate number</dt>
          <dd>{{ c.certificateNumber }}</dd>
          <dt>Verification code</dt>
          <dd class="verification-code">{{ c.verificationCode }}</dd>
        </dl>
      </article>
    }
  </section>`,
})
export class CertificateVerification {
  private api = inject(CertificateService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  form = inject(FormBuilder).nonNullable.group({
    code: [
      this.route.snapshot.paramMap.get('code') || '',
      [Validators.required, Validators.pattern(/^[a-fA-F0-9]{32}$/)],
    ],
  });
  certificate = signal<Certificate | null>(null);
  busy = signal(false);
  error = signal('');
  constructor() {
    if (this.form.controls.code.value) void this.verify();
  }
  async verify() {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.busy()) return;
    this.busy.set(true);
    this.error.set('');
    this.certificate.set(null);
    try {
      const c = await firstValueFrom(this.api.verify(this.form.controls.code.value.trim()));
      this.certificate.set(c);
      void this.router.navigate(['/certificates/verify', c.verificationCode], { replaceUrl: true });
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
