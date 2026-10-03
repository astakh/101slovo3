import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, BookOpen } from 'lucide-react';

// Мок-данные упражнений (в реальности будет приходить с API)
const MOCK_EXERCISES = [
  {
    id: 1,
    sentence: 'She achieved her goal through hard work.',
    targetWords: [
      { word: 'achieved', translation: 'достигла' },
      { word: 'goal', translation: 'цели' },
    ],
    referenceTranslation: 'Она достигла своей цели благодаря упорному труду.',
  },
  {
    id: 2,
    sentence: 'The quick brown fox jumps over the lazy dog.',
    targetWords: [
      { word: 'quick', translation: 'быстрый' },
      { word: 'jumps', translation: 'прыгает' },
    ],
    referenceTranslation: 'Быстрая коричневая лиса прыгает через ленивую собаку.',
  },
  {
    id: 3,
    sentence: 'He decided to improve his English skills.',
    targetWords: [
      { word: 'decided', translation: 'решил' },
      { word: 'improve', translation: 'улучшить' },
    ],
    referenceTranslation: 'Он решил улучшить свои навыки английского.',
  },
  {
    id: 4,
    sentence: 'They traveled to many different countries.',
    targetWords: [
      { word: 'traveled', translation: 'путешествовали' },
      { word: 'different', translation: 'разные' },
    ],
    referenceTranslation: 'Они путешествовали по многим разным странам.',
  },
  {
    id: 5,
    sentence: 'The weather is beautiful today.',
    targetWords: [
      { word: 'weather', translation: 'погода' },
      { word: 'beautiful', translation: 'красивая' },
    ],
    referenceTranslation: 'Сегодня красивая погода.',
  },
];

export default function Lesson() {
  const navigate = useNavigate();
  const [currentExerciseIndex, setCurrentExerciseIndex] = useState(0);
  const [userTranslation, setUserTranslation] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const currentExercise = MOCK_EXERCISES[currentExerciseIndex];
  const totalExercises = MOCK_EXERCISES.length;

  const handleSubmit = () => {
    // Имитация проверки перевода
    // В реальности будет API вызов /lesson/evaluate
    const correctTranslations = currentExercise.targetWords.map(tw => tw.translation.toLowerCase());
    const correct = correctTranslations.some(translation => 
      userTranslation.toLowerCase().includes(translation)
    );
    setIsCorrect(correct);
    setShowResult(true);
  };

  const handleNext = () => {
    // Переход к следующему упражнению
    if (currentExerciseIndex < totalExercises - 1) {
      setCurrentExerciseIndex(currentExerciseIndex + 1);
      setShowResult(false);
      setUserTranslation('');
      setIsCorrect(false);
    } else {
      // Урок завершён
      console.log('Урок завершён!');
      navigate('/dashboard');
    }
  };

  const handleDontKnow = () => {
    // Обработка кнопки "Не знаю"
    // В реальности будет API вызов с dont_know: true
    setIsCorrect(false);
    setShowResult(true);
  };

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
              <span className="font-semibold text-gray-900">Урок 1</span>
            </div>
            <div className="text-sm text-gray-600">
              Упражнение {currentExerciseIndex + 1} / {totalExercises}
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
              {currentExercise.targetWords.map((tw, idx) => (
                <span
                  key={idx}
                  className="px-4 py-2 bg-yellow-100 text-yellow-800 rounded-lg font-medium"
                >
                  {tw.word}
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
                  className="px-6 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Не знаю
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!userTranslation.trim()}
                  className="flex-1 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Проверить
                </button>
              </div>
            </>
          )}

          {/* Result */}
          {showResult && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Status */}
              <div className={`p-6 rounded-xl ${isCorrect ? 'bg-green-50' : 'bg-red-50'}`}>
                <div className="flex items-center gap-3 mb-3">
                  {isCorrect ? (
                    <CheckCircle2 className="text-green-600" size={32} />
                  ) : (
                    <XCircle className="text-red-600" size={32} />
                  )}
                  <h3 className={`text-xl font-bold ${isCorrect ? 'text-green-900' : 'text-red-900'}`}>
                    {isCorrect ? 'Отлично!' : 'Не совсем правильно'}
                  </h3>
                </div>
              </div>

              {/* Reference Translation */}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">
                  Правильный перевод:
                </h4>
                <div className="bg-gray-50 rounded-xl p-4">
                  <p className="text-gray-900">
                    {currentExercise.referenceTranslation}
                  </p>
                </div>
              </div>

              {/* Target Words with Results */}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">
                  Целевые слова:
                </h4>
                <div className="space-y-2">
                  {currentExercise.targetWords.map((tw, idx) => (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl ${
                        isCorrect ? 'bg-green-50' : 'bg-red-50'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">
                          {tw.word}
                        </span>
                        <span className="text-gray-700">{tw.translation}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Next Button */}
              <button
                onClick={handleNext}
                className="w-full px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors"
              >
                {currentExerciseIndex < totalExercises - 1 
                  ? 'Следующее упражнение' 
                  : 'Завершить урок'}
              </button>
            </motion.div>
          )}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
