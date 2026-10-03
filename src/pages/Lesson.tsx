import { useState, useEffect } from 'react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, BookOpen, Loader2, AlertCircle } from 'lucide-react';

interface TargetWord {
  word_id: number;
  lemma: string;
  pos: string;
  surface_form: string;
  translations: string[];
}

interface Exercise {
  exercise_id: number;
  order_index: number;
  sentence: string;
  reference_translation: string;
  target_words?: TargetWord[];
  words?: TargetWord[];
}

interface WordResult {
  word_id: number;
  lemma: string;
  pos: string;
  surface_form: string;
  result: 'correct' | 'typo' | 'incorrect';
  user_fragment: string | null;
  translations: string[];
}

interface Suggestion {
  word_id: number;
  lemma: string;
  pos: string;
  translations: string[];
  state: 'suggested' | 'added' | 'ignored';
}

interface EvaluateResult {
  exercise_id: number;
  target_sentence: string;
  reference_translation: string;
  user_translation: string | null;
  words: WordResult[];
  suggestions: Suggestion[];
  lesson_completed: boolean;
}

export default function Lesson() {
  const navigate = useNavigate();
  const location = useLocation();
  const { lessonId } = useParams();
  
  // Из location state получаем word_ids (от LessonPreview)
  const { wordIds, lessonNumber } = (location.state as any) || {};
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lesson, setLesson] = useState<{
    lesson_id: number;
    lesson_number: number;
    exercises_total: number;
    exercises: Exercise[];
  } | null>(null);
  
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userTranslation, setUserTranslation] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [result, setResult] = useState<EvaluateResult | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (lessonId) {
      // Возобновление существующего урока
      loadExistingLesson(parseInt(lessonId));
    } else if (wordIds) {
      // Старт нового урока
      startNewLesson();
    } else {
      // Нет данных — возвращаемся на preview
      navigate('/lesson-preview');
    }
  }, []);

  const loadExistingLesson = async (id: number) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/lesson/${id}/current`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Не удалось загрузить урок');
      }

      const data = await response.json();
      
      console.log('📥 API response for /lesson/current:', data);
      
      // Проверяем, что current_exercise существует
      if (!data.current_exercise) {
        throw new Error('Текущее упражнение не найдено в ответе API');
      }
      
      // Преобразуем данные из API в формат Lesson
      setLesson({
        lesson_id: data.lesson_id,
        lesson_number: data.lesson_number || lessonNumber || 1,
        exercises_total: data.exercises_total,
        exercises: [data.current_exercise], // Начинаем с текущего упражнения
      });
      
      // Всегда начинаем с индекса 0, так как массив содержит только одно упражнение
      setCurrentExerciseIndex(0);
    } catch (err) {
      setError('Не удалось загрузить урок');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const startNewLesson = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }

      const idempotencyKey = crypto.randomUUID();
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/lesson/start`, {
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

      const data = await response.json();
      
      // Преобразуем данные из API в формат Lesson
      setLesson({
        lesson_id: data.lesson_id,
        lesson_number: data.lesson_number,
        exercises_total: data.exercises_total,
        exercises: [data.current_exercise], // Начинаем с первого упражнения
      });
    } catch (err) {
      setError('Не удалось начать урок');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };



  const handleSubmit = async () => {
    if (!lesson) return;
    
    setSubmitting(true);
    try {
      const currentExercise = lesson.exercises[currentExerciseIndex];
      const token = localStorage.getItem('access_token');
      
      console.log('🔍 Отладка проверки упражнения:');
      console.log('  - Exercise ID:', currentExercise.exercise_id);
      console.log('  - Token:', token ? `${token.substring(0, 20)}...` : 'ОТСУТСТВУЕТ');
      console.log('  - Translation:', userTranslation);
      
      if (!token) {
        throw new Error('Токен авторизации отсутствует. Пожалуйста, войдите в систему.');
      }
      
      // Реальный API вызов для проверки через LLM
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/lesson/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          exercise_id: currentExercise.exercise_id,
          user_translation: userTranslation,
          dont_know: false,
        }),
      });

      console.log('📥 Ответ от API:', response.status, response.statusText);

      if (!response.ok) {
        const error = await response.json();
        console.error('❌ Ошибка API:', error);
        throw new Error(error.detail || 'Ошибка проверки перевода');
      }

      const data: EvaluateResult = await response.json();
      console.log('✅ Успешная проверка:', data);
      setResult(data);
      setShowResult(true);
    } catch (err) {
      console.error('Ошибка проверки:', err);
      setError(err instanceof Error ? err.message : 'Ошибка проверки');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDontKnow = async () => {
    if (!lesson) return;
    
    setSubmitting(true);
    try {
      const currentExercise = lesson.exercises[currentExerciseIndex];
      
      // Реальный API вызов с dont_know: true
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/lesson/evaluate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
        },
        body: JSON.stringify({
          exercise_id: currentExercise.exercise_id,
          user_translation: null,
          dont_know: true,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка');
      }

      const data: EvaluateResult = await response.json();
      setResult(data);
      setShowResult(true);
    } catch (err) {
      console.error('Ошибка:', err);
      setError(err instanceof Error ? err.message : 'Ошибка');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (!lesson || !result) return;
    
    console.log('🔍 handleNext called');
    console.log('   lesson_completed:', result.lesson_completed);
    
    if (result.lesson_completed) {
      // Урок завершён — переходим на страницу итогов
      console.log('✅ Lesson completed, navigating to summary');
      navigate(`/lesson/${lesson.lesson_id}/summary`);
    } else {
      // Загружаем следующее упражнение
      console.log('📝 Loading next exercise...');
      try {
        const token = localStorage.getItem('access_token');
        if (!token) {
          throw new Error('Токен авторизации отсутствует');
        }

        const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/lesson/${lesson.lesson_id}/current`, {
          headers: { 'Authorization': `Bearer ${token}` },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Не удалось загрузить следующее упражнение');
        }

        const data = await response.json();
        console.log('📥 Next exercise loaded:', data);

        if (!data.current_exercise) {
          throw new Error('Следующее упражнение не найдено');
        }

        // Обновляем массив упражнений
        setLesson({
          ...lesson,
          exercises: [data.current_exercise],
        });
        
        // Сбрасываем индекс и состояние
        setCurrentExerciseIndex(0);
        setShowResult(false);
        setResult(null);
        setUserTranslation('');
        
        console.log('✅ Next exercise set successfully');
      } catch (err) {
        console.error('❌ Error loading next exercise:', err);
        setError(err instanceof Error ? err.message : 'Не удалось загрузить следующее упражнение');
      }
    }
  };

  const handleSuggestionAction = async (wordId: number, action: 'add' | 'ignore') => {
    if (!result) return;
    
    try {
      const token = localStorage.getItem('access_token');
      if (!token) {
        throw new Error('Токен авторизации отсутствует');
      }

      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/lesson/exercises/${result.exercise_id}/suggestions/${wordId}`, {
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
      
      // Обновляем состояние подсказок
      setResult({
        ...result,
        suggestions: result.suggestions.map(s =>
          s.word_id === wordId ? { ...s, state: action as any } : s
        ),
      });
    } catch (err) {
      console.error(err);
      alert(err instanceof Error ? err.message : 'Ошибка обработки подсказки');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="animate-spin text-indigo-600 mx-auto mb-4" size={48} />
          <p className="text-gray-600">
            {lessonId ? 'Загрузка урока...' : 'Генерация предложений...'}
          </p>
        </div>
      </div>
    );
  }

  if (error || !lesson) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-600 mb-6">{error || 'Не удалось загрузить урок'}</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

  const currentExercise = lesson.exercises[currentExerciseIndex];

  // Логирование для отладки
  console.log('🔍 Lesson data:', lesson);
  console.log('🔍 Current exercise index:', currentExerciseIndex);
  console.log('🔍 Current exercise:', currentExercise);

  if (!currentExercise) {
    console.error('❌ Current exercise is undefined!');
    console.error('   lesson.exercises:', lesson.exercises);
    console.error('   currentExerciseIndex:', currentExerciseIndex);
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 max-w-md text-center">
          <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-xl font-bold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-600 mb-6">Не удалось загрузить упражнение</p>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700"
          >
            На главную
          </button>
        </div>
      </div>
    );
  }

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
              <span>Назад</span>
            </button>
            <div className="flex items-center gap-2">
              <BookOpen className="text-indigo-600" size={20} />
              <span className="font-semibold text-gray-900">
                Урок {lesson.lesson_number}
              </span>
            </div>
            <div className="text-sm text-gray-600">
              Упражнение {currentExerciseIndex + 1} / {lesson.exercises_total}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentExerciseIndex}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8"
          >
            {/* Sentence */}
            <div className="mb-8">
              <h2 className="text-sm font-medium text-gray-600 mb-3">
                Переведите предложение:
              </h2>
              <div className="bg-indigo-50 rounded-xl p-6">
                <p className="text-2xl font-medium text-gray-900">
                  {currentExercise.sentence}
                </p>
              </div>
            </div>

            {/* Target Words */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-gray-600 mb-3">
                Целевые слова:
              </h3>
              <div className="flex flex-wrap gap-2">
                {(currentExercise.target_words || currentExercise.words || []).map((tw) => (
                  <span
                    key={tw.word_id}
                    className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-medium"
                  >
                    {tw.surface_form}
                  </span>
                ))}
              </div>
            </div>

            {/* User Input */}
            {!showResult && (
              <>
                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Ваш перевод:
                  </label>
                  <textarea
                    value={userTranslation}
                    onChange={(e) => setUserTranslation(e.target.value)}
                    placeholder="Введите перевод на русский язык..."
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all resize-none"
                    rows={4}
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={handleDontKnow}
                    disabled={submitting}
                    className="px-6 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    Не знаю
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!userTranslation.trim() || submitting}
                    className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="animate-spin" size={20} />
                        Проверка...
                      </>
                    ) : (
                      'Проверить'
                    )}
                  </button>
                </div>
              </>
            )}

            {/* Result */}
            {showResult && result && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                {/* Status */}
                <div className={`p-6 rounded-xl ${
                  result.words.every(w => w.result === 'correct' || w.result === 'typo')
                    ? 'bg-green-50'
                    : 'bg-red-50'
                }`}>
                  <div className="flex items-center gap-3 mb-3">
                    {result.words.every(w => w.result === 'correct' || w.result === 'typo') ? (
                      <CheckCircle2 className="text-green-600" size={32} />
                    ) : (
                      <XCircle className="text-red-600" size={32} />
                    )}
                    <h3 className={`text-xl font-bold ${
                      result.words.every(w => w.result === 'correct' || w.result === 'typo')
                        ? 'text-green-900'
                        : 'text-red-900'
                    }`}>
                      {result.words.every(w => w.result === 'correct' || w.result === 'typo')
                        ? 'Отлично!'
                        : 'Есть ошибки'}
                    </h3>
                  </div>
                </div>

                {/* User Translation */}
                {result.user_translation && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      Ваш перевод:
                    </h4>
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                      <p className="text-gray-900">{result.user_translation}</p>
                    </div>
                  </div>
                )}

                {/* Reference Translation */}
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">
                    Правильный перевод:
                  </h4>
                  <div className="bg-gray-50 rounded-xl p-4">
                    <p className="text-gray-900">{result.reference_translation}</p>
                  </div>
                </div>

                {/* Target Words with Results */}
                <div>
                  <h4 className="text-sm font-medium text-gray-600 mb-2">
                    Целевые слова:
                  </h4>
                  <div className="space-y-3">
                    {result.words.map((w) => {
                      const isCorrect = w.result === 'correct' || w.result === 'typo';
                      const correctTranslation = w.translations[0] || w.lemma;
                      
                      return (
                        <div
                          key={w.word_id}
                          className={`p-4 rounded-xl border-2 ${
                            isCorrect 
                              ? 'bg-green-50 border-green-200' 
                              : 'bg-red-50 border-red-200'
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <span className="font-semibold text-gray-900 text-lg">
                                {w.surface_form}
                              </span>
                              <span className="text-gray-600 ml-2 text-sm">
                                ({w.lemma}, {w.pos})
                              </span>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                              w.result === 'correct' ? 'bg-green-200 text-green-800' :
                              w.result === 'typo' ? 'bg-yellow-200 text-yellow-800' :
                              'bg-red-200 text-red-800'
                            }`}>
                              {w.result === 'correct' ? '✓ Правильно' : 
                               w.result === 'typo' ? '~ Опечатка' : 
                               '✗ Неправильно'}
                            </span>
                          </div>
                          
                          {isCorrect ? (
                            <div className="text-sm text-green-700">
                              Ваш перевод: <span className="font-medium">{w.user_fragment || correctTranslation}</span>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div className="text-sm">
                                <span className="text-gray-600">Правильный перевод: </span>
                                <span className="font-medium text-green-700">{correctTranslation}</span>
                              </div>
                              {w.user_fragment && (
                                <div className="text-sm">
                                  <span className="text-gray-600">Ваш перевод: </span>
                                  <span className="font-medium text-red-700">{w.user_fragment}</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Suggestions */}
                {result.suggestions.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium text-gray-600 mb-2">
                      Хотите добавить эти слова?
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {result.suggestions.map((s) => (
                        <div
                          key={s.word_id}
                          className="p-4 bg-purple-50 rounded-xl border border-purple-100"
                        >
                          <div className="font-semibold text-gray-900 mb-1">
                            {s.lemma}
                          </div>
                          <div className="text-sm text-gray-600 mb-3">
                            {s.translations.join(', ')}
                          </div>
                          {s.state === 'suggested' && (
                            <div className="flex gap-2">
                              <button
                                onClick={() => handleSuggestionAction(s.word_id, 'add')}
                                className="flex-1 px-3 py-1.5 bg-green-500 text-white text-sm font-medium rounded-lg hover:bg-green-600"
                              >
                                Добавить
                              </button>
                              <button
                                onClick={() => handleSuggestionAction(s.word_id, 'ignore')}
                                className="flex-1 px-3 py-1.5 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300"
                              >
                                Пропустить
                              </button>
                            </div>
                          )}
                          {s.state === 'added' && (
                            <div className="text-green-600 text-sm font-medium flex items-center gap-1">
                              <CheckCircle2 size={16} /> Добавлено
                            </div>
                          )}
                          {s.state === 'ignored' && (
                            <div className="text-gray-500 text-sm">Пропущено</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Next Button */}
                <button
                  onClick={handleNext}
                  className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  {result.lesson_completed ? 'Завершить урок' : 'Следующее упражнение'}
                </button>
              </motion.div>
            )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
