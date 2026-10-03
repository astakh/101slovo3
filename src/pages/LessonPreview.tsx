import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, BookOpen, X, Check, Loader2, AlertCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../api/client';

interface Word {
  word_id: number;
  lemma: string;
  pos: string;
  translations?: string[];
}

interface PreviewData {
  state: 'ready' | 'resume' | 'limit_reached' | 'no_words';
  lesson_number?: number;
  due_words?: Word[];
  new_words?: Word[];
  dictionary_exhausted?: boolean;
  // Для state='resume'
  lesson_id?: number;
  exercises_done?: number;
  exercises_total?: number;
  // Для state='limit_reached'
  resets_at?: string;
}

const POS_LABELS: Record<string, string> = {
  noun: 'существительное',
  verb: 'глагол',
  adj: 'прилагательное',
  adv: 'наречие',
  pron: 'местоимение',
  prep: 'предлог',
  conj: 'союз',
  num: 'числительное',
  det: 'определитель',
  intj: 'междометие',
};

export default function LessonPreview() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [decliningWords, setDecliningWords] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadPreview();
  }, []);

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/lesson/preview`, {
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

      const data = await response.json();
      setPreview(data);
    } catch (err) {
      setError('Не удалось загрузить слова');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeclineWord = async (wordId: number) => {
    setDecliningWords(prev => new Set(prev).add(wordId));
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/lesson/new-word/decline`, {
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

      // API вернёт обновлённый preview
      const updatedPreview = await response.json();
      setPreview(updatedPreview);
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Ошибка отказа от слова');
    } finally {
      setDecliningWords(prev => {
        const next = new Set(prev);
        next.delete(wordId);
        return next;
      });
    }
  };

  const handleStartLesson = () => {
    if (!preview) return;
    
    const wordIds = [
      ...(preview.due_words?.map(w => w.word_id) || []),
      ...(preview.new_words?.map(w => w.word_id) || []),
    ];
    
    // Переходим на страницу урока с word_ids
    navigate('/lesson', { state: { wordIds, lessonNumber: preview.lesson_number } });
  };

  const handleResumeLesson = () => {
    if (!preview || !preview.lesson_id) return;
    navigate(`/lesson/${preview.lesson_id}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={48} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              Назад
            </button>
            <button
              onClick={loadPreview}
              className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Повторить
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!preview) {
    return null;
  }

  // Состояние: есть незавершённый урок
  if (preview.state === 'resume') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={20} />
                <span>Назад</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-indigo-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="text-indigo-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              У вас есть незавершённый урок
            </h2>
            <p className="text-gray-600 mb-6">
              Упражнение {preview.exercises_done} из {preview.exercises_total}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
              >
                На главную
              </button>
              <button
                onClick={handleResumeLesson}
                className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
              >
                Продолжить урок
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Состояние: лимит исчерпан
  if (preview.state === 'limit_reached') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={20} />
                <span>Назад</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="text-yellow-600" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Дневной лимит исчерпан
            </h2>
            <p className="text-gray-600 mb-6">
              Вы достигли лимита уроков на сегодня. Возвращайтесь завтра!
            </p>
            {preview.resets_at && (
              <p className="text-sm text-gray-500 mb-6">
                Лимит обновится: {new Date(preview.resets_at).toLocaleString('ru-RU')}
              </p>
            )}
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
            >
              На главную
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Состояние: нет слов
  if (preview.state === 'no_words') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
        <header className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center h-16">
              <button
                onClick={() => navigate('/dashboard')}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={20} />
                <span>Назад</span>
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <BookOpen className="text-gray-400" size={32} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Нет слов для изучения
            </h2>
            <p className="text-gray-600 mb-6">
              {preview.dictionary_exhausted
                ? 'Словарь исчерпан. Попробуйте выбрать другой словарь в настройках.'
                : 'Все слова вашего уровня уже изучены. Отличная работа!'}
            </p>
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
            >
              На главную
            </button>
          </div>
        </main>
      </div>
    );
  }

  // Состояние: готов к старту (state === 'ready')
  const dueWords = preview.due_words || [];
  const newWords = preview.new_words || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={20} />
              <span>Назад</span>
            </button>
            <div className="flex items-center gap-2">
              <BookOpen className="text-indigo-600" size={20} />
              <span className="font-semibold text-gray-900">
                Урок {preview.lesson_number}
              </span>
            </div>
            <div className="w-20" /> {/* Spacer для центрирования */}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-8"
        >
          <div className="text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Слова для урока
            </h1>
            <p className="text-gray-600">
              Проверьте список слов перед началом урока. Вы можете отказаться от новых слов.
            </p>
          </div>

          {/* Due Words (повторение) */}
          {dueWords.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">🔄</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Повторение ({dueWords.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {dueWords.map(word => (
                  <div
                    key={word.word_id}
                    className="p-4 bg-blue-50 rounded-xl border border-blue-100"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-semibold text-gray-900">{word.lemma}</div>
                        <div className="text-sm text-gray-600">
                          {POS_LABELS[word.pos] || word.pos}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* New Words */}
          {newWords.length > 0 && (
            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <span className="text-green-600 font-bold text-sm">✨</span>
                </div>
                <h2 className="text-lg font-semibold text-gray-900">
                  Новые слова ({newWords.length})
                </h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {newWords.map(word => (
                  <motion.div
                    key={word.word_id}
                    layout
                    className="p-4 bg-green-50 rounded-xl border border-green-100"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="font-semibold text-gray-900">{word.lemma}</div>
                        <div className="text-sm text-gray-600 mb-2">
                          {POS_LABELS[word.pos] || word.pos}
                        </div>
                        {word.translations && (
                          <div className="text-sm text-gray-700">
                            {word.translations.join(', ')}
                          </div>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeclineWord(word.word_id)}
                        disabled={decliningWords.has(word.word_id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Отказаться от слова"
                      >
                        {decliningWords.has(word.word_id) ? (
                          <Loader2 className="animate-spin" size={18} />
                        ) : (
                          <X size={18} />
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Dictionary exhausted warning */}
          {preview.dictionary_exhausted && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="text-sm text-yellow-800">
                ⚠️ В словаре недостаточно слов для полного урока. Будет использовано{' '}
                {dueWords.length + newWords.length} слов вместо обычного количества.
              </p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleStartLesson}
              disabled={dueWords.length + newWords.length === 0}
              className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              <Check size={20} />
              Начать урок ({dueWords.length + newWords.length} слов)
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
