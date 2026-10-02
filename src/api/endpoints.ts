/**
 * 101slovo — API endpoints
 * Все эндпоинты бэкенда в одном месте.
 */

import { apiClient } from './client';
import type {
  AuthTokens,
  RegisterRequest,
  LoginRequest,
  OnboardingRequest,
  UserProfile,
  Dictionary,
  LessonWithExercises,
  StartLessonRequest,
  SubmitTranslationRequest,
  DontKnowRequest,
  ReportSentenceRequest,
  EvaluationResult,
  Lesson,
} from '../types/database';

// ========================
// Auth
// ========================

export const authApi = {
  register: (data: RegisterRequest) =>
    apiClient.post<AuthTokens>('/auth/register', data),

  login: (data: LoginRequest) =>
    apiClient.post<AuthTokens>('/auth/login', data),

  logout: () =>
    apiClient.post<void>('/auth/logout'),

  me: () =>
    apiClient.get<UserProfile>('/auth/me'),
};

// ========================
// Onboarding
// ========================

export const onboardingApi = {
  complete: (data: OnboardingRequest) =>
    apiClient.post<void>('/onboarding/complete', data),

  getDictionaries: () =>
    apiClient.get<Dictionary[]>('/onboarding/dictionaries'),
};

// ========================
// Lessons
// ========================

export const lessonsApi = {
  start: (data: StartLessonRequest) =>
    apiClient.post<LessonWithExercises>('/lessons/start', data),

  getCurrent: () =>
    apiClient.get<LessonWithExercises | null>('/lessons/current'),

  complete: (lessonId: number) =>
    apiClient.post<Lesson>(`/lessons/${lessonId}/complete`),

  getHistory: (limit = 20, offset = 0) =>
    apiClient.get<{ lessons: Lesson[]; total: number }>(`/lessons/history?limit=${limit}&offset=${offset}`),
};

// ========================
// Exercises
// ========================

export const exercisesApi = {
  submitTranslation: (data: SubmitTranslationRequest) =>
    apiClient.post<{
      results: EvaluationResult[];
      exercise_id: number;
    }>('/exercises/submit', data),

  dontKnow: (data: DontKnowRequest) =>
    apiClient.post<{
      reference_translation: string;
      exercise_id: number;
    }>('/exercises/dont-know', data),

  report: (data: ReportSentenceRequest) =>
    apiClient.post<void>('/exercises/report', data),
};

// ========================
// Words
// ========================

export const wordsApi = {
  getSuggestions: (lessonId: number) =>
    apiClient.get<{ word_id: number; lemma: string; pos: string; translations: string[] }[]>(
      `/lessons/${lessonId}/suggestions`,
    ),

  acceptSuggestion: (wordId: number) =>
    apiClient.post<void>(`/words/${wordId}/accept`),

  declineSuggestion: (wordId: number) =>
    apiClient.post<void>(`/words/${wordId}/decline`),
};

// ========================
// Stats
// ========================

export const statsApi = {
  getDashboard: () =>
    apiClient.get<{
      words_active: number;
      words_mastered: number;
      lessons_completed: number;
      current_streak: number;
      longest_streak: number;
      today_reviewed: number;
    }>('/stats/dashboard'),
};
