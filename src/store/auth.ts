/**
 * 101slovo — Auth store (простое состояние авторизации)
 */

type AuthState = {
  isAuthenticated: boolean;
};

type AuthListener = (state: AuthState) => void;

class AuthStore {
  private state: AuthState;
  private listeners: Set<AuthListener> = new Set();

  constructor() {
    this.state = {
      isAuthenticated: !!localStorage.getItem('access_token'),
    };
  }

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.state));
  }

  setAuthenticated(value: boolean) {
    this.state = { ...this.state, isAuthenticated: value };
    this.notify();
  }

  login() {
    this.setAuthenticated(true);
  }

  logout() {
    localStorage.removeItem('access_token');
    this.setAuthenticated(false);
  }
}

export const authStore = new AuthStore();
