import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Award, Target, TrendingUp, BookOpen } from 'lucide-react';

interface LessonSummary {
  lesson_id: number;
  lesson_number: number;
  exercises_total: number;
  words_total: number;
  correct_count: number;
  incorrect_count: number;
  typo_count: number;
  accuracy: number;
  time_spent: number;
  new_words_learned: number;
  streak_current: number;
  streak_longest: number;
}

export default function LessonSummary() {
  const { lessonId } = useParams<{ lessonId: string }>();
  const navigate = useNavigate();
  const [summary, setSummary] = useState<LessonSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSummary();
  }, [lessonId]);

  const loadSummary = async () => {
    if (!lessonId) return;

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }

      const response = await fetch(`http://localhost:8000/lesson/${lessonId}/summary`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Не удалось загрузить итоги урока');
      }

      const data = await response.json();
      console.log('📊 Lesson summary loaded:', data);
      setSummary(data);
    } catch (err) {
      console.error('❌ Error loading summary:', err);
      setError(err instanceof Error ? err.message : 'Не удалось загрузить итоги урока');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Загрузка итогов урока...</p>
        </div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <div className="text-red-500 mx-auto mb-4">
            <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-600 mb-6">{error || 'Не удалось загрузить итоги урока'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  const accuracyColor = summary.accuracy >= 80 ? 'text-green-600' : summary.accuracy >= 60 ? 'text-yellow-600' : 'text-red-600';
  const accuracyBg = summary.accuracy >= 80 ? 'bg-green-50 border-green-200' : summary.accuracy >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-red-50 border-red-200';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={20} />
              <span>На главную</span>
            </button>
            <div className="flex items-center gap-2">
              <Award className="text-indigo-600" size={24} />
              <h1 className="text-xl font-bold text-gray-900">Итоги урока</h1>
            </div>
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6">
          {/* Success Message */}
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-8 text-white text-center">
            <Award className="mx-auto mb-4" size={64} />
            <h2 className="text-3xl font-bold mb-2">Урок {summary.lesson_number} завершён!</h2>
            <p className="text-indigo-100 text-lg">Отличная работа! Продолжайте в том же духе!</p>
          </div>

          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Accuracy */}
            <div className={`rounded-2xl p-6 border-2 ${accuracyBg}`}>
              <div className="flex items-center gap-3 mb-4">
                <Target className={accuracyColor} size={32} />
                <h3 className="text-lg font-semibold text-gray-900">Точность</h3>
              </div>
              <div className={`text-4xl font-bold ${accuracyColor} mb-2`}>
                {summary.accuracy.toFixed(1)}%
              </div>
              <div className="text-sm text-gray-600">
                Правильных ответов
              </div>
            </div>

            {/* Exercises */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <BookOpen className="text-blue-600" size={32} />
                <h3 className="text-lg font-semibold text-gray-900">Упражнения</h3>
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {summary.exercises_total}
              </div>
              <div className="text-sm text-gray-600">
                Всего выполнено
              </div>
            </div>

            {/* Words */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200">
              <div className="flex items-center gap-3 mb-4">
                <TrendingUp className="text-green-600" size={32} />
                <h3 className="text-lg font-semibold text-gray-900">Слова</h3>
              </div>
              <div className="text-4xl font-bold text-gray-900 mb-2">
                {summary.words_total}
              </div>
              <div className="text-sm text-gray-600">
                Всего повторено
              </div>
            </div>
          </div>

          {/* Detailed Stats */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Подробная статистика</h3>
            
            <div className="space-y-4">
              {/* Correct answers */}
              <div className="flex items-center justify-between p-4 bg-green-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-gray-900 font-medium">Правильные ответы</span>
                </div>
                <span className="text-2xl font-bold text-green-600">{summary.correct_count}</span>
              </div>

              {/* Typo answers */}
              <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
                  <span className="text-gray-900 font-medium">Опечатки</span>
                </div>
                <span className="text-2xl font-bold text-yellow-600">{summary.typo_count}</span>
              </div>

              {/* Incorrect answers */}
              <div className="flex items-center justify-between p-4 bg-red-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-gray-900 font-medium">Неправильные ответы</span>
                </div>
                <span className="text-2xl font-bold text-red-600">{summary.incorrect_count}</span>
              </div>

              {/* New words */}
              <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-indigo-500 rounded-full"></div>
                  <span className="text-gray-900 font-medium">Новых слов изучено</span>
                </div>
                <span className="text-2xl font-bold text-indigo-600">{summary.new_words_learned}</span>
              </div>

              {/* Time spent */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
                  <span className="text-gray-900 font-medium">Время урока</span>
                </div>
                <span className="text-2xl font-bold text-gray-600">
                  {Math.floor(summary.time_spent / 60)} мин {summary.time_spent % 60} сек
                </span>
              </div>
            </div>
          </div>

          {/* Streak Stats */}
          <div className="bg-white rounded-2xl p-6 border border-gray-200">
            <h3 className="text-xl font-bold text-gray-900 mb-6">Серия дней</h3>
            
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center p-6 bg-orange-50 rounded-xl">
                <div className="text-5xl font-bold text-orange-600 mb-2">
                  {summary.streak_current}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  Текущая серия
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  дней подряд
                </div>
              </div>

              <div className="text-center p-6 bg-purple-50 rounded-xl">
                <div className="text-5xl font-bold text-purple-600 mb-2">
                  {summary.streak_longest}
                </div>
                <div className="text-sm text-gray-600 font-medium">
                  Лучшая серия
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  дней подряд
                </div>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 px-6 py-4 bg-white text-gray-700 font-semibold rounded-xl border border-gray-300 hover:bg-gray-50 transition-colors"
            >
              На главную
            </button>
            <button
              onClick={() => navigate('/lesson-preview')}
              className="flex-1 px-6 py-4 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 transition-colors"
            >
              Начать новый урок
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
