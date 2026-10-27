import { Routes } from '@angular/router';
const common: Routes = [
  {
    path: 'assignments',
    loadComponent: () =>
      import('./features/assignments/assignment-list/assignment-list').then(
        (m) => m.AssignmentList,
      ),
  },
  {
    path: 'assignments/:id',
    loadComponent: () =>
      import('./features/assignments/assignment-details/assignment-details').then(
        (m) => m.AssignmentDetails,
      ),
  },
  {
    path: 'quizzes',
    loadComponent: () => import('./features/quizzes/quiz-list/quiz-list').then((m) => m.QuizList),
  },
  {
    path: 'quizzes/:id/history',
    loadComponent: () =>
      import('./features/quizzes/quiz-history/quiz-history').then((m) => m.QuizHistory),
  },
  {
    path: 'quiz-attempts/:id/result',
    loadComponent: () =>
      import('./features/quizzes/quiz-results/quiz-results').then((m) => m.QuizResults),
  },
];
export const managedAdvancedRoutes: Routes = [
  {
    path: 'assignments/new',
    loadComponent: () =>
      import('./features/assignments/assignment-editor/assignment-editor').then(
        (m) => m.AssignmentEditor,
      ),
  },
  {
    path: 'assignments/:id/edit',
    loadComponent: () =>
      import('./features/assignments/assignment-editor/assignment-editor').then(
        (m) => m.AssignmentEditor,
      ),
  },
  {
    path: 'quizzes/new',
    loadComponent: () =>
      import('./features/quizzes/quiz-builder/quiz-builder').then((m) => m.QuizBuilder),
  },
  {
    path: 'quizzes/:id/edit',
    loadComponent: () =>
      import('./features/quizzes/quiz-builder/quiz-builder').then((m) => m.QuizBuilder),
  },
  {
    path: 'quizzes/:id/results',
    loadComponent: () =>
      import('./features/quizzes/quiz-history/quiz-history').then((m) => m.QuizHistory),
  },
  {
    path: 'courses/:id/completion',
    loadComponent: () =>
      import('./features/progress/trainer-analytics/completion-settings').then(
        (m) => m.CompletionSettingsPage,
      ),
  },
  {
    path: 'analytics',
    loadComponent: () =>
      import('./features/progress/trainer-analytics/trainer-analytics').then(
        (m) => m.TrainerAnalytics,
      ),
  },
  ...common,
];
export const studentAdvancedRoutes: Routes = [
  {
    path: 'quiz-attempts/:id',
    loadComponent: () =>
      import('./features/quizzes/quiz-attempt/quiz-attempt').then((m) => m.QuizAttemptPage),
  },
  {
    path: 'progress/:id',
    loadComponent: () =>
      import('./features/progress/student-progress/student-progress').then(
        (m) => m.StudentProgressPage,
      ),
  },
  {
    path: 'certificates',
    loadComponent: () =>
      import('./features/certificates/certificate-list/certificate-list').then(
        (m) => m.CertificateList,
      ),
  },
  ...common,
];
