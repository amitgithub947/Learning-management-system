export type Role = 'Admin' | 'Trainer' | 'Student';
export type CourseStatus = 'Draft' | 'Published' | 'Archived';
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}
export interface Page<T> {
  items: T[];
  pageNumber: number;
  pageSize: number;
  totalCount: number;
}
export interface User {
  userId: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  isActive: boolean;
}
export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresAt: string;
  user: User;
}
export interface Course {
  courseId: string;
  title: string;
  description: string;
  trainerId: string;
  category: string;
  thumbnailUrl: string | null;
  status: CourseStatus;
  createdAt: string;
  updatedAt: string;
}
export interface CourseRequest {
  title: string;
  description: string;
  category: string;
  thumbnailUrl: string | null;
}
export interface Lesson {
  lessonId: string;
  courseId: string;
  title: string;
  content: string;
  videoUrl: string | null;
  sequenceNumber: number;
  durationMinutes: number;
  isRequired: boolean;
}
export type LessonRequest = Omit<Lesson, 'lessonId' | 'courseId'>;
export interface LessonOutline {
  lessonId: string;
  title: string;
  sequenceNumber: number;
  durationMinutes: number;
}
export interface CourseOverview {
  course: Course;
  trainerName: string;
  lessons: LessonOutline[];
  enrollmentCount: number;
  isEnrolled: boolean;
}
export interface LessonCompletion extends LessonOutline {
  isCompleted: boolean;
  completedAt: string | null;
}
export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  lessons: LessonCompletion[];
}
export interface LearningCourse {
  courseId: string;
  title: string;
  category: string;
  thumbnailUrl: string | null;
  totalLessons: number;
  completedLessons: number;
  percentage: number;
  continueLessonId: string | null;
  enrolledAt: string;
}
export interface Enrollment {
  enrollmentId: string;
  courseId: string;
  studentId: string;
  courseTitle: string;
  enrollmentDate: string;
  status: 'Active' | 'Completed' | 'Cancelled';
  completedAt: string | null;
}
export interface StudentProgress {
  studentId: string;
  name: string;
  email: string;
  enrollmentDate: string;
  completedLessons: number;
  totalLessons: number;
  percentage: number;
}
export interface Dashboard {
  totalUsers: number;
  totalTrainers: number;
  totalStudents: number;
  totalCourses: number;
  totalEnrollments: number;
  completedLessons: number;
  publishedCourses: number;
  chart: { label: string; value: number }[];
  recentActivities: { title: string; description: string; occurredAt: string }[];
}
export type Query = Record<string, string | number | boolean | null | undefined>;
export const emptyPage = <T>(): Page<T> => ({
  items: [],
  pageNumber: 1,
  pageSize: 9,
  totalCount: 0,
});
