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

## API интеграция

Сейчас формы авторизации используют заглушки (имитация API вызова).

**TODO:** Подключить реальные эндпоинты:
- `POST /auth/register` — регистрация
- `POST /auth/login` — вход
- `POST /auth/refresh` — обновление токена
- `POST /auth/logout` — выход

Пример интеграции:
```typescript
const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  
  try {
    const response = await fetch('http://localhost:8000/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    
    if (!response.ok) throw new Error('Ошибка авторизации');
    
    const data = await response.json();
    // Сохранить токены
    localStorage.setItem('access_token', data.access_token);
    
    // Перенаправить на dashboard
    window.location.href = '/dashboard';
  } catch (err) {
    setError('Неверный email или пароль');
  }
};
```

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
