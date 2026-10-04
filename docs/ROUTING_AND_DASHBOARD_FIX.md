# 🔧 Исправление роутинга и загрузки данных Dashboard

## Дата
2026-01-15

## Внесённые изменения

### 1. Редирект авторизованных пользователей на Dashboard

**Проблема:** Авторизованные пользователи попадали на лендинг вместо дашборда.

**Решение:** Создан компонент `PublicRoute`, который проверяет статус авторизации и перенаправляет авторизованных пользователей на `/dashboard`.

**Файл:** `src/App.tsx`

```typescript
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (isAuthenticated) {
    // Авторизованные пользователи перенаправляются на дашборд
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

// Использование:
<Route
  path="/"
  element={
    <PublicRoute>
      <LandingPage />
    </PublicRoute>
  }
/>
```

### 2. Редирект неавторизованных пользователей на лендинг

**Проблема:** Неавторизованные пользователи могли получить доступ к защищённым страницам.

**Решение:** Компонент `ProtectedRoute` перенаправляет неавторизованных пользователей на `/` (лендинг).

**Файл:** `src/App.tsx`

```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    // Неавторизованные пользователи перенаправляются на лендинг
    return <Navigate to="/" replace />;
  }
  
  return <>{children}</>;
}

// Использование:
<Route
  path="/dashboard"
  element={
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  }
/>
```

### 3. Загрузка данных Dashboard из API

**Проблема:** Данные на Dashboard были захардкожены и не загружались из базы данных.

**Решение:** Dashboard теперь загружает реальные данные через API endpoint `/dashboard/summary`.

**Файл:** `src/pages/Dashboard.tsx`

```typescript
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
```

**Отображаемые данные из БД:**
- ✅ Количество изученных слов (`dashboard.words.mastered`)
- ✅ Количество уроков сегодня (`dashboard.lessons_today`)
- ✅ Дневной лимит уроков (`dashboard.daily_lesson_limit`)
- ✅ Текущая серия дней (`dashboard.streak.current`)
- ✅ Статус CTA (`dashboard.cta`: start/resume/limit_reached)
- ✅ Информация о незавершённом уроке (`dashboard.resume`)

## Структура роутинга

```
/ (лендинг)
  ├─ Авторизован → редирект на /dashboard
  └─ Не авторизован → показ лендинга

/dashboard
  ├─ Авторизован → показ дашборда (данные из API)
  └─ Не авторизован → редирект на /

/* (все остальные маршруты)
  └─ Редирект на /
```

## Проверка работы

### 1. Неавторизованный пользователь

1. Откройте приложение в новом браузере или очистите localStorage
2. Перейдите на `/dashboard`
3. **Ожидаемое поведение:** Редирект на `/` (лендинг)

### 2. Авторизованный пользователь

1. Зарегистрируйтесь или войдите
2. Перейдите на `/`
3. **Ожидаемое поведение:** Редирект на `/dashboard`

### 3. Данные Dashboard

1. Войдите в аккаунт
2. Откройте `/dashboard`
3. Откройте консоль браузера (F12)
4. **Ожидаемые логи:**
   ```
   ✅ Dashboard loaded: {
     profile: { level: 'A2', dictionary: { id: 1, name: 'General English' } },
     lessons_today: 0,
     daily_lesson_limit: 1,
     words: { active: 0, mastered: 0, ignored: 0 },
     streak: { current: 0, longest: 0, today_done: false },
     cta: 'start'
   }
   ```

### 4. Проверка в БД

```sql
-- Проверьте данные пользователя
SELECT * FROM users WHERE email = 'your@email.com';

-- Проверьте профиль обучения
SELECT * FROM learning_profiles WHERE user_id = YOUR_USER_ID;

-- Проверьте статистику
SELECT COUNT(*) FROM user_words WHERE learning_profile_id = YOUR_PROFILE_ID;
SELECT COUNT(*) FROM lessons WHERE learning_profile_id = YOUR_PROFILE_ID;
```

## API Endpoints

### GET /dashboard/summary

**Заголовки:**
```
Authorization: Bearer <access_token>
```

**Ответ:**
```json
{
  "profile": {
    "level": "A2",
    "dictionary": {
      "id": 1,
      "name": "General English"
    }
  },
  "today": "2026-01-15",
  "lessons_today": 0,
  "daily_lesson_limit": 1,
  "resets_at": "2026-01-16T00:00:00Z",
  "cta": "start",
  "resume": null,
  "words": {
    "active": 0,
    "mastered": 0,
    "ignored": 0
  },
  "streak": {
    "current": 0,
    "longest": 0,
    "today_done": false
  }
}
```

## Созданные файлы

1. `src/contexts/AuthContext.tsx` - контекст авторизации
2. `src/pages/LandingPage.tsx` - лендинг
3. `src/pages/Dashboard.tsx` - дашборд с загрузкой данных из API
4. `src/App.tsx` - роутинг с ProtectedRoute и PublicRoute
5. `src/vite-env.d.ts` - типы для Vite env

## Установленные пакеты

```bash
npm install react-router-dom lucide-react
```

## Статус

✅ Реализован редирект авторизованных пользователей на Dashboard  
✅ Реализован редирект неавторизованных пользователей на лендинг  
✅ Dashboard загружает данные из API `/dashboard/summary`  
✅ Все данные отображаются из базы данных  
✅ Проект успешно собирается  
✅ Готово к тестированию

---

**Версия:** 1.25.0  
**Дата:** 2026-01-15
