import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartData, ChartOptions } from 'chart.js';
import { firstValueFrom } from 'rxjs';
import { ProgressService } from '../../core/services/progress.service';
import { LearningCourse, emptyPage } from '../../core/models/models';
import { IconComponent } from '../../shared/components/icon';
import { EmptyComponent, ErrorComponent, SkeletonComponent } from '../../shared/components/ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
@Component({
  imports: [
    FormsModule,
    RouterLink,
    MatPaginatorModule,
    MatProgressBarModule,
    BaseChartDirective,
    IconComponent,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `<div class="page-heading heading-with-action">
      <div>
        <span class="eyebrow">{{
          progressView ? 'SMALL WINS ADD UP' : 'YOUR NEXT CHAPTER IS HERE'
        }}</span>
        <h1>{{ progressView ? 'Look how far you’ve come.' : 'My learning' }}</h1>
        <p>
          {{
            progressView
              ? 'Every completed lesson is a step in the right direction.'
              : 'Pick up where you left off, or start something new.'
          }}
        </p>
      </div>
      <a routerLink="/courses" class="btn btn-primary">Explore courses <app-icon name="arrow" /></a>
    </div>
    @if (loading()) {
      <app-skeleton />
    } @else if (error()) {
      <app-error [message]="error()" (retry)="load()" />
    } @else {
      @if (progressView && page().items.length) {
        <section class="panel progress-chart-panel">
          <div class="panel-title">
            <div>
              <h2>Your progress, course by course</h2>
              <p>Based on your saved lesson completions · courses on this page</p>
            </div>
            <app-icon name="chart" />
          </div>
          <div class="chart-wrap">
            <canvas
              baseChart
              [data]="chartData()"
              [options]="options"
              type="bar"
              aria-label="Completion percentage by course"
              role="img"
            ></canvas>
          </div>
        </section>
      }
      <form class="search-field learning-search" (ngSubmit)="searchCourses()">
        <app-icon name="search" /><input
          aria-label="Search enrolled courses"
          name="search"
          [(ngModel)]="search"
          placeholder="Find a course in your learning library"
        /><button class="icon-button" aria-label="Search your learning">
          <app-icon name="arrow" />
        </button>
      </form>
      <div class="learning-grid">
        @for (course of page().items; track course.courseId) {
          <article class="panel learning-card">
            <div class="learning-card-icon"><app-icon name="code" /></div>
            <span class="eyebrow">{{ course.category }}</span>
            <h3>{{ course.title }}</h3>
            <div class="progress-label">
              <span>{{ course.completedLessons }} of {{ course.totalLessons }} lessons</span
              ><strong>{{ course.percentage }}%</strong>
            </div>
            <mat-progress-bar mode="determinate" [value]="course.percentage" /><a
              [routerLink]="['/student/learn', course.courseId]"
              class="learning-card-bottom"
              >{{ course.percentage === 100 ? 'Review your course' : 'Continue learning'
              }}<app-icon name="arrow"
            /></a>
            <a class="learning-card-bottom" [routerLink]="['/student/progress', course.courseId]"
              >Requirements & certificate <app-icon name="trophy"
            /></a>
          </article>
        } @empty {
          <app-empty
            title="A little curiosity goes a long way"
            message="Your enrolled courses will appear here. Find something you’d love to learn."
            ><a class="btn btn-primary" routerLink="/courses">Find your next course</a></app-empty
          >
        }
      </div>
    }
    <mat-paginator
      [length]="page().totalCount"
      [pageSize]="9"
      [pageIndex]="pageIndex"
      [hidePageSize]="true"
      (page)="paginate($event)"
      aria-label="My learning pages"
    />`,
})
export class MyLearning {
  private api = inject(ProgressService);
  progressView = inject(ActivatedRoute).snapshot.data['progress'] === true;
  page = signal(emptyPage<LearningCourse>());
  loading = signal(true);
  error = signal('');
  search = '';
  pageIndex = 0;
  options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: { legend: { display: false } },
    scales: {
      x: {
        min: 0,
        max: 100,
        ticks: { callback: (value) => `${value}%` },
        grid: { color: '#f0f1f6' },
      },
      y: { grid: { display: false } },
    },
  };
  chartData = computed<ChartData<'bar'>>(() => ({
    labels: this.page().items.map((c) => c.title),
    datasets: [
      {
        data: this.page().items.map((c) => c.percentage),
        backgroundColor: '#5360eb',
        borderRadius: 6,
        maxBarThickness: 25,
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
      this.page.set(
        await firstValueFrom(
          this.api.mine({ pageNumber: this.pageIndex + 1, pageSize: 9, search: this.search }),
        ),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  searchCourses() {
    this.pageIndex = 0;
    void this.load();
  }
  paginate(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    void this.load();
  }
}
