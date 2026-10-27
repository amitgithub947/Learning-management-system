import { Component, computed, inject, signal } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { firstValueFrom } from 'rxjs';
import { CompletionService } from '../../../core/services/completion.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Analytics } from '../../../core/models/advanced';
import { IconComponent } from '../../../shared/components/icon';
import { ErrorComponent, SkeletonComponent } from '../../../shared/components/ui';
import { errorMessage } from '../../../core/interceptors/error.interceptor';
@Component({
  imports: [
    DecimalPipe,
    RouterLink,
    BaseChartDirective,
    IconComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `<div class="page-heading">
      <span class="eyebrow">SEE THE DIFFERENCE LEARNING MAKES</span>
      <h1>{{ admin ? 'Platform analytics' : 'Learning analytics' }}</h1>
      <p>
        {{
          admin
            ? 'Course completion, learner outcomes, and trainer performance across the platform.'
            : 'A clear picture of progress and performance across your courses.'
        }}
      </p>
    </div>
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else if (data(); as a) {
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-top"><span>Courses</span><app-icon name="book" /></div>
          <strong>{{ a.totalCourses }}</strong
          ><small>{{ admin ? a.totalUsers + ' total users' : 'Your course portfolio' }}</small>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span>Enrollments</span><app-icon name="users" /></div>
          <strong>{{ a.totalEnrollments }}</strong
          ><small>Across these courses</small>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span>Completed enrollments</span><app-icon name="trophy" /></div>
          <strong>{{ a.completedStudents }}</strong
          ><small>All requirements satisfied</small>
        </div>
        <div class="stat-card">
          <div class="stat-top"><span>Average completion</span><app-icon name="chart" /></div>
          <strong>{{ a.averageCompletionPercentage | number: '1.0-1' }}%</strong
          ><small>Lesson completion per enrollment</small>
        </div>
      </div>
      <div class="performance-strip">
        <span
          >Assignment performance
          <strong>{{
            a.averageAssignmentPercentage === null
              ? 'No grades yet'
              : (a.averageAssignmentPercentage | number: '1.0-1') + '%'
          }}</strong></span
        ><span
          >Quiz pass rate
          <strong>{{
            a.quizPassRate === null
              ? 'No submitted attempts'
              : (a.quizPassRate | number: '1.0-1') + '%'
          }}</strong></span
        >
      </div>
      <section class="panel progress-chart-panel">
        <div class="panel-title">
          <div>
            <h2>Average lesson completion</h2>
            <p>Per-course percentages from saved lesson records</p>
          </div>
        </div>
        <div class="chart-wrap">
          <canvas
            baseChart
            [data]="chart()"
            [options]="options"
            type="bar"
            aria-label="Average course completion percentages"
            role="img"
          ></canvas>
        </div>
      </section>
      <section class="panel table-panel">
        <div class="panel-title padded">
          <div>
            <h2>Course outcomes</h2>
            <p>Performance from actual grades, attempts, and completion records</p>
          </div>
        </div>
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Enrolled</th>
                <th>Completed</th>
                <th>Avg. progress</th>
                <th>Assignment marks</th>
                <th>Quiz pass rate</th>
                <th>Manage</th>
              </tr>
            </thead>
            <tbody>
              @for (c of a.courses; track c.courseId) {
                <tr>
                  <td>
                    <strong>{{ c.title }}</strong>
                  </td>
                  <td>{{ c.enrolledStudents }}</td>
                  <td>{{ c.completedStudents }}</td>
                  <td>{{ c.averageCompletionPercentage | number: '1.0-1' }}%</td>
                  <td>
                    {{
                      c.averageAssignmentPercentage === null
                        ? '—'
                        : (c.averageAssignmentPercentage | number: '1.0-1') + '%'
                    }}
                  </td>
                  <td>
                    {{ c.quizPassRate === null ? '—' : (c.quizPassRate | number: '1.0-1') + '%' }}
                  </td>
                  <td>
                    <div class="table-actions">
                      <a
                        class="btn btn-small btn-secondary"
                        [routerLink]="[base + '/courses', c.courseId, 'students']"
                        >Students</a
                      ><a
                        class="btn btn-small btn-secondary"
                        [routerLink]="[base + '/courses', c.courseId, 'completion']"
                        >Rules</a
                      >
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="7">No courses yet.</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </section>
      @if (admin) {
        <section class="panel table-panel trainer-performance">
          <div class="panel-title padded">
            <div>
              <h2>Trainer performance</h2>
              <p>Course portfolios and completed learner enrollments</p>
            </div>
          </div>
          <div class="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Trainer</th>
                  <th>Courses</th>
                  <th>Enrollments</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                @for (t of a.trainers; track t.trainerId) {
                  <tr>
                    <td>{{ t.name }}</td>
                    <td>{{ t.courses }}</td>
                    <td>{{ t.enrollments }}</td>
                    <td>{{ t.completedStudents }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </section>
      }
    }`,
})
export class TrainerAnalytics {
  private api = inject(CompletionService);
  admin = inject(AuthService).user()?.role === 'Admin';
  base = '/' + inject(AuthService).user()!.role.toLowerCase();
  data = signal<Analytics | null>(null);
  loading = signal(true);
  error = signal('');
  options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      y: { min: 0, max: 100, ticks: { callback: (value) => value + '%' } },
      x: { grid: { display: false } },
    },
  };
  chart = computed<ChartData<'bar'>>(() => ({
    labels: this.data()?.courses.map((c) => c.title) || [],
    datasets: [
      {
        data: this.data()?.courses.map((c) => c.averageCompletionPercentage) || [],
        backgroundColor: '#6672e7',
        borderRadius: 6,
        maxBarThickness: 35,
      },
    ],
  }));
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(await firstValueFrom(this.api.analytics()));
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
