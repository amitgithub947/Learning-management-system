import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Course, CourseOverview, CourseRequest, Page, Query } from '../models/models';
@Injectable({ providedIn: 'root' })
export class CourseService {
  private api = inject(ApiService);
  list(q: Query = {}) {
    return this.api.get<Page<Course>>('/courses', q);
  }
  mine(q: Query = {}) {
    return this.api.get<Page<Course>>('/courses/my-courses', q);
  }
  get(id: string) {
    return this.api.get<Course>(`/courses/${id}`);
  }
  overview(id: string) {
    return this.api.get<CourseOverview>(`/courses/${id}/overview`);
  }
  categories() {
    return this.api.get<string[]>('/courses/categories');
  }
  create(r: CourseRequest) {
    return this.api.post<Course>('/courses', r);
  }
  update(id: string, r: CourseRequest) {
    return this.api.put<Course>(`/courses/${id}`, r);
  }
  publish(id: string) {
    return this.api.patch(`/courses/${id}/publish`);
  }
  delete(id: string) {
    return this.api.delete(`/courses/${id}`);
  }
}
