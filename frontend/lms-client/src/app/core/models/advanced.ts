export interface Assignment {
  assignmentId: string;
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  maximumMarks: number;
  passingPercentage: number;
  isRequired: boolean;
  createdAt: string;
}
export interface AssignmentRequest {
  courseId: string;
  title: string;
  description: string;
  dueDate: string;
  maximumMarks: number;
  passingPercentage: number;
  isRequired: boolean;
}
export interface Submission {
  submissionId: string;
  assignmentId: string;
  studentId: string;
  studentName?: string;
  content: string;
  submittedAt: string;
  marks: number | null;
  feedback: string | null;
  status: 'Submitted' | 'Graded';
}
export type QuestionType = 'SingleChoice' | 'MultipleChoice' | 'FreeText';
export interface OptionRequest {
  optionText: string;
  isCorrect: boolean;
}
export interface QuestionRequest {
  questionText: string;
  questionType: QuestionType;
  marks: number;
  options: OptionRequest[];
  expectedAnswer: string | null;
}
export interface QuizRequest {
  courseId: string;
  title: string;
  description: string;
  passingPercentage: number;
  timeLimitMinutes: number | null;
  isPublished: boolean;
  isRequired: boolean;
  questions: QuestionRequest[];
}
export interface Option {
  optionId: string;
  optionText: string;
  isCorrect: boolean | null;
}
export interface Question {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  marks: number;
  sequenceNumber: number;
  options: Option[];
  expectedAnswer: string | null;
}
export interface Quiz {
  quizId: string;
  courseId: string;
  title: string;
  description: string;
  passingPercentage: number;
  timeLimitMinutes: number | null;
  isPublished: boolean;
  isRequired: boolean;
  questionCount: number;
  maximumMarks: number;
  canEdit: boolean;
  questions: Question[];
}
export interface QuizAnswer {
  questionId: string;
  selectedOptionIds: string[];
  text: string | null;
}
export interface Attempt {
  attemptId: string;
  quizId: string;
  quizTitle: string;
  startedAt: string;
  expiresAt: string | null;
  serverTime: string;
  submittedAt: string | null;
  isExpired: boolean;
  score: number | null;
  maximumMarks: number;
  isPassed: boolean;
  questions: Question[];
}
export interface AnswerReview {
  questionId: string;
  questionText: string;
  questionType: QuestionType;
  maximumMarks: number;
  awardedMarks: number;
  selectedOptionIds: string[];
  correctOptionIds: string[];
  text: string | null;
  expectedAnswer: string | null;
  options: Option[];
}
export interface QuizResult {
  attemptId: string;
  quizId: string;
  courseId: string;
  studentId: string;
  studentName: string;
  quizTitle: string;
  startedAt: string;
  submittedAt: string | null;
  isExpired: boolean;
  score: number | null;
  maximumMarks: number;
  percentage: number;
  passingPercentage: number;
  isPassed: boolean;
  answers: AnswerReview[];
}
export interface CompletionSettings {
  requireLessons: boolean;
  requireAssignments: boolean;
  requireQuizzes: boolean;
}
export interface AssignmentPerformance {
  assignmentId: string;
  title: string;
  isRequired: boolean;
  maximumMarks: number;
  passingPercentage: number;
  submissionId: string | null;
  status: 'Submitted' | 'Graded' | null;
  marks: number | null;
  feedback: string | null;
  isPassed: boolean;
}
export interface QuizPerformance {
  quizId: string;
  title: string;
  isRequired: boolean;
  passingPercentage: number;
  attempts: number;
  bestPercentage: number | null;
  isPassed: boolean;
}
export interface Completion {
  courseId: string;
  courseTitle: string;
  totalLessons: number;
  completedLessons: number;
  remainingLessons: number;
  percentage: number;
  status: 'Active' | 'Completed' | 'Cancelled';
  completedAt: string | null;
  isEligible: boolean;
  settings: CompletionSettings;
  requiredLessons: number;
  requiredLessonsCompleted: number;
  assignments: AssignmentPerformance[];
  quizzes: QuizPerformance[];
  unmetRequirements: string[];
  certificateId: string | null;
}
export interface Certificate {
  certificateId: string;
  courseId: string;
  courseTitle: string;
  studentName: string;
  trainerName: string;
  completedAt: string;
  issuedAt: string;
  certificateNumber: string;
  verificationCode: string;
}
export interface CourseAnalytics {
  courseId: string;
  title: string;
  enrolledStudents: number;
  completedStudents: number;
  averageCompletionPercentage: number;
  averageAssignmentPercentage: number | null;
  quizPassRate: number | null;
}
export interface TrainerPerformance {
  trainerId: string;
  name: string;
  courses: number;
  enrollments: number;
  completedStudents: number;
}
export interface Analytics {
  totalUsers: number;
  totalCourses: number;
  totalEnrollments: number;
  completedStudents: number;
  averageCompletionPercentage: number;
  averageAssignmentPercentage: number | null;
  quizPassRate: number | null;
  courses: CourseAnalytics[];
  trainers: TrainerPerformance[];
}
export interface CourseChoice {
  courseId: string;
  title: string;
}
