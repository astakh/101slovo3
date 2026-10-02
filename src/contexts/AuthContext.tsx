import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface User {
  id: number;
  email: string;
  is_onboarded: boolean;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Проверяем наличие токена при загрузке
    const token = localStorage.getItem('access_token');
    if (token) {
      // TODO: Проверить валидность токена через API
      // Пока просто устанавливаем заглушку
      setUser({
        id: 1,
        email: 'user@example.com',
        is_onboarded: true,
      });
    }
  }, []);

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      // TODO: Заменить на реальный API вызов
      // const response = await fetch('http://localhost:8000/auth/login', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password }),
      // });
      
      // Имитация API вызова
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Заглушка: принимаем любой email с паролем >= 8 символов
      if (password.length < 8) {
        throw new Error('Неверный email или пароль');
      }

      // Сохраняем токен
      localStorage.setItem('access_token', 'mock_token_' + Date.now());
      
      // Устанавливаем пользователя
      setUser({
        id: 1,
        email: email,
        is_onboarded: false, // Новый пользователь должен пройти онбординг
      });
      
      console.log('✅ Успешный вход:', email);
    } catch (error) {
      console.error('❌ Ошибка входа:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (email: string, password: string) => {
    setLoading(true);
    try {
      // TODO: Заменить на реальный API вызов
      // const response = await fetch('http://localhost:8000/auth/register', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ email, password }),
      // });
      
      // Имитация API вызова
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Сохраняем токен
      localStorage.setItem('access_token', 'mock_token_' + Date.now());
      
      // Устанавливаем пользователя
      setUser({
        id: 1,
        email: email,
        is_onboarded: false, // Новый пользователь должен пройти онбординг
      });
      
      console.log('✅ Успешная регистрация:', email);
    } catch (error) {
      console.error('❌ Ошибка регистрации:', error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('access_token');
    setUser(null);
    console.log('✅ Выход выполнен');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
