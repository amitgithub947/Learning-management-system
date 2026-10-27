import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { firstValueFrom } from 'rxjs';
import { QuizService } from './quiz.service';
describe('QuizService', () => {
  let api: QuizService;
  let http: HttpTestingController;
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(QuizService);
    http = TestBed.inject(HttpTestingController);
  });
  afterEach(() => http.verify());
  it('starts an attempt with no client-supplied timing or student identity', async () => {
    const promise = firstValueFrom(api.start('quiz'));
    const req = http.expectOne('/api/quizzes/quiz/attempts');
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({
      success: true,
      data: { attemptId: 'attempt', serverTime: '2026-10-27T00:00:00Z', questions: [] },
    });
    expect((await promise).attemptId).toBe('attempt');
  });
  it('submits answers and never calculates or sends grades', async () => {
    const answers = [{ questionId: 'question', selectedOptionIds: ['option'], text: null }];
    const promise = firstValueFrom(api.submit('attempt', answers));
    const req = http.expectOne('/api/quiz-attempts/attempt/submit');
    expect(req.request.body).toEqual({ answers });
    expect(req.request.body.score).toBeUndefined();
    expect(req.request.body.isPassed).toBeUndefined();
    req.flush({ success: true, data: { score: 5, isPassed: true } });
    expect((await promise).score).toBe(5);
  });
  it('loads the protected server result for a submitted attempt', async () => {
    const promise = firstValueFrom(api.result('attempt'));
    http
      .expectOne('/api/quiz-attempts/attempt/result')
      .flush({ success: true, data: { attemptId: 'attempt', isPassed: false, percentage: 0 } });
    expect((await promise).isPassed).toBe(false);
  });
});
