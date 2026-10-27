import { Component, inject, signal } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CompletionService } from '../../../core/services/completion.service';
import { CertificateService } from '../../../core/services/certificate.service';
import { Completion } from '../../../core/models/advanced';
import { CourseNav } from '../../../shared/components/course-nav';
import { ProgressRing } from '../../../shared/components/progress-ring';
import { IconComponent } from '../../../shared/components/icon';
import { ErrorComponent, SkeletonComponent, uiHelpers } from '../../../shared/components/ui';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [
    DatePipe,
    DecimalPipe,
    RouterLink,
    CourseNav,
    ProgressRing,
    IconComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `<div class="breadcrumbs">
      <a routerLink="/student/progress">My progress</a><span>/</span>Course requirements
    </div>
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else if (progress(); as p) {
      <div class="page-heading">
        <span class="eyebrow">EVERY STEP HAS BROUGHT YOU HERE</span>
        <h1>{{ p.courseTitle }}</h1>
        <p>A complete picture of your lessons, assignments, and quizzes.</p>
      </div>
      <app-course-nav [courseId]="p.courseId" />
      <section class="panel completion-overview">
        <app-progress-ring [value]="p.percentage" />
        <div>
          <span class="pill" [class.success]="p.status === 'Completed'">{{
            p.status === 'Completed' ? 'Course completed' : 'Learning in progress'
          }}</span>
          <h2>
            {{ p.isEligible ? 'You’ve earned this moment.' : 'A little closer with every step.' }}
          </h2>
          <p>
            {{ p.completedLessons }} of {{ p.totalLessons }} lessons complete ·
            {{ p.remainingLessons }} remaining
          </p>
          @if (p.completedAt) {
            <p>Completed {{ p.completedAt | date: 'longDate' }}</p>
          }
          <div class="quiz-actions">
            <a [routerLink]="['/student/learn', p.courseId]" class="btn btn-secondary"
              >Continue learning</a
            >
            @if (p.certificateId) {
              <a routerLink="/student/certificates" class="btn btn-primary"
                >View certificate <app-icon name="trophy"
              /></a>
            } @else if (p.isEligible) {
              <button class="btn btn-primary" [disabled]="busy()" (click)="issue()">
                {{ busy() ? 'Issuing…' : 'Get my certificate' }}<app-icon name="trophy" />
              </button>
            }
          </div>
        </div>
      </section>
      @if (p.unmetRequirements.length) {
        <section class="panel requirements-panel">
          <h2>Your next steps</h2>
          <ul>
            @for (requirement of p.unmetRequirements; track requirement) {
              <li><app-icon name="chevron" />{{ requirement }}</li>
            }
          </ul>
        </section>
      } @else {
        <div class="info-banner success-banner">
          <app-icon name="check" />All configured course requirements are satisfied. Completion is
          recorded on the server.
        </div>
      }
      <div class="assessment-summary-grid">
        <section class="panel table-panel">
          <div class="panel-title padded">
            <div>
              <h2>Assignment performance</h2>
              <p>
                {{
                  p.settings.requireAssignments
                    ? 'Required assignments contribute to completion.'
                    : 'Assignments are not required by this course’s completion settings.'
                }}
              </p>
            </div>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Assignment</th>
                  <th>Marks</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                @for (a of p.assignments; track a.assignmentId) {
                  <tr>
                    <td>
                      <a [routerLink]="['/student/assignments', a.assignmentId]">{{ a.title }}</a
                      ><small class="table-secondary"
                        >{{ a.isRequired ? 'Required' : 'Optional' }} · {{ a.passingPercentage }}%
                        to pass</small
                      >
                    </td>
                    <td>{{ a.marks === null ? 'Pending' : a.marks + ' / ' + a.maximumMarks }}</td>
                    <td>
                      <span class="pill" [class.success]="a.isPassed" [class.neutral]="!a.status">{{
                        a.isPassed ? 'Passed' : a.status || 'Not submitted'
                      }}</span>
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3">No assignments in this course.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
        <section class="panel table-panel">
          <div class="panel-title padded">
            <div>
              <h2>Quiz performance</h2>
              <p>
                {{
                  p.settings.requireQuizzes
                    ? 'Required quizzes must be passed.'
                    : 'Quizzes are not required by this course’s completion settings.'
                }}
              </p>
            </div>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Quiz</th>
                  <th>Best score</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                @for (q of p.quizzes; track q.quizId) {
                  <tr>
                    <td>
                      <a [routerLink]="['/student/quizzes', q.quizId, 'history']">{{ q.title }}</a
                      ><small class="table-secondary"
                        >{{ q.isRequired ? 'Required' : 'Optional' }} ·
                        {{ q.attempts }} attempts</small
                      >
                    </td>
                    <td>
                      {{
                        q.bestPercentage === null ? '—' : (q.bestPercentage | number: '1.0-2') + '%'
                      }}
                    </td>
                    <td>
                      <span
                        class="pill"
                        [class.success]="q.isPassed"
                        [class.neutral]="!q.attempts"
                        >{{
                          q.isPassed ? 'Passed' : q.attempts ? 'Not passed' : 'Not attempted'
                        }}</span
                      >
                    </td>
                  </tr>
                } @empty {
                  <tr>
                    <td colspan="3">No quizzes in this course.</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      </div>
    }`,
})
export class StudentProgressPage {
  private api = inject(CompletionService);
  private certificates = inject(CertificateService);
  private router = inject(Router);
  private ui = uiHelpers();
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  progress = signal<Completion | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.progress.set(await firstValueFrom(this.api.summary(this.id)));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async issue() {
    if (this.busy()) return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.certificates.issue(this.id));
      this.ui.toast('Your achievement is official. Certificate issued.');
      await this.router.navigateByUrl('/student/certificates');
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
