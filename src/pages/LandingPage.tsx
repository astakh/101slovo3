import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Brain, Target, Sparkles, ChevronRight, Menu, X,
  CheckCircle2, ArrowRight,
} from 'lucide-react';
import AuthModal from '../components/AuthModal';

// ========================
// Components
// ========================

function Header({ onLoginClick, onRegisterClick }: { onLoginClick: () => void; onRegisterClick: () => void }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="fixed top-0 left-0 right-0 z-40 bg-white/80 backdrop-blur-lg border-b border-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">101</span>
            </div>
            <span className="font-bold text-xl text-gray-900">slovo</span>
          </div>

          <nav className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">Возможности</a>
            <a href="#how-it-works" className="text-gray-600 hover:text-gray-900 transition-colors">Как это работает</a>
            <button 
              onClick={onLoginClick}
              className="px-4 py-2 text-indigo-600 font-medium hover:bg-indigo-50 rounded-lg transition-colors"
            >
              Войти
            </button>
            <button 
              onClick={onRegisterClick}
              className="px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Регистрация
            </button>
          </nav>

          <button
            className="md:hidden p-2"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
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
              <a href="#features" className="block text-gray-600 hover:text-gray-900 py-2" onClick={() => setMobileMenuOpen(false)}>Возможности</a>
              <a href="#how-it-works" className="block text-gray-600 hover:text-gray-900 py-2" onClick={() => setMobileMenuOpen(false)}>Как это работает</a>
              <div className="pt-3 border-t border-gray-100 flex gap-3">
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onLoginClick();
                  }}
                  className="flex-1 px-4 py-2 text-indigo-600 font-medium border border-indigo-200 rounded-lg"
                >
                  Войти
                </button>
                <button 
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onRegisterClick();
                  }}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white font-medium rounded-lg"
                >
                  Регистрация
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

function HeroSection({ onRegisterClick }: { onRegisterClick: () => void }) {
  const scrollToHowItWorks = () => {
    const element = document.getElementById('how-it-works');
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section className="relative overflow-hidden pt-20 pb-32">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-50 via-white to-purple-50" />
      <div className="absolute top-20 left-10 w-72 h-72 bg-purple-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" />
      <div className="absolute top-40 right-10 w-72 h-72 bg-indigo-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" style={{ animationDelay: '2s' }} />
      <div className="absolute bottom-20 left-1/3 w-72 h-72 bg-pink-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" style={{ animationDelay: '4s' }} />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium mb-6">
              <Sparkles size={16} />
              Учи английский с нейросетью
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl sm:text-6xl lg:text-7xl font-bold text-gray-900 tracking-tight"
          >
            Запоминай слова{' '}
            <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              в контексте
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-6 text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed"
          >
            101slovo — это интервальное повторение английских слов в контексте предложений, 
            сгенерированных нейросетью. Запоминай навсегда, а не на неделю.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <button 
              onClick={onRegisterClick}
              className="group inline-flex items-center gap-2 px-8 py-4 bg-indigo-600 text-white font-semibold rounded-xl shadow-lg shadow-indigo-200 hover:bg-indigo-700 hover:shadow-xl hover:shadow-indigo-200 transition-all duration-200"
            >
              Начать бесплатно
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
            <button 
              onClick={scrollToHowItWorks}
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-gray-700 font-semibold rounded-xl border border-gray-200 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              Узнать больше
            </button>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mt-6 text-sm text-gray-500"
          >
            Бесплатно • Без карты • 5 слов в подарок
          </motion.p>
        </div>

        {/* Demo card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="mt-20 max-w-3xl mx-auto"
        >
          <div className="bg-white rounded-2xl shadow-2xl shadow-indigo-100 border border-gray-100 overflow-hidden">
            <div className="bg-gradient-to-r from-indigo-500 to-purple-500 px-6 py-3 flex items-center gap-2">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-white/30" />
                <div className="w-3 h-3 rounded-full bg-white/30" />
                <div className="w-3 h-3 rounded-full bg-white/30" />
              </div>
              <span className="text-white/80 text-sm ml-2">Урок #12 • Упражнение 3/5</span>
            </div>
            <div className="p-8">
              <p className="text-2xl font-medium text-gray-900 mb-2">
                She <span className="bg-yellow-100 px-1 rounded">achieved</span> her{' '}
                <span className="bg-yellow-100 px-1 rounded">goal</span> through hard work.
              </p>
              <p className="text-sm text-gray-500 mb-6">Переведите выделенные слова на русский:</p>
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-100">
                <p className="text-gray-700">
                  Она <span className="text-indigo-600 font-semibold">достигла</span> своей{' '}
                  <span className="text-indigo-600 font-semibold">цели</span> благодаря усердной работе.
                </p>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                  <CheckCircle2 size={14} /> achieved — достигла
                </span>
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-green-100 text-green-700 text-sm font-medium">
                  <CheckCircle2 size={14} /> goal — цели
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: BookOpen,
      title: 'Слова в контексте',
      description: 'Каждое слово изучается внутри предложения, сгенерированного нейросетью. Вы видите, как слово используется в реальной речи.',
    },
    {
      icon: Brain,
      title: 'Интервальное повторение',
      description: 'Адаптивный алгоритм определяет, когда слово пора повторить. 7 стадий от первого знакомства до полного запоминания.',
    },
    {
      icon: Target,
      title: 'Мгновенная проверка',
      description: 'Нейросеть проверяет ваш перевод и даёт обратную связь. Допускает синонимы, замечает опечатки.',
    },
    {
      icon: Sparkles,
      title: 'Персональные подсказки',
      description: 'После каждого упражнения нейросеть предлагает новые слова из предложения, которые стоит выучить.',
    },
  ];

  return (
    <section id="features" className="py-24 bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Почему <span className="text-indigo-600">101slovo</span> работает
          </h2>
          <p className="mt-4 text-lg text-gray-600 max-w-2xl mx-auto">
            Четыре принципа эффективного изучения слов
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-8">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="bg-white rounded-2xl p-8 shadow-lg shadow-gray-100 border border-gray-100 hover:shadow-xl hover:border-indigo-100 transition-all duration-300"
            >
              <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mb-5">
                <feature.icon size={24} className="text-indigo-600" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">{feature.title}</h3>
              <p className="text-gray-600 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: '01',
      title: 'Выбери уровень',
      description: 'Укажи свой уровень (A1–B2) и получи персональную программу.',
    },
    {
      number: '02',
      title: 'Читай предложение',
      description: 'Нейросеть создаёт предложение с новыми словами на твоём уровне.',
    },
    {
      number: '03',
      title: 'Переведи',
      description: 'Переведи предложение на русский. Оцениваются только целевые слова.',
    },
    {
      number: '04',
      title: 'Получи результат',
      description: 'Нейросеть проверит перевод, а алгоритм запланирует повторение.',
    },
  ];

  return (
    <section id="how-it-works" className="py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900">
            Как это работает
          </h2>
          <p className="mt-4 text-lg text-gray-600">
            Четыре шага к новому слову
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.number}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              className="text-center"
            >
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-indigo-200">
                <span className="text-white font-bold text-lg">{step.number}</span>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTASection({ onRegisterClick }: { onRegisterClick: () => void }) {
  return (
    <section className="py-24 bg-gradient-to-br from-indigo-600 to-purple-600">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Готов учить слова эффективно?
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            Начни прямо сейчас — первые 5 слов бесплатно
          </p>
          <button 
            onClick={onRegisterClick}
            className="group inline-flex items-center gap-2 px-8 py-4 bg-white text-indigo-600 font-semibold rounded-xl shadow-lg hover:bg-indigo-50 transition-all duration-200"
          >
            Создать аккаунт
            <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
          </button>
          <p className="mt-4 text-sm text-indigo-200">
            Бесплатно • Без карты • 5 слов в подарок
          </p>
        </motion.div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">101</span>
            </div>
            <span className="font-bold text-xl text-white">slovo</span>
          </div>
          <p className="text-sm">
            © 2026 101slovo. Учи английский в контексте.
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
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');

  const openLoginModal = () => {
    setAuthMode('login');
    setAuthModalOpen(true);
  };

  const openRegisterModal = () => {
    setAuthMode('register');
    setAuthModalOpen(true);
  };

  const closeAuthModal = () => {
    setAuthModalOpen(false);
  };

  const switchAuthMode = () => {
    setAuthMode(authMode === 'login' ? 'register' : 'login');
  };

  return (
    <div className="min-h-screen bg-white">
      <Header onLoginClick={openLoginModal} onRegisterClick={openRegisterModal} />
      <main className="pt-16">
        <HeroSection onRegisterClick={openRegisterModal} />
        <FeaturesSection />
        <HowItWorksSection />
        <CTASection onRegisterClick={openRegisterModal} />
      </main>
      <Footer />
      
      <AuthModal
        isOpen={authModalOpen}
        onClose={closeAuthModal}
        mode={authMode}
        onSwitchMode={switchAuthMode}
      />
    </div>
  );
}
