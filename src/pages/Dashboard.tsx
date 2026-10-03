import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LogOut, BookOpen, Target, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  if (!user) {
    return null;
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
            {!user.is_onboarded 
              ? 'Давайте настроим ваш профиль обучения'
              : 'Готовы продолжить обучение?'}
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
                <p className="text-2xl font-bold text-gray-900">0</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <Target className="text-green-600" size={24} />
              </div>
              <div>
                <p className="text-sm text-gray-600">Уроков пройдено</p>
                <p className="text-2xl font-bold text-gray-900">0</p>
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
                <p className="text-2xl font-bold text-gray-900">0 дней</p>
              </div>
            </div>
          </div>
        </div>

        {/* Onboarding CTA */}
        {!user.is_onboarded && (
          <div className="bg-gradient-to-r from-indigo-500 to-purple-500 rounded-2xl p-8 text-white mb-8">
            <h2 className="text-2xl font-bold mb-2">Настройте профиль обучения</h2>
            <p className="text-indigo-100 mb-6">
              Выберите уровень и словарь, чтобы начать обучение
            </p>
            <button 
              onClick={() => navigate('/onboarding')}
              className="px-6 py-3 bg-white text-indigo-600 font-semibold rounded-lg hover:bg-indigo-50 transition-colors"
            >
              Начать настройку
            </button>
          </div>
        )}

        {/* Start Lesson CTA */}
        {user.is_onboarded && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Готовы к уроку?
            </h2>
            <p className="text-gray-600 mb-6">
              Начните новый урок или продолжите предыдущий
            </p>
            <button 
              onClick={() => navigate('/lesson-preview')}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Начать урок
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
