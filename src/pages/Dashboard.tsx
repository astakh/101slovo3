import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogOut, BookOpen, Target, TrendingUp, Settings, Loader2, AlertCircle } from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface DashboardData {
  profile: {
    level: string;
    dictionary: {
      id: number;
      name: string;
    };
  };
  today: string;
  lessons_today: number;
  daily_lesson_limit: number;
  resets_at: string;
  cta: 'start' | 'resume' | 'limit_reached';
  resume?: {
    lesson_id: number;
    lesson_number: number;
    exercises_done: number;
    exercises_total: number;
  };
  words: {
    active: number;
    mastered: number;
    ignored: number;
  };
  streak: {
    current: number;
    longest: number;
    today_done: boolean;
  };
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }

      const response = await fetch(`${API_URL}/dashboard/summary`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Не удалось загрузить данные');
      }

      const data = await response.json();
      console.log('✅ Dashboard loaded:', data);
      setDashboard(data);
    } catch (err) {
      console.error('❌ Error loading dashboard:', err);
      setError(err instanceof Error ? err.message : 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  if (error || !dashboard || !user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-600 mb-6">{error || 'Не удалось загрузить данные'}</p>
          <button
            onClick={handleLogout}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
          >
            Выйти
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">101</span>
              </div>
              <span className="font-bold text-xl text-gray-900">slovo</span>
            </div>
            
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600">{user.email}</span>
              <button
                onClick={() => navigate('/settings')}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Настройки"
              >
                <Settings size={18} />
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut size={18} />
                Выйти
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Добро пожаловать, {user.email.split('@')[0]}! 👋
          </h1>
          <p className="text-gray-600">
            {dashboard.cta === 'resume' 
              ? 'Продолжите урок или начните новый'
              : dashboard.cta === 'limit_reached'
              ? 'Вы достигли дневного лимита уроков'
              : 'Готовы начать новый урок?'}
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <BookOpen className="text-indigo-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Слов изучено</p>
                <p className="text-2xl font-bold text-gray-900">{dashboard.words.mastered}</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Target className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Уроков сегодня</p>
                <p className="text-2xl font-bold text-gray-900">
                  {dashboard.lessons_today} / {dashboard.daily_lesson_limit}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <TrendingUp className="text-purple-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Текущая серия</p>
                <p className="text-2xl font-bold text-gray-900">{dashboard.streak.current} дней</p>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {dashboard.cta === 'resume' ? 'Продолжить урок?' : 'Готовы к уроку?'}
          </h2>
          <p className="text-gray-600 mb-6">
            {dashboard.cta === 'resume'
              ? `У вас есть незавершённый урок ${dashboard.resume?.lesson_number}`
              : dashboard.cta === 'limit_reached'
              ? 'Возвращайтесь завтра для новых уроков'
              : 'Начните новый урок или продолжите изучение'}
          </p>
          
          {dashboard.cta === 'resume' && dashboard.resume && (
            <div className="mb-6 p-4 bg-indigo-50 rounded-xl">
              <p className="text-sm text-indigo-900">
                Упражнение {dashboard.resume.exercises_done} из {dashboard.resume.exercises_total}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            {dashboard.cta === 'resume' ? (
              <button
                onClick={() => navigate(`/lesson/${dashboard.resume?.lesson_id}`)}
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Продолжить урок
              </button>
            ) : dashboard.cta === 'limit_reached' ? (
              <button
                disabled
                className="px-6 py-3 bg-gray-300 text-gray-500 font-semibold rounded-lg cursor-not-allowed"
              >
                Лимит исчерпан
              </button>
            ) : (
              <button
                onClick={() => navigate('/lesson-preview')}
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Начать урок
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
