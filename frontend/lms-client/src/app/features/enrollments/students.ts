import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { firstValueFrom } from 'rxjs';
import { ProgressService } from '../../core/services/progress.service';
import { CourseService } from '../../core/services/course.service';
import { AuthService } from '../../core/auth/auth.service';
import { StudentProgress, emptyPage } from '../../core/models/models';
import { InitialsPipe } from '../../shared/pipes/initials.pipe';
import { IconComponent } from '../../shared/components/icon';
import { EmptyComponent, ErrorComponent, SkeletonComponent } from '../../shared/components/ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
@Component({
  imports: [
    DatePipe,
    FormsModule,
    RouterLink,
    MatPaginatorModule,
    MatProgressBarModule,
    InitialsPipe,
    IconComponent,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: `<div class="breadcrumbs">
      <a [routerLink]="base">Courses</a><span>/</span>Enrolled students
    </div>
    <div class="page-heading">
      <span class="eyebrow">PROGRESS, ONE PERSON AT A TIME</span>
      <h1>{{ title() }}</h1>
      <p>A clear view of your learners and the steps they’re taking.</p>
    </div>
    <section class="panel table-panel">
      <div class="table-toolbar">
        <form class="search-field" (ngSubmit)="searchStudents()">
          <app-icon name="search" /><input
            aria-label="Search students"
            placeholder="Search students by name or email"
            name="search"
            [(ngModel)]="search"
          /><button class="icon-button" aria-label="Run student search">
            <app-icon name="arrow" />
          </button>
        </form>
        <span class="muted">{{ page().totalCount }} enrolled students</span>
      </div>
      @if (loading()) {
        <app-skeleton />
      } @else if (error()) {
        <app-error [message]="error()" (retry)="load()" />
      } @else {
        <div class="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>Enrolled</th>
                <th>Completed lessons</th>
                <th>Course progress</th>
              </tr>
            </thead>
            <tbody>
              @for (student of page().items; track student.studentId) {
                <tr>
                  <td>
                    <div class="table-person">
                      <span class="avatar">{{ student.name | initials }}</span>
                      <div>
                        <strong>{{ student.name }}</strong
                        ><small>{{ student.email }}</small>
                      </div>
                    </div>
                  </td>
                  <td>{{ student.enrollmentDate | date: 'MMM d, y' }}</td>
                  <td>{{ student.completedLessons }} / {{ student.totalLessons }}</td>
                  <td>
                    <div class="table-progress">
                      <mat-progress-bar mode="determinate" [value]="student.percentage" /><strong
                        >{{ student.percentage }}%</strong
                      >
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!page().items.length) {
          <app-empty
            title="Your next learner is out there"
            message="Enrolled students and their saved progress will appear here."
          />
        }
      }
      <mat-paginator
        [length]="page().totalCount"
        [pageSize]="10"
        [pageIndex]="pageIndex"
        [hidePageSize]="true"
        (page)="paginate($event)"
        aria-label="Enrolled student pages"
      />
    </section>`,
})
export class EnrolledStudents {
  private progress = inject(ProgressService);
  private courses = inject(CourseService);
  id = inject(ActivatedRoute).snapshot.paramMap.get('id')!;
  base = inject(AuthService).user()?.role === 'Admin' ? '/admin/courses' : '/trainer/courses';
  title = signal('Enrolled students');
  page = signal(emptyPage<StudentProgress>());
  loading = signal(true);
  error = signal('');
  search = '';
  pageIndex = 0;
  constructor() {
    void firstValueFrom(this.courses.get(this.id))
      .then((c) => this.title.set(c.title))
      .catch(() => {});
    void this.load();
  }
  async load() {
    this.loading.set(true);
    this.error.set('');
    try {
      this.page.set(
        await firstValueFrom(
          this.progress.students(this.id, {
            pageNumber: this.pageIndex + 1,
            pageSize: 10,
            search: this.search,
          }),
        ),
      );
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
  searchStudents() {
    this.pageIndex = 0;
    void this.load();
  }
  paginate(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    void this.load();
  }
}
