import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { CourseService } from '../../core/services/course.service';
import { AuthService } from '../../core/auth/auth.service';
import { Course, emptyPage } from '../../core/models/models';
import { IconComponent } from '../../shared/components/icon';
import {
  EmptyComponent,
  ErrorComponent,
  SkeletonComponent,
  uiHelpers,
} from '../../shared/components/ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
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
  template: ` <div class="page-heading heading-with-action">
      <div>
        <span class="eyebrow">KNOWLEDGE WORTH SHARING</span>
        <h1>{{ admin ? 'Course management' : 'My courses' }}</h1>
        <p>
          {{
            admin
              ? 'A clear view of every course in your community.'
              : 'Turn what you know into someone else’s next possibility.'
          }}
        </p>
      </div>
      @if (!admin) {
        <a class="btn btn-primary" routerLink="/trainer/courses/new"
          ><app-icon name="plus" />Create a course</a
        >
      }
    </div>
    <section class="panel table-panel">
      <div class="table-toolbar">
        <form class="search-field" (ngSubmit)="searchCourses()">
          <app-icon name="search" /><input
            name="search"
            [(ngModel)]="search"
            aria-label="Search your courses"
            placeholder="Search courses"
          /><button class="icon-button" aria-label="Run course search">
            <app-icon name="arrow" />
          </button>
        </form>
        <select aria-label="Filter course status" [(ngModel)]="status" (change)="searchCourses()">
          <option value="">All statuses</option>
          <option>Draft</option>
          <option>Published</option>
          <option>Archived</option>
        </select>
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
                <th>Course</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              @for (course of page().items; track course.courseId) {
                <tr>
                  <td>
                    <div class="table-person">
                      <span class="course-mini"><app-icon name="book" /></span>
                      <div>
                        <strong>{{ course.title }}</strong
                        ><small>{{ course.category }}</small>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="status-tag" [class.draft]="course.status !== 'Published'"
                      ><i></i>{{ course.status }}</span
                    >
                  </td>
                  <td>{{ course.updatedAt | date: 'MMM d, y' }}</td>
                  <td>
                    <div class="table-actions">
                      <a
                        class="btn btn-small btn-secondary"
                        [routerLink]="[base, course.courseId, 'edit']"
                        ><app-icon name="edit" />Edit</a
                      ><a
                        class="icon-button"
                        [routerLink]="[base, course.courseId, 'lessons']"
                        aria-label="Manage lessons"
                        title="Manage lessons"
                        ><app-icon name="book" /></a
                      ><a
                        class="icon-button"
                        [routerLink]="[base, course.courseId, 'students']"
                        aria-label="View enrolled students"
                        title="Enrolled students"
                        ><app-icon name="users"
                      /></a>
                      @if (course.status !== 'Published') {
                        <button
                          class="btn btn-small btn-primary"
                          (click)="publish(course)"
                          [disabled]="busy()"
                        >
                          Publish
                        </button>
                      }
                      <button
                        class="icon-button danger"
                        (click)="remove(course)"
                        [disabled]="busy()"
                        [attr.aria-label]="'Delete ' + course.title"
                      >
                        <app-icon name="trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (!page().items.length) {
          <app-empty
            title="A blank page, full of possibility"
            message="Your courses will appear here. Try another filter or create your first course."
          />
        }
      }
      <mat-paginator
        [length]="page().totalCount"
        [pageSize]="10"
        [pageIndex]="pageIndex"
        [hidePageSize]="true"
        (page)="paginate($event)"
        aria-label="Managed course pages"
      />
    </section>`,
})
export class ManagedCourses {
  private api = inject(CourseService);
  private ui = uiHelpers();
  admin = inject(AuthService).user()?.role === 'Admin';
  base = this.admin ? '/admin/courses' : '/trainer/courses';
  page = signal(emptyPage<Course>());
  loading = signal(true);
  error = signal('');
  busy = signal(false);
  search = '';
  status = '';
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
          this.api.mine({
            search: this.search,
            status: this.status,
            sort: 'newest',
            pageNumber: this.pageIndex + 1,
            pageSize: 10,
          }),
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
  async publish(c: Course) {
    if (
      !(await this.ui.confirm(
        'Ready to share your course?',
        `Publish “${c.title}” to the public catalog? At least one lesson is required.`,
        'Publish course',
      ))
    )
      return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.publish(c.courseId));
      this.ui.toast('Course published. New possibilities await.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
  async remove(c: Course) {
    if (
      !(await this.ui.confirm(
        'Delete this course?',
        `Delete “${c.title}”? Courses with enrollments or retained learning records cannot be deleted.`,
        'Delete course',
      ))
    )
      return;
    this.busy.set(true);
    try {
      await firstValueFrom(this.api.delete(c.courseId));
      this.ui.toast('Course deleted.');
      await this.load();
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.busy.set(false);
    }
  }
}
