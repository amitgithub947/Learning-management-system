import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { QuizAttemptPage } from './quiz-attempt';
describe('Quiz attempt UI', () => {
  it('uses the server timer and restores selected answers without any grading key', async () => {
    sessionStorage.clear();
    await TestBed.configureTestingModule({
      imports: [QuizAttemptPage],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: new Map([['id', 'attempt']]) } },
        },
      ],
    }).compileComponents();
    const f = TestBed.createComponent(QuizAttemptPage);
    const http = TestBed.inject(HttpTestingController);
    const serverTime = '2026-10-27T00:00:00Z';
    http
      .expectOne('/api/quiz-attempts/attempt')
      .flush({
        success: true,
        data: {
          attemptId: 'attempt',
          quizId: 'quiz',
          quizTitle: 'Quiz',
          startedAt: serverTime,
          serverTime,
          expiresAt: '2026-10-27T00:01:00Z',
          submittedAt: null,
          isExpired: false,
          score: null,
          maximumMarks: 1,
          isPassed: false,
          questions: [
            {
              questionId: 'q',
              questionText: 'Question',
              questionType: 'SingleChoice',
              marks: 1,
              sequenceNumber: 1,
              options: [{ optionId: 'o', optionText: 'Option', isCorrect: null }],
              expectedAnswer: null,
            },
          ],
        },
      });
    await f.whenStable();
    f.detectChanges();
    expect(f.componentInstance.timerLabel()).toBe('01:00');
    expect(f.nativeElement.textContent).toContain('Question');
    const input = f.nativeElement.querySelector('input[type=radio]') as HTMLInputElement;
    input.click();
    f.detectChanges();
    expect(f.componentInstance.answered()).toBe(1);
    expect(JSON.parse(sessionStorage.getItem('lms.quiz.attempt')!)[0].selectedOptionIds).toEqual([
      'o',
    ]);
    expect(sessionStorage.getItem('lms.quiz.attempt')).not.toContain('isCorrect');
    f.destroy();
    http.verify();
    sessionStorage.clear();
  });
});
