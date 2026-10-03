import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

interface User {
  id: number;
  email: string;
  is_onboarded: boolean;
  timezone?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
  loading: boolean;
  setUser: (user: User | null) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Проверяем наличие токена при загрузке
    const token = localStorage.getItem('access_token');
    if (token) {
      // Проверяем валидность токена через API
      fetchUser(token);
    }
  }, []);

  const fetchUser = async (token: string) => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Токен невалиден, удаляем его
        localStorage.removeItem('access_token');
        setUser(null);
      }
    } catch (error) {
      console.error('Ошибка проверки токена:', error);
      localStorage.removeItem('access_token');
      setUser(null);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Неверный email или пароль');
      }

      const data = await response.json();
      
      // Сохраняем токен
      localStorage.setItem('access_token', data.access_token);
      
      // Получаем данные пользователя
      await fetchUser(data.access_token);
      
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
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Ошибка регистрации');
      }

      const data = await response.json();
      
      // Сохраняем токен
      localStorage.setItem('access_token', data.access_token);
      
      // Получаем данные пользователя
      await fetchUser(data.access_token);
      
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
        setUser,
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
