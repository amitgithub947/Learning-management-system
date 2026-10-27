import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { firstValueFrom } from 'rxjs';
import { CourseService } from '../../core/services/course.service';
import { Course, emptyPage } from '../../core/models/models';
import { CourseCardComponent } from '../../shared/components/course-card';
import { IconComponent } from '../../shared/components/icon';
import { EmptyComponent, ErrorComponent, SkeletonComponent } from '../../shared/components/ui';
import { errorMessage } from '../../core/interceptors/error.interceptor';
@Component({
  imports: [
    FormsModule,
    MatPaginatorModule,
    CourseCardComponent,
    IconComponent,
    EmptyComponent,
    ErrorComponent,
    SkeletonComponent,
  ],
  template: ` <section class="catalog-hero">
      <div class="container">
        <div class="breadcrumbs">Discover <span>/</span> Courses</div>
        <span class="eyebrow">A WORLD OF POSSIBILITY</span>
        <h1>Stay curious. <span>Keep growing.</span></h1>
        <p>Find the right course for where you want to go next.</p>
        <form class="catalog-search" (ngSubmit)="searchCourses()">
          <app-icon name="search" /><input
            aria-label="Search courses"
            name="search"
            [(ngModel)]="search"
            placeholder="What do you want to learn?"
          /><button class="btn btn-primary">Search courses <app-icon name="arrow" /></button>
        </form>
      </div>
    </section>
    <section class="section container catalog-body">
      <div class="catalog-toolbar">
        <div class="category-tabs">
          <button [class.active]="category === ''" (click)="filter('')">All courses</button>
          @for (cat of categories(); track cat) {
            <button [class.active]="category === cat" (click)="filter(cat)">{{ cat }}</button>
          }
        </div>
        <label class="sort-control"
          >Sort by
          <select [(ngModel)]="sort" (change)="searchCourses()">
            <option value="title">Course name</option>
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select></label
        >
      </div>
      <p class="results-count">{{ page().totalCount }} courses to move you forward</p>
      @if (loading()) {
        <app-skeleton />
      } @else if (error()) {
        <app-error [message]="error()" (retry)="load()" />
      } @else {
        <div class="course-grid">
          @for (course of page().items; track course.courseId) {
            <app-course-card [course]="course" />
          }
        </div>
        @if (!page().items.length) {
          <app-empty
            title="Let’s try something different"
            message="No courses match your search. Try another keyword or category."
            ><button class="btn btn-secondary" (click)="reset()">Clear filters</button></app-empty
          >
        }
      }
      <mat-paginator
        [length]="page().totalCount"
        [pageSize]="9"
        [pageIndex]="pageIndex"
        [hidePageSize]="true"
        (page)="paginate($event)"
        aria-label="Course pages"
      />
    </section>`,
})
export class Catalog {
  private api = inject(CourseService);
  route = inject(ActivatedRoute);
  page = signal(emptyPage<Course>());
  categories = signal<string[]>([]);
  loading = signal(true);
  error = signal('');
  search = '';
  category = this.route.snapshot.queryParamMap.get('category') || '';
  sort = 'title';
  pageIndex = 0;
  private request = 0;
  constructor() {
    void firstValueFrom(this.api.categories())
      .then((c) => this.categories.set(c))
      .catch(() => {});
    void this.load();
  }
  async load() {
    const request = ++this.request;
    this.loading.set(true);
    this.error.set('');
    try {
      const page = await firstValueFrom(
        this.api.list({
          search: this.search,
          category: this.category,
          sort: this.sort,
          pageNumber: this.pageIndex + 1,
          pageSize: 9,
        }),
      );
      if (request === this.request) this.page.set(page);
    } catch (e) {
      if (request === this.request) this.error.set(errorMessage(e));
    } finally {
      if (request === this.request) this.loading.set(false);
    }
  }
  searchCourses() {
    this.pageIndex = 0;
    void this.load();
  }
  filter(value: string) {
    this.category = value;
    this.searchCourses();
  }
  reset() {
    this.category = '';
    this.search = '';
    this.searchCourses();
  }
  paginate(e: PageEvent) {
    this.pageIndex = e.pageIndex;
    void this.load();
  }
}
