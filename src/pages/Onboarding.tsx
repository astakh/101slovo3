import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronRight, ChevronLeft, BookOpen, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const LEVELS = [
  {
    code: 'A1',
    title: 'Начальный',
    description: 'Знакомые фразы, очень простые слова',
    examples: ['hello', 'thank you', 'my name is...'],
  },
  {
    code: 'A2',
    title: 'Элементарный',
    description: 'Простые предложения, повседневные темы',
    examples: ['family', 'shopping', 'daily routine'],
  },
  {
    code: 'B1',
    title: 'Средний',
    description: 'Основные темы, выражение мнения',
    examples: ['travel', 'work', 'current events'],
  },
  {
    code: 'B2',
    title: 'Выше среднего',
    description: 'Сложные тексты, абстрактные темы',
    examples: ['politics', 'science', 'literature'],
  },
];

const TIMEZONES = [
  { value: 'Europe/Kaliningrad', label: 'Калининград (UTC+2)' },
  { value: 'Europe/Moscow', label: 'Москва (UTC+3)' },
  { value: 'Europe/Samara', label: 'Самара (UTC+4)' },
  { value: 'Asia/Yekaterinburg', label: 'Екатеринбург (UTC+5)' },
  { value: 'Asia/Omsk', label: 'Омск (UTC+6)' },
  { value: 'Asia/Krasnoyarsk', label: 'Красноярск (UTC+7)' },
  { value: 'Asia/Irkutsk', label: 'Иркутск (UTC+8)' },
  { value: 'Asia/Yakutsk', label: 'Якутск (UTC+9)' },
  { value: 'Asia/Vladivostok', label: 'Владивосток (UTC+10)' },
  { value: 'Asia/Magadan', label: 'Магадан (UTC+11)' },
];

const DICTIONARIES = [
  { 
    id: 1, 
    code: 'general', 
    name: 'Общий словарь', 
    description: 'Базовая лексика для повседневного общения',
    icon: '📚'
  },
  { 
    id: 2, 
    code: 'business', 
    name: 'Бизнес английский', 
    description: 'Лексика для деловой переписки и переговоров',
    icon: '💼'
  },
  { 
    id: 3, 
    code: 'travel', 
    name: 'Путешествия', 
    description: 'Слова и фразы для поездок за границу',
    icon: '✈️'
  },
  { 
    id: 4, 
    code: 'it', 
    name: 'IT и технологии', 
    description: 'Терминология для IT-специалистов',
    icon: '💻'
  },
];

export default function Onboarding() {
  const navigate = useNavigate();
  const { user, setUser } = useAuth();
  const [step, setStep] = useState(1);
  const [level, setLevel] = useState('');
  const [dictionaryId, setDictionaryId] = useState<number | null>(null);
  const [timezone, setTimezone] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const totalSteps = 4;

  const canProceed = () => {
    if (step === 1) return !!level;
    if (step === 2) return dictionaryId !== null;
    if (step === 3) return !!timezone;
    return true;
  };

  const handleNext = () => {
    if (step < totalSteps) {
      setStep(step + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleComplete = async () => {
    setIsLoading(true);
    try {
      // TODO: Заменить на реальный API вызов
      // await fetch('http://localhost:8000/onboarding/complete', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //     'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
      //   },
      //   body: JSON.stringify({ level, dictionary_id: dictionaryId, timezone }),
      // });

      // Имитация API вызова
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Обновляем статус пользователя
      if (user) {
        setUser({ ...user, is_onboarded: true });
      }

      console.log('✅ Онбординг завершён:', { level, dictionaryId, timezone });
      navigate('/dashboard');
    } catch (error) {
      console.error('❌ Ошибка онбординга:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">101</span>
              </div>
              <span className="font-bold text-xl text-gray-900">slovo</span>
            </div>
          </div>
        </div>
      </header>

      {/* Progress Bar */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              Шаг {step} из {totalSteps}
            </span>
            <span className="text-sm font-medium text-indigo-600">
              {Math.round((step / totalSteps) * 100)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <motion.div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(step / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>

        {/* Step Content */}
        <motion.div
          key={step}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -20 }}
          transition={{ duration: 0.3 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8"
        >
          {step === 1 && (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="text-indigo-600" size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Выберите ваш уровень
                  </h2>
                </div>
                <p className="text-gray-600">
                  Это поможет нам подобрать слова подходящей сложности
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {LEVELS.map((lvl) => (
                  <button
                    key={lvl.code}
                    onClick={() => setLevel(lvl.code)}
                    className={`text-left p-6 rounded-xl border-2 transition-all ${
                      level === lvl.code
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-2xl font-bold text-indigo-600">
                            {lvl.code}
                          </span>
                          <span className="text-sm font-medium text-gray-500">
                            уровень
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900">
                          {lvl.title}
                        </h3>
                      </div>
                      {level === lvl.code && (
                        <CheckCircle2 className="text-indigo-600" size={24} />
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                      {lvl.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {lvl.examples.map((ex) => (
                        <span
                          key={ex}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded"
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <BookOpen className="text-indigo-600" size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Выберите словарь
                  </h2>
                </div>
                <p className="text-gray-600">
                  Словарь определяет набор слов для изучения
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DICTIONARIES.map((dict) => (
                  <button
                    key={dict.id}
                    onClick={() => setDictionaryId(dict.id)}
                    className={`text-left p-6 rounded-xl border-2 transition-all ${
                      dictionaryId === dict.id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="text-4xl">{dict.icon}</div>
                      {dictionaryId === dict.id && (
                        <CheckCircle2 className="text-indigo-600" size={24} />
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {dict.name}
                    </h3>
                    <p className="text-sm text-gray-600">
                      {dict.description}
                    </p>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 bg-indigo-100 rounded-lg flex items-center justify-center">
                    <Clock className="text-indigo-600" size={24} />
                  </div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    Выберите часовой пояс
                  </h2>
                </div>
                <p className="text-gray-600">
                  Это нужно для правильного расчёта стрика и ежедневных лимитов
                </p>
              </div>

              <div className="space-y-2">
                {TIMEZONES.map((tz) => (
                  <button
                    key={tz.value}
                    onClick={() => setTimezone(tz.value)}
                    className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center justify-between ${
                      timezone === tz.value
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <span className="font-medium text-gray-900">{tz.label}</span>
                    {timezone === tz.value && (
                      <CheckCircle2 className="text-indigo-600" size={20} />
                    )}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 4 && (
            <>
              <div className="text-center mb-8">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="text-green-600" size={32} />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-2">
                  Всё готово!
                </h2>
                <p className="text-gray-600">
                  Проверьте выбранные настройки
                </p>
              </div>

              <div className="space-y-4 max-w-md mx-auto">
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">Ваш уровень</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {LEVELS.find((l) => l.code === level)?.title} ({level})
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">Словарь</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {DICTIONARIES.find((d) => d.id === dictionaryId)?.icon}{' '}
                    {DICTIONARIES.find((d) => d.id === dictionaryId)?.name}
                  </div>
                </div>
                <div className="bg-gray-50 rounded-xl p-4">
                  <div className="text-sm text-gray-600 mb-1">Часовой пояс</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {TIMEZONES.find((t) => t.value === timezone)?.label}
                  </div>
                </div>
              </div>
            </>
          )}
        </motion.div>

        {/* Navigation Buttons */}
        <div className="flex items-center justify-between mt-6">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 px-6 py-3 text-gray-600 font-medium rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft size={20} />
            Назад
          </button>

          <button
            onClick={handleNext}
            disabled={!canProceed() || isLoading}
            className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Сохранение...
              </>
            ) : step === totalSteps ? (
              'Начать обучение'
            ) : (
              <>
                Далее
                <ChevronRight size={20} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
