import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { QuizService } from '../../../core/services/quiz.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Quiz, QuizResult } from '../../../core/models/advanced';
import { emptyPage } from '../../../core/models/models';
import { CourseNav } from '../../../shared/components/course-nav';
import { EmptyComponent, ErrorComponent, SkeletonComponent } from '../../../shared/components/ui';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    MatPaginatorModule,
    CourseNav,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `<div class="breadcrumbs">
      <a [routerLink]="base + '/quizzes'">Quizzes</a><span>/</span
      >{{ student ? 'My attempts' : 'Student results' }}
    </div>
    <div class="page-heading">
      <span class="eyebrow">EVERY ATTEMPT TEACHES YOU SOMETHING</span>
      <h1>{{ quiz()?.title || 'Quiz results' }}</h1>
      <p>
        {{
          student
            ? 'Your saved attempt history and scores.'
            : 'See each learner’s results, timing, and pass status.'
        }}
      </p>
    </div>
    @if (quiz(); as q) {
      <app-course-nav [courseId]="q.courseId" />
    }
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else {
      <section class="panel table-panel">
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                @if (!student) {
                  <th>Learner</th>
                }
                <th>Started</th>
                <th>Marks</th>
                <th>Score</th>
                <th>Result</th>
                <th>Review</th>
              </tr>
            </thead>
            <tbody>
              @for (r of page().items; track r.attemptId) {
                <tr>
                  @if (!student) {
                    <td>{{ r.studentName }}</td>
                  }
                  <td>{{ r.startedAt | date: 'MMM d, h:mm a' }}</td>
                  <td>{{ r.score === null ? 'Pending' : r.score + ' / ' + r.maximumMarks }}</td>
                  <td>{{ r.submittedAt ? (r.percentage | number: '1.0-2') + '%' : '—' }}</td>
                  <td>
                    <span
                      class="pill"
                      [class.success]="r.isPassed"
                      [class.neutral]="!r.submittedAt"
                      >{{
                        !r.submittedAt
                          ? 'In progress'
                          : r.isExpired
                            ? 'Time expired'
                            : r.isPassed
                              ? 'Passed'
                              : 'Not passed'
                      }}</span
                    >
                  </td>
                  <td>
                    @if (r.submittedAt) {
                      <a
                        class="btn btn-small btn-secondary"
                        [routerLink]="[base + '/quiz-attempts', r.attemptId, 'result']"
                        >View result</a
                      >
                    } @else if (student) {
                      <a
                        class="btn btn-small btn-primary"
                        [routerLink]="['/student/quiz-attempts', r.attemptId]"
                        >Resume</a
                      >
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!page().items.length) {
          <app-empty
            title="A new opportunity awaits"
            message="Attempt history appears after a learner starts this quiz."
          />
        }
        <mat-paginator
          [length]="page().totalCount"
          [pageSize]="10"
          [pageIndex]="pageIndex"
          [hidePageSize]="true"
          (page)="paginate($event)"
          aria-label="Quiz attempt pages"
        />
      </section>
    }`,
})
export class QuizHistory {
  private api = inject(QuizService);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  student = inject(AuthService).user()?.role === 'Student';
  base = '/' + inject(AuthService).user()!.role.toLowerCase();
  quiz = signal<Quiz | null>(null);
  page = signal(emptyPage<QuizResult>());
  loading = signal(true);
  error = signal('');
  pageIndex = 0;
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      const [q, page] = await Promise.all([
        firstValueFrom(this.api.get(this.id)),
        firstValueFrom(this.api.results(this.id, { pageNumber: this.pageIndex + 1, pageSize: 10 })),
      ]);
      this.quiz.set(q);
      this.page.set(page);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  paginate(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    void this.load();
  }
}
