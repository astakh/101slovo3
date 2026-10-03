import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, CheckCircle2, XCircle, BookOpen } from 'lucide-react';

// Пример данных упражнения (в реальности будет приходить с API)
const MOCK_EXERCISE = {
  id: 1,
  sentence: 'She achieved her goal through hard work.',
  targetWords: [
    { word: 'achieved', translation: 'достигла' },
    { word: 'goal', translation: 'цели' },
  ],
  referenceTranslation: 'Она достигла своей цели благодаря упорному труду.',
};

export default function Lesson() {
  const navigate = useNavigate();
  const [userTranslation, setUserTranslation] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);

  const handleSubmit = () => {
    // Имитация проверки перевода
    // В реальности будет API вызов /lesson/evaluate
    const correct = userTranslation.toLowerCase().includes('достиг') && 
                    userTranslation.toLowerCase().includes('цел');
    setIsCorrect(correct);
    setShowResult(true);
  };

  const handleNext = () => {
    // Переход к следующему упражнению
    // В реальности будет загрузка следующего упражнения
    setShowResult(false);
    setUserTranslation('');
    console.log('Переход к следующему упражнению');
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
              Упражнение 1 / 5
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8"
        >
          {/* Sentence */}
          <div className="mb-8">
            <h2 className="text-sm font-medium text-gray-600 mb-3">
              Переведите предложение:
            </h2>
            <div className="bg-indigo-50 rounded-xl p-6">
              <p className="text-2xl font-medium text-gray-900">
                {MOCK_EXERCISE.sentence}
              </p>
            </div>
          </div>

          {/* Target Words */}
          <div className="mb-8">
            <h3 className="text-sm font-medium text-gray-600 mb-3">
              Целевые слова:
            </h3>
            <div className="flex flex-wrap gap-2">
              {MOCK_EXERCISE.targetWords.map((tw, idx) => (
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
                    {MOCK_EXERCISE.referenceTranslation}
                  </p>
                </div>
              </div>

              {/* Target Words with Results */}
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-2">
                  Целевые слова:
                </h4>
                <div className="space-y-2">
                  {MOCK_EXERCISE.targetWords.map((tw, idx) => (
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
                Следующее упражнение
              </button>
            </motion.div>
          )}
        </motion.div>
      </main>
    </div>
  );
}
