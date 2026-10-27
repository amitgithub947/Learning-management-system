import { Routes } from '@angular/router';
import { managedAdvancedRoutes, studentAdvancedRoutes } from './advanced.routes';
import { authGuard, roleGuard } from './core/guards/auth.guard';
const managedRoutes: Routes = [
  {
    path: 'courses',
    loadComponent: () => import('./features/trainer/courses').then((m) => m.ManagedCourses),
  },
  {
    path: 'courses/:id/edit',
    loadComponent: () => import('./features/trainer/course-editor').then((m) => m.CourseEditor),
  },
  {
    path: 'courses/:id/lessons',
    loadComponent: () => import('./features/lessons/manage-lessons').then((m) => m.ManageLessons),
  },
  {
    path: 'courses/:id/students',
    loadComponent: () => import('./features/enrollments/students').then((m) => m.EnrolledStudents),
  },
];
export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./layouts/public-layout/public-layout').then((m) => m.PublicLayout),
    children: [
      {
        path: 'certificates/verify/:code',
        loadComponent: () =>
          import('./features/certificates/certificate-verification/certificate-verification').then(
            (m) => m.CertificateVerification,
          ),
      },
      {
        path: 'certificates/verify',
        loadComponent: () =>
          import('./features/certificates/certificate-verification/certificate-verification').then(
            (m) => m.CertificateVerification,
          ),
      },
      {
        path: '',
        pathMatch: 'full',
        loadComponent: () => import('./features/public/landing').then((m) => m.Landing),
      },
      {
        path: 'courses',
        loadComponent: () => import('./features/courses/catalog').then((m) => m.Catalog),
      },
      {
        path: 'courses/:id',
        loadComponent: () =>
          import('./features/courses/course-details').then((m) => m.CourseDetails),
      },
      {
        path: 'login',
        loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
      },
      {
        path: 'register',
        data: { register: true },
        loadComponent: () => import('./features/auth/auth-page').then((m) => m.AuthPage),
      },
    ],
  },
  {
    path: 'admin',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Admin'] },
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./features/admin/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'users',
        loadComponent: () => import('./features/admin/users').then((m) => m.UsersPage),
      },
      {
        path: 'trainers',
        data: { trainers: true },
        loadComponent: () => import('./features/admin/users').then((m) => m.UsersPage),
      },
      ...managedAdvancedRoutes,
      ...managedRoutes,
    ],
  },
  {
    path: 'trainer',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Trainer'] },
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/trainer/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'courses/new',
        loadComponent: () => import('./features/trainer/course-editor').then((m) => m.CourseEditor),
      },
      ...managedAdvancedRoutes,
      ...managedRoutes,
    ],
  },
  {
    path: 'student',
    canActivate: [authGuard, roleGuard],
    data: { roles: ['Student'] },
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayout),
    children: [
      ...studentAdvancedRoutes,
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/student/dashboard').then((m) => m.DashboardComponent),
      },
      {
        path: 'courses',
        loadComponent: () => import('./features/student/my-learning').then((m) => m.MyLearning),
      },
      {
        path: 'progress',
        data: { progress: true },
        loadComponent: () => import('./features/student/my-learning').then((m) => m.MyLearning),
      },
      {
        path: 'learn/:id',
        loadComponent: () => import('./features/lessons/learning').then((m) => m.Learning),
      },
    ],
  },
  {
    path: 'account',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./layouts/dashboard-layout/dashboard-layout').then((m) => m.DashboardLayout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'profile' },
      {
        path: 'profile',
        loadComponent: () => import('./features/auth/profile').then((m) => m.Profile),
      },
      {
        path: 'change-password',
        loadComponent: () => import('./features/auth/profile').then((m) => m.Profile),
      },
    ],
  },
  {
    path: '**',
    loadComponent: () => import('./features/public/not-found').then((m) => m.NotFound),
  },
];
