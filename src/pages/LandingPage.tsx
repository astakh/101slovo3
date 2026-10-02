import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Brain, Target, Sparkles, ChevronRight, Menu, X,
  Database, Server, Shield, Layers, CheckCircle2, Circle,
  FileCode, Terminal, ArrowRight, Zap, Globe, Lock,
} from 'lucide-react';

// ========================
// Data
// ========================

const tasks = [
  {
    id: 1,
    title: 'Инициализация проекта и схема БД',
    status: 'done' as const,
    items: [
      { text: 'SQL-миграция 001_init.sql (14 таблиц)', done: true },
      { text: 'Типы данных TypeScript (database.ts)', done: true },
      { text: 'API-клиент с refresh-токенами', done: true },
      { text: 'Лендинг-страница', done: true },
    ],
  },
  {
    id: 2,
    title: 'Каркас FastAPI, конфигурация, пул БД',
    status: 'done' as const,
    items: [
      { text: 'Структура папок (app/, db/, api/, core/, services/, schemas/)', done: true },
      { text: 'Pydantic Settings для .env (config.py)', done: true },
      { text: 'psycopg_pool AsyncConnectionPool (pool.py)', done: true },
      { text: 'Lifespan для startup/shutdown', done: true },
      { text: 'CORS middleware (credentials=True)', done: true },
      { text: 'get_db dependency', done: true },
      { text: 'Кастомные исключения + обработчики', done: true },
      { text: 'Security: JWT, bcrypt, refresh token hashing', done: true },
      { text: 'Заглушки роутеров v1', done: true },
    ],
  },
  {
    id: 3,
    title: 'Аутентификация и Онбординг',
    status: 'done' as const,
    items: [
      { text: 'POST /auth/register (bcrypt, event signup)', done: true },
      { text: 'POST /auth/login (rate limit, verify)', done: true },
      { text: 'POST /auth/refresh (ротация, family_id, защита от кражи)', done: true },
      { text: 'POST /auth/logout (отзыв токена)', done: true },
      { text: 'GET /auth/me (профиль пользователя)', done: true },
      { text: 'POST /onboarding/complete (timezone, level, profile)', done: true },
      { text: 'GET /onboarding/dictionaries', done: true },
      { text: 'In-memory Rate Limiter (IP + email)', done: true },
      { text: 'httpOnly cookie для refresh-токена', done: true },
    ],
  },
  {
    id: 4,
    title: 'Dashboard, Профиль и Настройки',
    status: 'done' as const,
    items: [
      { text: 'GET /dashboard/summary (CTA, resume, resets_at)', done: true },
      { text: 'Алгоритм стрика (п. 5.6 ТЗ)', done: true },
      { text: 'GET /profile/stats (heatmap, accuracy)', done: true },
      { text: 'GET /learning-profile', done: true },
      { text: 'PATCH /learning-profile', done: true },
      { text: 'GET /dictionaries (с количеством слов)', done: true },
      { text: 'PATCH /settings/timezone (лимит 7 дней, идемпотентность)', done: true },
    ],
  },
  {
    id: 5,
    title: 'Подбор слов (Preview) и Отказ от слова (Decline)',
    status: 'done' as const,
    items: [
      { text: 'Детерминированное ранжирование через sha256', done: true },
      { text: 'Кластеризация слов для групп упражнений', done: true },
      { text: 'POST /lesson/preview (алгоритм 5.2)', done: true },
      { text: 'Подбор due-слов и новых слов с учётом уровня', done: true },
      { text: 'POST /lesson/new-word/decline (алгоритм 5.3)', done: true },
      { text: 'Идемпотентность отказа от слова', done: true },
    ],
  },
  {
    id: 6,
    title: 'Клиент GigaChat (LLM-интеграция)',
    status: 'done' as const,
    items: [
      { text: 'GigaTokenManager с OAuth и asyncio.Lock', done: true },
      { text: 'Фоновая задача token_refresh_loop', done: true },
      { text: 'GigaChatClient.chat() (Слой A) с семафором', done: true },
      { text: 'GigaChatClient.chat_json() (Слой B) с извлечением JSON', done: true },
      { text: 'Обработка ошибок: 401, 429, 402, 400, 5xx', done: true },
      { text: 'Логирование вызовов в llm_calls', done: true },
      { text: 'Хелперы generate_sentences() и evaluate_translation()', done: true },
      { text: 'Глобальные обработчики LLM-исключений', done: true },
    ],
  },
  {
    id: 7,
    title: 'Старт урока (POST /lesson/start)',
    status: 'pending' as const,
    items: [
      { text: 'Алгоритм 5.4: идемпотентность через Idempotency-Key', done: false },
      { text: 'Advisory locks для предотвращения гонок', done: false },
      { text: 'Сверка состава слов и кластеризация', done: false },
      { text: 'Вызов LLM для генерации предложений', done: false },
      { text: 'Валидация ответа и частичные повторы', done: false },
      { text: 'Финальная транзакция записи урока', done: false },
    ],
  },
];

const dbTables = [
  { name: 'schema_migrations', desc: 'Версии миграций', icon: '📋' },
  { name: 'users', desc: 'Пользователи', icon: '👤' },
  { name: 'refresh_tokens', desc: 'Refresh токены (ротация)', icon: '🔄' },
  { name: 'dictionaries', desc: 'Словари (general, business...)', icon: '📖' },
  { name: 'words', desc: 'Глобальный справочник слов', icon: '📝' },
  { name: 'learning_profiles', desc: 'Профили обучения', icon: '🎓' },
  { name: 'user_words', desc: 'SRS: слова пользователя', icon: '🧠' },
  { name: 'lessons', desc: 'Уроки', icon: '📚' },
  { name: 'lesson_exercises', desc: 'Упражнения в уроках', icon: '✏️' },
  { name: 'sentence_reports', desc: 'Жалобы на предложения', icon: '🚩' },
  { name: 'prompts', desc: 'Промпты LLM', icon: '💬' },
  { name: 'llm_calls', desc: 'Логи вызовов LLM', icon: '🤖' },
  { name: 'events', desc: 'Продуктовые события', icon: '📊' },
  { name: 'admin_audit_log', desc: 'Аудит администраторов', icon: '🔐' },
];

const apiEndpoints = [
  { method: 'POST', path: '/auth/register', desc: 'Регистрация (bcrypt, event signup)' },
  { method: 'POST', path: '/auth/login', desc: 'Вход (rate limit, verify)' },
  { method: 'POST', path: '/auth/refresh', desc: 'Обновление токенов (ротация, family_id)' },
  { method: 'POST', path: '/auth/logout', desc: 'Выход (отзыв refresh-токена)' },
  { method: 'GET', path: '/auth/me', desc: 'Профиль пользователя' },
  { method: 'POST', path: '/onboarding/complete', desc: 'Завершение онбординга' },
  { method: 'GET', path: '/onboarding/dictionaries', desc: 'Список словарей' },
  { method: 'GET', path: '/dashboard/summary', desc: 'Сводка (CTA, resume, streak)' },
  { method: 'GET', path: '/profile/stats', desc: 'Статистика (heatmap, accuracy)' },
  { method: 'GET', path: '/learning-profile', desc: 'Профиль обучения' },
  { method: 'PATCH', path: '/learning-profile', desc: 'Обновление профиля' },
  { method: 'GET', path: '/dictionaries', desc: 'Список словарей с количеством слов' },
  { method: 'PATCH', path: '/settings/timezone', desc: 'Смена часового пояса (лимит 7 дней)' },
  { method: 'POST', path: '/lesson/preview', desc: 'Подбор слов для урока (алгоритм 5.2)' },
  { method: 'POST', path: '/lesson/new-word/decline', desc: 'Отказ от нового слова (алгоритм 5.3)' },
  { method: 'POST', path: '/lesson/start', desc: 'Начать урок (будет в Задаче 7)' },
  { method: 'GET', path: '/lesson/current', desc: 'Текущий урок (будет в Задаче 7)' },
  { method: 'POST', path: '/lesson/{id}/complete', desc: 'Завершить урок (будет в Задаче 8)' },
  { method: 'POST', path: '/exercises/submit', desc: 'Отправить перевод (будет в Задаче 8)' },
  { method: 'POST', path: '/exercises/dont-know', desc: 'Не знаю (будет в Задаче 8)' },
  { method: 'POST', path: '/exercises/report', desc: 'Жалоба на предложение (будет в Задаче 9)' },
];

const techStack = [
  { name: 'FastAPI', desc: 'Async web framework', icon: Zap, color: 'from-green-400 to-emerald-500' },
  { name: 'psycopg 3', desc: 'Async PostgreSQL driver', icon: Database, color: 'from-blue-400 to-indigo-500' },
  { name: 'PyJWT + bcrypt', desc: 'Auth & security', icon: Lock, color: 'from-red-400 to-rose-500' },
  { name: 'React + Vite', desc: 'Frontend SPA', icon: Globe, color: 'from-cyan-400 to-blue-500' },
  { name: 'GigaChat', desc: 'LLM для предложений', icon: Brain, color: 'from-purple-400 to-violet-500' },
  { name: 'Tailwind CSS', desc: 'Utility-first CSS', icon: Layers, color: 'from-teal-400 to-cyan-500' },
];

// ========================
// Components
// ========================

function Header() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">101</span>
            </div>
            <span className="font-bold text-xl text-gray-900">slovo</span>
            <span className="hidden sm:inline ml-2 px-2 py-0.5 text-xs font-medium bg-green-100 text-green-700 rounded-full">
              dev
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6">
            <a href="#overview" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Обзор</a>
            <a href="#architecture" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Архитектура</a>
            <a href="#database" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">База данных</a>
            <a href="#api" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">API</a>
            <a href="#progress" className="text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">Прогресс</a>
          </nav>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-white border-b border-gray-100"
          >
            <div className="px-4 py-4 space-y-3">
              <a href="#overview" className="block text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Обзор</a>
              <a href="#architecture" className="block text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Архитектура</a>
              <a href="#database" className="block text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>База данных</a>
              <a href="#api" className="block text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>API</a>
              <a href="#progress" className="block text-gray-600 py-2" onClick={() => setMobileMenuOpen(false)}>Прогресс</a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function HeroSection() {
  return (
    <section className="relative overflow-hidden pt-24 pb-16">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50" />
      <div className="absolute top-20 left-10 w-64 h-64 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" />
      <div className="absolute top-40 right-10 w-64 h-64 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-20 animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-center"
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium mb-6">
            <Terminal size={14} />
            Проект в разработке
          </span>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 tracking-tight">
            101<span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">slovo</span>
          </h1>
          <p className="mt-4 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto">
            Интервальное повторение английских слов в контексте предложений,
            сгенерированных нейросетью GigaChat
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {['FastAPI', 'PostgreSQL', 'React', 'TypeScript', 'GigaChat', 'SRS'].map((tag) => (
              <span key={tag} className="px-3 py-1.5 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 font-medium shadow-sm">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function OverviewSection() {
  return (
    <section id="overview" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-8">Стек технологий</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {techStack.map((tech, i) => (
            <motion.div
              key={tech.name}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-100"
            >
              <div className={`w-10 h-10 bg-gradient-to-br ${tech.color} rounded-lg flex items-center justify-center flex-shrink-0`}>
                <tech.icon size={20} className="text-white" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">{tech.name}</p>
                <p className="text-sm text-gray-500">{tech.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ArchitectureSection() {
  return (
    <section id="architecture" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Архитектура бэкенда</h2>
        <p className="text-gray-600 mb-8">Структура FastAPI-приложения</p>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* File tree */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-4 py-3 bg-gray-800 flex items-center gap-2">
              <FileCode size={16} className="text-gray-400" />
              <span className="text-gray-300 text-sm font-mono">backend/app/</span>
            </div>
            <div className="p-4 font-mono text-sm text-gray-700 leading-relaxed">
              <div className="text-indigo-600 font-semibold">app/</div>
              <div className="ml-4">
                <div>├── <span className="text-green-600">main.py</span> <span className="text-gray-400 text-xs"># Точка входа, lifespan</span></div>
                <div>├── <span className="text-green-600">config.py</span> <span className="text-gray-400 text-xs"># Pydantic Settings</span></div>
                <div className="text-indigo-600 font-semibold">├── db/</div>
                <div className="ml-4">│   └── <span className="text-blue-600">pool.py</span> <span className="text-gray-400 text-xs"># AsyncConnectionPool</span></div>
                <div className="text-indigo-600 font-semibold">├── api/</div>
                <div className="ml-4">
                  <div>│   ├── <span className="text-blue-600">deps.py</span> <span className="text-gray-400 text-xs"># get_db, get_current_user</span></div>
                  <div className="text-indigo-600 font-semibold">│   └── v1/</div>
                  <div className="ml-8">
                    <div>├── <span className="text-purple-600">auth.py</span></div>
                    <div>├── <span className="text-purple-600">lessons.py</span></div>
                    <div>├── <span className="text-purple-600">dashboard.py</span></div>
                    <div>├── <span className="text-purple-600">onboarding.py</span></div>
                    <div>└── <span className="text-purple-600">admin.py</span></div>
                  </div>
                </div>
                <div className="text-indigo-600 font-semibold">├── core/</div>
                <div className="ml-4">
                  <div>│   ├── <span className="text-orange-600">security.py</span> <span className="text-gray-400 text-xs"># JWT, bcrypt</span></div>
                  <div>│   └── <span className="text-orange-600">exceptions.py</span> <span className="text-gray-400 text-xs"># Кастомные исключения</span></div>
                </div>
                <div className="text-indigo-600 font-semibold">├── services/</div>
                <div className="ml-4">│   └── <span className="text-gray-400 text-xs"># Бизнес-логика (SRS, LLM)</span></div>
                <div className="text-indigo-600 font-semibold">└── schemas/</div>
                <div className="ml-4">    └── <span className="text-gray-400 text-xs"># Pydantic-модели</span></div>
              </div>
            </div>
          </div>

          {/* Key features */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Database size={16} className="text-blue-600" />
                </div>
                <h3 className="font-semibold text-gray-900">psycopg 3 + Connection Pool</h3>
              </div>
              <p className="text-sm text-gray-600">
                AsyncConnectionPool с min=2, max=10. Строки как dict (dict_row).
                Транзакции управляются вручную (autocommit=False).
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center">
                  <Shield size={16} className="text-green-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Безопасность</h3>
              </div>
              <p className="text-sm text-gray-600">
                bcrypt для паролей. JWT access-токены (HS256). Refresh-токены
                с ротацией и family_id. SHA-256 хеши для хранения.
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                  <Server size={16} className="text-purple-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Lifespan</h3>
              </div>
              <p className="text-sm text-gray-600">
                FastAPI lifespan управляет ресурсами: init_pool() при старте,
                close_pool() при остановке. CORS с credentials=True.
              </p>
            </div>

            <div className="bg-white rounded-xl p-5 border border-gray-200">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-8 h-8 bg-orange-100 rounded-lg flex items-center justify-center">
                  <Layers size={16} className="text-orange-600" />
                </div>
                <h3 className="font-semibold text-gray-900">Исключения</h3>
              </div>
              <p className="text-sm text-gray-600">
                Иерархия: AppError → Unauthorized, Forbidden, NotFound,
                Conflict, ValidationError, RateLimit, LlmError.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function DatabaseSection() {
  return (
    <section id="database" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Схема базы данных</h2>
        <p className="text-gray-600 mb-8">PostgreSQL 14 — 14 таблиц, миграция 001_init.sql</p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {dbTables.map((table, i) => (
            <motion.div
              key={table.name}
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.03 }}
              className="p-3 bg-gray-50 rounded-lg border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 transition-colors"
            >
              <div className="flex items-center gap-2">
                <span className="text-lg">{table.icon}</span>
                <div>
                  <p className="font-mono text-sm font-medium text-gray-900">{table.name}</p>
                  <p className="text-xs text-gray-500">{table.desc}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ApiSection() {
  const methodColors: Record<string, string> = {
    GET: 'bg-green-100 text-green-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-yellow-100 text-yellow-700',
    PATCH: 'bg-orange-100 text-orange-700',
    DELETE: 'bg-red-100 text-red-700',
  };

  return (
    <section id="api" className="py-16 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">API Endpoints</h2>
        <p className="text-gray-600 mb-8">REST API v1 — все маршруты приложения</p>

        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Метод</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Путь</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Описание</th>
                </tr>
              </thead>
              <tbody>
                {apiEndpoints.map((ep, i) => (
                  <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold ${methodColors[ep.method]}`}>
                        {ep.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-900">{ep.path}</td>
                    <td className="px-4 py-3 text-gray-600">{ep.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProgressSection() {
  const totalItems = tasks.reduce((acc, t) => acc + t.items.length, 0);
  const doneItems = tasks.reduce((acc, t) => acc + t.items.filter(i => i.done).length, 0);
  const progress = Math.round((doneItems / totalItems) * 100);

  return (
    <section id="progress" className="py-16 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Прогресс разработки</h2>
        <p className="text-gray-600 mb-8">Задачи MVP и их статус</p>

        {/* Overall progress */}
        <div className="mb-8 p-4 bg-indigo-50 rounded-xl border border-indigo-100">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-indigo-900">Общий прогресс</span>
            <span className="text-sm font-bold text-indigo-700">{doneItems}/{totalItems} ({progress}%)</span>
          </div>
          <div className="w-full h-3 bg-indigo-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 1, ease: 'easeOut' }}
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full"
            />
          </div>
        </div>

        {/* Tasks */}
        <div className="space-y-4">
          {tasks.map((task) => (
            <motion.div
              key={task.id}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="bg-white rounded-xl border border-gray-200 overflow-hidden"
            >
              <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100">
                <div className="flex items-center gap-3">
                  {task.status === 'done' ? (
                    <CheckCircle2 size={20} className="text-green-500" />
                  ) : (
                    <Circle size={20} className="text-gray-300" />
                  )}
                  <div>
                    <p className="font-semibold text-gray-900">
                      Задача {task.id}. {task.title}
                    </p>
                    <p className="text-xs text-gray-500">
                      {task.items.filter(i => i.done).length}/{task.items.length} выполнено
                    </p>
                  </div>
                </div>
                <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                  task.status === 'done'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {task.status === 'done' ? 'Выполнено' : 'В процессе'}
                </span>
              </div>
              <div className="px-5 py-3 space-y-2">
                {task.items.map((item, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {item.done ? (
                      <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                    ) : (
                      <Circle size={14} className="text-gray-300 flex-shrink-0" />
                    )}
                    <span className={`text-sm ${item.done ? 'text-gray-600' : 'text-gray-400'}`}>
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function NextTaskSection() {
  return (
    <section className="py-16 bg-gradient-to-br from-indigo-600 to-purple-600">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-white/90 text-sm font-medium mb-4">
            <ArrowRight size={14} />
            Следующий шаг
          </span>
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
            Задача 7: Старт урока (POST /lesson/start)
          </h2>
          <p className="text-indigo-100 mb-6 max-w-2xl mx-auto">
            Полный алгоритм 5.4: идемпотентность через Idempotency-Key, advisory locks,
            сверка состава, кластеризация, вызов LLM для генерации предложений,
            валидация ответа и финальная транзакция записи урока.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            {['idempotency-key', 'advisory-locks', 'clustering', 'llm-generation'].map((tag) => (
              <span key={tag} className="px-3 py-1.5 bg-white/10 text-white/80 rounded-lg text-sm font-mono">
                {tag}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-xs">101</span>
            </div>
            <span className="font-bold text-white">slovo</span>
          </div>
          <p className="text-sm">
            © 2026 101slovo — Проект в активной разработке
          </p>
        </div>
      </div>
    </footer>
  );
}

// ========================
// Main Page
// ========================

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />
      <main className="pt-16">
        <HeroSection />
        <OverviewSection />
        <ArchitectureSection />
        <DatabaseSection />
        <ApiSection />
        <ProgressSection />
        <NextTaskSection />
      </main>
      <Footer />
    </div>
  );
}
