import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { CertificateService } from '../../../core/services/certificate.service';
import { Certificate } from '../../../core/models/advanced';
import { emptyPage } from '../../../core/models/models';
import { IconComponent } from '../../../shared/components/icon';
import {
  EmptyComponent,
  ErrorComponent,
  SkeletonComponent,
  uiHelpers,
} from '../../../shared/components/ui';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [
    FormsModule,
    DatePipe,
    RouterLink,
    MatPaginatorModule,
    IconComponent,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `<div class="page-heading heading-with-action">
      <div>
        <span class="eyebrow">YOU PUT IN THE WORK. MAKE IT OFFICIAL.</span>
        <h1>My certificates</h1>
        <p>A lasting record of the courses you’ve completed.</p>
      </div>
      <a routerLink="/student/progress" class="btn btn-secondary"
        >View course requirements <app-icon name="arrow"
      /></a>
    </div>
    <form class="search-field learning-search" (ngSubmit)="searchRows()">
      <app-icon name="search" /><input
        name="search"
        [(ngModel)]="search"
        placeholder="Search your certificates"
        aria-label="Search certificates"
      /><button class="icon-button" aria-label="Search certificates">
        <app-icon name="arrow" />
      </button>
    </form>
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else {
      <div class="certificate-grid">
        @for (c of page().items; track c.certificateId) {
          <article class="panel certificate-card">
            <div class="certificate-graphic"><app-icon name="trophy" /><span>✦</span></div>
            <span class="eyebrow">CERTIFICATE OF COMPLETION</span>
            <h2>{{ c.courseTitle }}</h2>
            <p>
              Awarded to <strong>{{ c.studentName }}</strong>
            </p>
            <dl>
              <dt>Completed</dt>
              <dd>{{ c.completedAt | date: 'longDate' }}</dd>
              <dt>Course trainer</dt>
              <dd>{{ c.trainerName }}</dd>
              <dt>Certificate number</dt>
              <dd>{{ c.certificateNumber }}</dd>
            </dl>
            <div class="quiz-actions">
              <button
                class="btn btn-primary"
                (click)="download(c)"
                [disabled]="downloading() === c.certificateId"
              >
                {{ downloading() === c.certificateId ? 'Preparing…' : 'Download PDF'
                }}<app-icon name="arrow" /></button
              ><a
                class="btn btn-secondary"
                [routerLink]="['/certificates/verify', c.verificationCode]"
                >Verify</a
              >
            </div>
          </article>
        } @empty {
          <app-empty
            title="Your next achievement is ahead of you"
            message="Complete a course’s required lessons, assignments, and quizzes, then request your certificate from its progress page."
            ><a routerLink="/student/progress" class="btn btn-primary"
              >View my progress</a
            ></app-empty
          >
        }
      </div>
    }
    <mat-paginator
      [length]="page().totalCount"
      [pageSize]="6"
      [pageIndex]="pageIndex"
      [hidePageSize]="true"
      (page)="paginate($event)"
      aria-label="Certificate pages"
    />`,
})
export class CertificateList {
  private api = inject(CertificateService);
  private ui = uiHelpers();
  page = signal(emptyPage<Certificate>());
  loading = signal(true);
  error = signal('');
  downloading = signal('');
  search = '';
  pageIndex = 0;
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(
        await firstValueFrom(
          this.api.mine({ search: this.search, pageNumber: this.pageIndex + 1, pageSize: 6 }),
        ),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  searchRows() {
    this.pageIndex = 0;
    void this.load();
  }
  paginate(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    void this.load();
  }
  async download(c: Certificate) {
    if (this.downloading()) return;
    this.downloading.set(c.certificateId);
    try {
      const blob = await firstValueFrom(this.api.download(c.certificateId));
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = c.certificateNumber + '.pdf';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      this.ui.toast('Your certificate is ready.');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.downloading.set('');
    }
  }
}
