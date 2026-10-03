import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Save, User, BookOpen, Clock } from 'lucide-react';

export default function Settings() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Временные состояния (в реальности будут загружаться с API)
  const [level, setLevel] = useState('A2');
  const [dailyLimit, setDailyLimit] = useState(1);
  const [wordsPerLesson, setWordsPerLesson] = useState(5);

  const handleSave = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }

      // TODO: Заменить на реальный API вызов
      // const response = await fetch('http://localhost:8000/learning-profile', {
      //   method: 'PATCH',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${token}`,
      //   },
      //   body: JSON.stringify({
      //     level,
      //     daily_lesson_limit: dailyLimit,
      //     words_per_lesson: wordsPerLesson,
      //   }),
      // });

      // Имитация API вызова
      await new Promise(resolve => setTimeout(resolve, 1000));

      setMessage({ type: 'success', text: 'Настройки успешно сохранены!' });
    } catch (error) {
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Ошибка сохранения настроек' 
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Назад</span>
            </button>
            <h1 className="ml-4 text-xl font-bold text-gray-900">Настройки</h1>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="space-y-6">
          {/* Profile Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                <User className="text-indigo-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Профиль</h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={user.email}
                  disabled
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Email нельзя изменить
                </p>
              </div>
            </div>
          </div>

          {/* Learning Settings */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                <BookOpen className="text-green-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Настройки обучения</h2>
            </div>

            <div className="space-y-6">
              {/* Level */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Уровень английского
                </label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                >
                  <option value="A1">A1 - Начальный</option>
                  <option value="A2">A2 - Элементарный</option>
                  <option value="B1">B1 - Средний</option>
                  <option value="B2">B2 - Выше среднего</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Уровень определяет сложность слов для изучения
                </p>
              </div>

              {/* Daily Limit */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Уроков в день
                </label>
                <input
                  type="number"
                  min="1"
                  max="5"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Максимальное количество уроков в день (1-5)
                </p>
              </div>

              {/* Words per Lesson */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Слов в уроке
                </label>
                <input
                  type="number"
                  min="3"
                  max="10"
                  value={wordsPerLesson}
                  onChange={(e) => setWordsPerLesson(parseInt(e.target.value))}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Количество новых слов в каждом уроке (3-10)
                </p>
              </div>
            </div>
          </div>

          {/* Timezone Section */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                <Clock className="text-purple-600" size={24} />
              </div>
              <h2 className="text-xl font-bold text-gray-900">Часовой пояс</h2>
            </div>

            <div>
              <p className="text-sm text-gray-600 mb-2">
                Текущий часовой пояс используется для расчёта стрика и ежедневных лимитов.
              </p>
              <button
                onClick={() => navigate('/onboarding')}
                className="px-4 py-2 text-indigo-600 font-medium border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                Изменить часовой пояс
              </button>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div
              className={`p-4 rounded-xl ${
                message.type === 'success'
                  ? 'bg-green-50 border border-green-200 text-green-800'
                  : 'bg-red-50 border border-red-200 text-red-800'
              }`}
            >
              {message.text}
            </div>
          )}

          {/* Save Button */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSave}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Сохранение...
                </>
              ) : (
                <>
                  <Save size={20} />
                  Сохранить настройки
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
