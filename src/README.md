# Фронтенд 101slovo

React + TypeScript + Vite + Tailwind CSS

## Структура

```
src/
├── components/
│   └── AuthModal.tsx          # Модальное окно авторизации/регистрации
├── pages/
│   └── LandingPage.tsx        # Главная страница (лендинг)
├── App.tsx                    # Главный компонент
├── main.tsx                   # Точка входа
└── index.css                  # Глобальные стили
```

## Компоненты

### LandingPage
Главная страница с описанием сервиса.

**Секции:**
- **Hero** — заголовок, описание, кнопки "Начать бесплатно" и "Узнать больше"
- **Features** — 4 преимущества сервиса
- **How it works** — 4 шага работы с сервисом
- **CTA** — призыв к действию с кнопкой "Создать аккаунт"

**Функциональность:**
- Кнопка "Начать бесплатно" → открывает модалку регистрации
- Кнопка "Узнать больше" → скроллит к секции "Как это работает"
- Кнопка "Создать аккаунт" → открывает модалку регистрации
- Кнопки "Войти" / "Регистрация" в шапке → открывают соответствующие модалки

### AuthModal
Модальное окно для входа и регистрации.

**Режимы:**
- `login` — форма входа (email + пароль)
- `register` — форма регистрации (email + пароль + подтверждение)

**Функциональность:**
- Валидация полей (email, пароль, подтверждение)
- Переключение между режимами
- Анимации открытия/закрытия
- Индикатор загрузки
- Обработка ошибок

## Запуск

```bash
# Установка зависимостей
npm install

# Dev сервер
npm run dev

# Сборка для production
npm run build

# Предпросмотр production сборки
npm run preview
```

## Авторизация

Реализована полная система авторизации через контекст `AuthContext`.

### Как это работает:

1. **Регистрация/Вход** — пользователь заполняет форму в модальном окне
2. **Сохранение токена** — после успешной авторизации токен сохраняется в `localStorage`
3. **Перенаправление** — пользователь автоматически перенаправляется на `/dashboard`
4. **Защищённые маршруты** — компонент `ProtectedRoute` проверяет наличие токена

### Текущая реализация (заглушка):

Сейчас используется имитация API:
- Принимается любой email с паролем >= 8 символов
- Токен генерируется как `mock_token_{timestamp}`
- Данные пользователя сохраняются в контексте

### Подключение реального API:

В `src/contexts/AuthContext.tsx` замените заглушки на реальные вызовы:

```typescript
const login = async (email: string, password: string) => {
  setLoading(true);
  try {
    const response = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Ошибка авторизации');
    }
    
    const data = await response.json();
    localStorage.setItem('access_token', data.access_token);
    
    // Получить данные пользователя
    const userResponse = await fetch('http://localhost:8000/auth/me', {
      headers: { 'Authorization': `Bearer ${data.access_token}` },
    });
    const userData = await userResponse.json();
    setUser(userData);
  } catch (error) {
    throw error;
  } finally {
    setLoading(false);
  }
};
```

### Маршруты:

- `/` — главная страница (лендинг)
- `/dashboard` — панель пользователя (защищённый маршрут)

### Компоненты:

- `AuthProvider` — оборачивает приложение и предоставляет контекст авторизации
- `ProtectedRoute` — защищает маршруты от неавторизованных пользователей
- `AuthModal` — модальное окно для входа/регистрации
- `useAuth()` — хук для доступа к контексту авторизации

## Стили

Используется Tailwind CSS с кастомной конфигурацией:
- Цветовая схема: indigo/purple
- Градиенты для фонов
- Анимации через Framer Motion
- Адаптивный дизайн (mobile-first)

## Зависимости

- `react` — UI библиотека
- `framer-motion` — анимации
- `lucide-react` — иконки
- `tailwindcss` — утилитарные стили

## Следующие шаги

1. Подключить реальный API
2. Создать страницы:
   - Dashboard (главный экран после входа)
   - Lesson (страница урока)
   - Vocabulary (словарь пользователя)
   - Profile (настройки профиля)
3. Добавить роутинг (React Router)
4. Реализовать управление состоянием (Zustand/Redux)
5. Добавить обработку ошибок и loading states
