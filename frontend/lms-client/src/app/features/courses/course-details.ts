import { Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { CourseService } from '../../core/services/course.service';
import { EnrollmentService } from '../../core/services/enrollment.service';
import { ProgressService } from '../../core/services/progress.service';
import { CourseOverview, CourseProgress } from '../../core/models/models';
import { errorMessage } from '../../core/interceptors/error.interceptor';
import { IconComponent } from '../../shared/components/icon';
import { ErrorComponent, SkeletonComponent, uiHelpers } from '../../shared/components/ui';
import { InitialsPipe } from '../../shared/pipes/initials.pipe';
@Component({
  imports: [
    RouterLink,
    MatProgressBarModule,
    IconComponent,
    ErrorComponent,
    SkeletonComponent,
    InitialsPipe,
  ],
  template: `<section class="section container">
    <div class="breadcrumbs">
      <a routerLink="/courses">Explore courses</a><span>/</span> Course overview
    </div>
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else if (overview(); as detail) {
      <div class="course-detail-grid">
        <div>
          <div class="detail-heading">
            <span class="pill">{{ detail.course.category }}</span>
            <h1>{{ detail.course.title }}</h1>
            <p>{{ detail.course.description }}</p>
            <div class="trainer-line">
              <span class="avatar">{{ detail.trainerName | initials }}</span>
              <div>
                <small>YOUR TRAINER</small><strong>{{ detail.trainerName }}</strong>
              </div>
              <span class="detail-separator"></span
              ><span><app-icon name="users" />{{ detail.enrollmentCount }} enrolled</span>
            </div>
          </div>
          <div class="panel detail-content">
            <span class="eyebrow">A LITTLE CLOSER TO YOUR GOALS</span>
            <h2>About this course</h2>
            <p class="preserve-lines">{{ detail.course.description }}</p>
            <div class="course-features">
              <span><app-icon name="clock" />Learn at your own pace</span
              ><span><app-icon name="chart" />Keep track of your progress</span>
            </div>
            <h2>What’s inside</h2>
            <p>{{ detail.lessons.length }} lessons · {{ duration() }} minutes of learning</p>
            <div class="lesson-outline">
              @for (lesson of detail.lessons; track lesson.lessonId) {
                <div>
                  <span class="lesson-number">{{
                    lesson.sequenceNumber.toString().padStart(2, '0')
                  }}</span
                  ><strong>{{ lesson.title }}</strong
                  ><span>{{ lesson.durationMinutes }} min</span
                  ><app-icon [name]="progress() ? 'play' : 'lock'" />
                </div>
              } @empty {
                <p>The trainer is preparing the first lessons.</p>
              }
            </div>
          </div>
        </div>
        <aside class="enroll-panel panel">
          <div class="course-art detail-art">
            <span class="art-grid"></span><span class="art-orbit"></span
            ><app-icon name="book" /><span class="art-label">Learn something that lasts.</span>
          </div>
          <div class="enroll-body">
            <span class="eyebrow">INVEST IN YOUR POSSIBILITIES</span>
            <h2>Your next step starts here.</h2>
            <p>Make room for a little learning, whenever it works for you.</p>
            @if (progress(); as p) {
              <div class="progress-label">
                <strong>Your progress</strong><span>{{ p.percentage }}%</span>
              </div>
              <mat-progress-bar mode="determinate" [value]="p.percentage" />
              <p class="muted small">
                {{ p.completedLessons }} of {{ p.totalLessons }} lessons complete
              </p>
              <a
                [routerLink]="['/student/learn', detail.course.courseId]"
                class="btn btn-primary btn-block"
                >Continue learning <app-icon name="arrow"
              /></a>
            } @else if (auth.user()?.role === 'Student') {
              <button class="btn btn-primary btn-block" [disabled]="busy()" (click)="enroll()">
                {{ busy() ? 'Enrolling…' : 'Enroll in this course' }}<app-icon name="arrow" />
              </button>
            } @else if (!auth.user()) {
              <a
                routerLink="/login"
                [queryParams]="{ returnUrl: '/courses/' + detail.course.courseId }"
                class="btn btn-primary btn-block"
                >Sign in to enroll <app-icon name="arrow"
              /></a>
            } @else {
              <a [routerLink]="auth.home()" class="btn btn-primary btn-block"
                >Go to your workspace <app-icon name="arrow"
              /></a>
            }
            <ul class="enroll-benefits">
              <li><app-icon name="check" />{{ detail.lessons.length }} focused lessons</li>
              <li><app-icon name="check" />{{ duration() }} minutes of course content</li>
              <li><app-icon name="check" />Progress saved as you learn</li>
              <li><app-icon name="check" />Learn on desktop, tablet, or mobile</li>
            </ul>
          </div>
        </aside>
      </div>
    }
  </section>`,
})
export class CourseDetails {
  private courses = inject(CourseService);
  private enrollments = inject(EnrollmentService);
  private progressApi = inject(ProgressService);
  private router = inject(Router);
  private ui = uiHelpers();
  auth = inject(AuthService);
  private id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  overview = signal<CourseOverview | null>(null);
  progress = signal<CourseProgress | null>(null);
  loading = signal(true);
  busy = signal(false);
  error = signal('');
  duration = computed(
    () => this.overview()?.lessons.reduce((sum, l) => sum + l.durationMinutes, 0) || 0,
  );
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.overview.set(await firstValueFrom(this.courses.overview(this.id)));
      if (this.auth.user()?.role === 'Student') {
        if (this.overview()?.isEnrolled)
          this.progress.set(await firstValueFrom(this.progressApi.course(this.id)));
      }
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  async enroll() {
    this.busy.set(true);
    try {
      await firstValueFrom(this.enrollments.enroll(this.id));
      this.ui.toast('You’re enrolled. Your next chapter starts now.');
      await this.router.navigate(['/student/learn', this.id]);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
