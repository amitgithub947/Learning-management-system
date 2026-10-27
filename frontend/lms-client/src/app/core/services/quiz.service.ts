import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { Page, Query } from '../models/models';
import { Quiz, QuizRequest, QuizAnswer, Attempt, QuizResult } from '../models/advanced';
@Injectable({ providedIn: 'root' })
export class QuizService {
  private api = inject(ApiService);
  list(id: string, q: Query = {}) {
    return this.api.get<Page<Quiz>>(`/courses/${id}/quizzes`, q);
  }
  get(id: string) {
    return this.api.get<Quiz>(`/quizzes/${id}`);
  }
  create(r: QuizRequest) {
    return this.api.post<Quiz>('/quizzes', r);
  }
  update(id: string, r: QuizRequest) {
    return this.api.put<Quiz>(`/quizzes/${id}`, r);
  }
  delete(id: string) {
    return this.api.delete(`/quizzes/${id}`);
  }
  start(id: string) {
    return this.api.post<Attempt>(`/quizzes/${id}/attempts`, {});
  }
  attempt(id: string) {
    return this.api.get<Attempt>(`/quiz-attempts/${id}`);
  }
  submit(id: string, answers: QuizAnswer[]) {
    return this.api.post<QuizResult>(`/quiz-attempts/${id}/submit`, { answers });
  }
  result(id: string) {
    return this.api.get<QuizResult>(`/quiz-attempts/${id}/result`);
  }
  results(id: string, q: Query = {}) {
    return this.api.get<Page<QuizResult>>(`/quizzes/${id}/results`, q);
  }
}
