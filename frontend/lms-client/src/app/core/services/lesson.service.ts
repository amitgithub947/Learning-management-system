import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Lesson, LessonRequest, Page, Query } from '../models/models';
@Injectable({ providedIn: 'root' })
export class LessonService {
  private api = inject(ApiService);
  list(courseId: string, q: Query = {}) {
    return this.api.get<Page<Lesson>>(`/courses/${courseId}/lessons`, q);
  }
  get(id: string) {
    return this.api.get<Lesson>(`/lessons/${id}`);
  }
  create(courseId: string, r: LessonRequest) {
    return this.api.post<Lesson>(`/courses/${courseId}/lessons`, r);
  }
  update(id: string, r: LessonRequest) {
    return this.api.put<Lesson>(`/lessons/${id}`, r);
  }
  delete(id: string) {
    return this.api.delete(`/lessons/${id}`);
  }
  complete(id: string) {
    return this.api.patch<{ lessonId: string; isCompleted: boolean; completedAt: string }>(
      `/lessons/${id}/complete`,
    );
  }
}
