/**
 * API клиент для 101slovo
 * Использует переменную окружения VITE_API_URL
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export const apiClient = {
  // Auth
  async login(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка входа');
    }
    return response.json();
  },

  async register(email: string, password: string) {
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка регистрации');
    }
    return response.json();
  },

  async getMe(token: string) {
    const response = await fetch(`${API_URL}/auth/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error('Ошибка получения данных пользователя');
    }
    return response.json();
  },

  // Lessons
  async getLessonPreview(token: string) {
    const response = await fetch(`${API_URL}/lesson/preview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Не удалось загрузить слова');
    }
    return response.json();
  },

  async declineWord(token: string, wordId: number) {
    const response = await fetch(`${API_URL}/lesson/new-word/decline`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ word_id: wordId }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Не удалось отказаться от слова');
    }
    return response.json();
  },

  async startLesson(token: string, wordIds: number[], idempotencyKey: string) {
    const response = await fetch(`${API_URL}/lesson/start`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify({ word_ids: wordIds }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Не удалось начать урок');
    }
    return response.json();
  },

  async getCurrentExercise(token: string, lessonId: number) {
    const response = await fetch(`${API_URL}/lesson/${lessonId}/current`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Не удалось загрузить упражнение');
    }
    return response.json();
  },

  async evaluateExercise(
    token: string,
    exerciseId: number,
    userTranslation: string | null,
    dontKnow: boolean
  ) {
    const response = await fetch(`${API_URL}/lesson/evaluate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        exercise_id: exerciseId,
        user_translation: userTranslation,
        dont_know: dontKnow,
      }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка проверки');
    }
    return response.json();
  },

  async handleSuggestion(token: string, exerciseId: number, wordId: number, action: 'add' | 'ignore') {
    const response = await fetch(`${API_URL}/lesson/exercises/${exerciseId}/suggestions/${wordId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка обработки подсказки');
    }
    return response.json();
  },

  async getLessonSummary(token: string, lessonId: number) {
    const response = await fetch(`${API_URL}/lesson/${lessonId}/summary`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Не удалось загрузить итоги урока');
    }
    return response.json();
  },

  // Onboarding
  async completeOnboarding(token: string, level: string, dictionaryId: number, timezone: string) {
    const response = await fetch(`${API_URL}/onboarding/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ level, dictionary_id: dictionaryId, timezone }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка завершения онбординга');
    }
    return response.json();
  },

  // Settings
  async getLearningProfile(token: string) {
    const response = await fetch(`${API_URL}/learning-profile`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (!response.ok) {
      throw new Error('Не удалось загрузить настройки');
    }
    return response.json();
  },

  async updateLearningProfile(token: string, data: any) {
    const response = await fetch(`${API_URL}/learning-profile`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Не удалось сохранить настройки');
    }
    return response.json();
  },

  async updateTimezone(token: string, timezone: string) {
    const response = await fetch(`${API_URL}/settings/timezone`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ timezone }),
    });
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Не удалось сохранить часовой пояс');
    }
    return response.json();
  },
};
