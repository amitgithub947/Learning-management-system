import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { CourseProgress, LearningCourse, StudentProgress, Page, Query } from '../models/models';
@Injectable({ providedIn: 'root' })
export class ProgressService {
  private api = inject(ApiService);
  mine(q: Query = {}) {
    return this.api.get<Page<LearningCourse>>('/progress/my-courses', q);
  }
  course(id: string) {
    return this.api.get<CourseProgress>(`/progress/courses/${id}`);
  }
  students(id: string, q: Query = {}) {
    return this.api.get<Page<StudentProgress>>(`/courses/${id}/students`, q);
  }
}
