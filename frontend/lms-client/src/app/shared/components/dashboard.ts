import { Component, computed, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { DashboardService } from '../../core/services/dashboard.service';
import { ProgressService } from '../../core/services/progress.service';
import { Dashboard, LearningCourse } from '../../core/models/models';
import { IconComponent } from './icon';
import { EmptyComponent, ErrorComponent, SkeletonComponent } from './ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
@Component({
  selector: 'app-overview',
  imports: [
    RouterLink,
    DatePipe,
    MatProgressBarModule,
    BaseChartDirective,
    IconComponent,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `
    <div class="page-heading heading-with-action">
      <div>
        <span class="eyebrow">{{
          auth.user()?.role === 'Student'
            ? 'A LITTLE PROGRESS, EVERY DAY'
            : 'YOUR WORKSPACE AT A GLANCE'
        }}</span>
        <h1>Hello, {{ firstName() }}<span class="greeting-dot">.</span></h1>
        <p>
          {{
            auth.user()?.role === 'Student'
              ? 'Ready for your next small step? Let’s make it a good one.'
              : auth.user()?.role === 'Trainer'
                ? 'Share what you know. Help someone discover what’s next.'
                : 'Here’s how your learning community is growing.'
          }}
        </p>
      </div>
      <a
        [routerLink]="auth.user()?.role === 'Trainer' ? '/trainer/courses/new' : '/courses'"
        class="btn btn-primary"
        ><app-icon [name]="auth.user()?.role === 'Trainer' ? 'plus' : 'globe'" />{{
          auth.user()?.role === 'Trainer' ? 'Create a course' : 'Explore courses'
        }}</a
      >
    </div>
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else if (data(); as d) {
      <div class="stats-grid" [class.six]="auth.user()?.role === 'Admin'">
        @for (stat of stats(); track stat.label) {
          <div class="stat-card">
            <div class="stat-top">
              <span>{{ stat.label }}</span
              ><span class="stat-icon" [class]="'stat-icon ' + stat.tone"
                ><app-icon [name]="stat.icon"
              /></span>
            </div>
            <strong>{{ stat.value }}</strong
            ><small>{{ stat.caption }}</small>
          </div>
        }
      </div>
      @if (auth.user()?.role === 'Student') {
        <div class="learning-banner">
          <div>
            <span class="eyebrow">MAKE A LITTLE ROOM FOR YOURSELF</span>
            <h2>One lesson closer to<br />where you want to be.</h2>
            <p>Pick up where you left off. Your progress is right here.</p>
            @if (recent()[0]; as course) {
              <a [routerLink]="['/student/learn', course.courseId]" class="btn btn-white"
                >Continue learning <app-icon name="arrow"
              /></a>
            } @else {
              <a routerLink="/courses" class="btn btn-white"
                >Find your first course <app-icon name="arrow"
              /></a>
            }
          </div>
          <div class="banner-symbol"><app-icon name="book" /><span>✦</span></div>
        </div>
        <div class="section-heading compact">
          <div>
            <span class="eyebrow">KEEP YOUR MOMENTUM</span>
            <h2>Continue your journey</h2>
          </div>
          <a routerLink="/student/courses" class="text-link"
            >My learning <app-icon name="arrow"
          /></a>
        </div>
        <div class="learning-grid">
          @for (course of recent(); track course.courseId) {
            <a class="panel learning-card" [routerLink]="['/student/learn', course.courseId]"
              ><div class="learning-card-icon"><app-icon name="code" /></div>
              <span class="eyebrow">{{ course.category }}</span>
              <h3>{{ course.title }}</h3>
              <div class="progress-label">
                <span>{{ course.completedLessons }} / {{ course.totalLessons }} lessons</span
                ><strong>{{ course.percentage }}%</strong>
              </div>
              <mat-progress-bar mode="determinate" [value]="course.percentage" />
              <div class="learning-card-bottom">
                {{ course.percentage === 100 ? 'Review course' : 'Continue learning'
                }}<app-icon name="arrow" /></div
            ></a>
          } @empty {
            <app-empty
              title="Your journey is waiting"
              message="Find a course that sparks your curiosity."
              ><a routerLink="/courses" class="btn btn-primary">Explore courses</a></app-empty
            >
          }
        </div>
      }
      <div class="analytics-grid">
        <section class="panel chart-panel">
          <div class="panel-title">
            <div>
              <h2>
                {{
                  auth.user()?.role === 'Student' ? 'Your learning activity' : 'Enrollment activity'
                }}
              </h2>
              <p>Course enrollments over the last six months</p>
            </div>
            <span class="pill neutral">6 months</span>
          </div>
          <div class="chart-wrap">
            <canvas
              baseChart
              [data]="chartData()"
              [options]="chartOptions"
              type="bar"
              aria-label="Monthly course enrollments"
              role="img"
            ></canvas>
          </div>
        </section>
        <section class="panel activity-panel">
          <div class="panel-title">
            <div>
              <h2>Recent enrollments</h2>
              <p>Small steps worth celebrating</p>
            </div>
            <app-icon name="clock" />
          </div>
          @for (activity of d.recentActivities; track $index) {
            <div class="activity-row">
              <span class="activity-icon"><app-icon name="book" /></span>
              <div>
                <strong>{{ activity.description }}</strong
                ><small>{{ activity.title }} · {{ activity.occurredAt | date: 'MMM d, y' }}</small>
              </div>
            </div>
          } @empty {
            <app-empty title="A fresh start" message="New course enrollments will appear here." />
          }
        </section>
      </div>
    }
  `,
})
export class DashboardComponent {
  auth = inject(AuthService);
  private api = inject(DashboardService);
  private progress = inject(ProgressService);
  data = signal<Dashboard | null>(null);
  recent = signal<LearningCourse[]>([]);
  loading = signal(true);
  error = signal('');
  firstName = computed(() => this.auth.user()?.name.split(' ')[0] || 'there');
  chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { grid: { display: false } },
      y: { beginAtZero: true, ticks: { precision: 0 }, grid: { color: '#f0f1f6' } },
    },
  };
  chartData = computed<ChartData<'bar'>>(() => ({
    labels: this.data()?.chart.map((c) => c.label) || [],
    datasets: [
      {
        data: this.data()?.chart.map((c) => c.value) || [],
        backgroundColor: '#5360eb',
        hoverBackgroundColor: '#3542ce',
        borderRadius: 6,
        maxBarThickness: 30,
      },
    ],
  }));
  stats = computed(() => {
    const d = this.data();
    if (!d) return [];
    const role = this.auth.user()?.role;
    if (role === 'Admin')
      return [
        {
          label: 'Total users',
          value: d.totalUsers,
          caption: 'Your learning community',
          icon: 'users',
          tone: 'blue',
        },
        {
          label: 'Trainers',
          value: d.totalTrainers,
          caption: 'Sharing their knowledge',
          icon: 'shield',
          tone: 'purple',
        },
        {
          label: 'Students',
          value: d.totalStudents,
          caption: 'Building their potential',
          icon: 'book',
          tone: 'green',
        },
        {
          label: 'Courses',
          value: d.totalCourses,
          caption: 'Across the platform',
          icon: 'grid',
          tone: 'orange',
        },
        {
          label: 'Enrollments',
          value: d.totalEnrollments,
          caption: 'New chapters started',
          icon: 'chart',
          tone: 'blue',
        },
        {
          label: 'Published courses',
          value: d.publishedCourses,
          caption: 'Ready to explore',
          icon: 'globe',
          tone: 'purple',
        },
      ];
    if (role === 'Trainer')
      return [
        {
          label: 'My courses',
          value: d.totalCourses,
          caption: 'Ideas brought to life',
          icon: 'book',
          tone: 'blue',
        },
        {
          label: 'Published courses',
          value: d.publishedCourses,
          caption: 'Ready for your learners',
          icon: 'globe',
          tone: 'purple',
        },
        {
          label: 'Students',
          value: d.totalStudents,
          caption: 'Unique enrolled learners',
          icon: 'users',
          tone: 'green',
        },
        {
          label: 'Enrollments',
          value: d.totalEnrollments,
          caption: 'Across your courses',
          icon: 'chart',
          tone: 'orange',
        },
      ];
    return [
      {
        label: 'Enrolled courses',
        value: d.totalEnrollments,
        caption: 'New possibilities ahead',
        icon: 'book',
        tone: 'blue',
      },
      {
        label: 'Lessons completed',
        value: d.completedLessons,
        caption: 'Every small step counts',
        icon: 'check',
        tone: 'green',
      },
      {
        label: 'Learning paths',
        value: d.totalCourses,
        caption: 'Yours to explore',
        icon: 'chart',
        tone: 'purple',
      },
    ];
  });
  constructor() {
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.data.set(await firstValueFrom(this.api.get()));
      if (this.auth.user()?.role === 'Student')
        this.recent.set((await firstValueFrom(this.progress.mine({ pageSize: 4 }))).items);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
