import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type Language = 'ru' | 'en' | 'uk';

interface Translations {
  [key: string]: {
    ru: string;
    en: string;
    uk: string;
  };
}

export const translations: Translations = {
  // Navigation
  dashboard: { ru: 'Дашборд', en: 'Dashboard', uk: 'Дашборд' },
  projects: { ru: 'Проекты', en: 'Projects', uk: 'Проекти' },
  tasks: { ru: 'Задачи', en: 'Tasks', uk: 'Завдання' },
  meetings: { ru: 'Встречи', en: 'Meetings', uk: 'Зустрічі' },
  users: { ru: 'Пользователи', en: 'Users', uk: 'Користувачі' },
  messages: { ru: 'Сообщения', en: 'Messages', uk: 'Повідомлення' },
  
  // Header
  profile: { ru: 'Профиль', en: 'Profile', uk: 'Профіль' },
  settings: { ru: 'Настройки', en: 'Settings', uk: 'Налаштування' },
  logout: { ru: 'Выйти', en: 'Logout', uk: 'Вийти' },
  user: { ru: 'Пользователь', en: 'User', uk: 'Користувач' },
  
  // Settings
  settingsTitle: { ru: 'Настройки', en: 'Settings', uk: 'Налаштування' },
  settingsDescription: { ru: 'Управление профилем и настройками аккаунта', en: 'Manage profile and account settings', uk: 'Керування профілем та налаштуваннями акаунту' },
  fullName: { ru: 'ФИО', en: 'Full Name', uk: 'ПІБ' },
  phone: { ru: 'Телефон', en: 'Phone', uk: 'Телефон' },
  position: { ru: 'Должность', en: 'Position', uk: 'Посада' },
  selectPosition: { ru: 'Выберите должность', en: 'Select position', uk: 'Оберіть посаду' },
  additionalInfo: { ru: 'Дополнительная информация', en: 'Additional information', uk: 'Додаткова інформація' },
  additionalInfoPlaceholder: { ru: 'Любая дополнительная информация о вас...', en: 'Any additional information about you...', uk: 'Будь-яка додаткова інформація про вас...' },
  saveChanges: { ru: 'Сохранить изменения', en: 'Save changes', uk: 'Зберегти зміни' },
  settingsSaved: { ru: 'Настройки сохранены', en: 'Settings saved', uk: 'Налаштування збережено' },
  errorSaving: { ru: 'Ошибка при сохранении', en: 'Error saving', uk: 'Помилка збереження' },
  enterName: { ru: 'Введите ваше имя', en: 'Enter your name', uk: 'Введіть ваше імʼя' },
  
  // Language
  language: { ru: 'Язык', en: 'Language', uk: 'Мова' },
  russian: { ru: 'Русский', en: 'Russian', uk: 'Російська' },
  english: { ru: 'Английский', en: 'English', uk: 'Англійська' },
  ukrainian: { ru: 'Украинский', en: 'Ukrainian', uk: 'Українська' },
  
  // Notifications
  notifications: { ru: 'Уведомления', en: 'Notifications', uk: 'Сповіщення' },
  noNotifications: { ru: 'Нет уведомлений', en: 'No notifications', uk: 'Немає сповіщень' },
  markAllRead: { ru: 'Отметить все как прочитанные', en: 'Mark all as read', uk: 'Позначити все як прочитане' },
  
  // Messages
  messagesTitle: { ru: 'Сообщения', en: 'Messages', uk: 'Повідомлення' },
  noChats: { ru: 'Нет чатов', en: 'No chats', uk: 'Немає чатів' },
  createFirstChat: { ru: 'Создать первый чат', en: 'Create first chat', uk: 'Створити перший чат' },
  searchChats: { ru: 'Поиск чатов...', en: 'Search chats...', uk: 'Пошук чатів...' },
  typeMessage: { ru: 'Введите сообщение...', en: 'Type a message...', uk: 'Введіть повідомлення...' },
  selectChatToStart: { ru: 'Выберите чат, чтобы начать общение', en: 'Select a chat to start messaging', uk: 'Оберіть чат, щоб почати спілкування' },
  newChat: { ru: 'Новый чат', en: 'New chat', uk: 'Новий чат' },
  createChat: { ru: 'Создать чат', en: 'Create chat', uk: 'Створити чат' },
  chatName: { ru: 'Название чата', en: 'Chat name', uk: 'Назва чату' },
  chatDescription: { ru: 'Описание', en: 'Description', uk: 'Опис' },
  participants: { ru: 'Участники', en: 'Participants', uk: 'Учасники' },
  cancel: { ru: 'Отмена', en: 'Cancel', uk: 'Скасувати' },
  create: { ru: 'Создать', en: 'Create', uk: 'Створити' },
  
  // Positions
  director: { ru: 'Директор', en: 'Director', uk: 'Директор' },
  manager: { ru: 'Менеджер', en: 'Manager', uk: 'Менеджер' },
  developer: { ru: 'Разработчик', en: 'Developer', uk: 'Розробник' },
  designer: { ru: 'Дизайнер', en: 'Designer', uk: 'Дизайнер' },
  analyst: { ru: 'Аналитик', en: 'Analyst', uk: 'Аналітик' },
  accountant: { ru: 'Бухгалтер', en: 'Accountant', uk: 'Бухгалтер' },
  hr: { ru: 'HR', en: 'HR', uk: 'HR' },
  other: { ru: 'Другое', en: 'Other', uk: 'Інше' },
  
  // Dashboard
  welcomeBack: { ru: 'С возвращением', en: 'Welcome back', uk: 'З поверненням' },
  overview: { ru: 'Обзор вашей активности', en: 'Your activity overview', uk: 'Огляд вашої активності' },
  totalProjects: { ru: 'Всего проектов', en: 'Total Projects', uk: 'Усього проектів' },
  activeTasks: { ru: 'Активных задач', en: 'Active Tasks', uk: 'Активних завдань' },
  upcomingMeetings: { ru: 'Предстоящие встречи', en: 'Upcoming Meetings', uk: 'Майбутні зустрічі' },
  teamMembers: { ru: 'Участников команды', en: 'Team Members', uk: 'Учасників команди' },
  recentTasks: { ru: 'Последние задачи', en: 'Recent Tasks', uk: 'Останні завдання' },
  
  // Common
  loading: { ru: 'Загрузка...', en: 'Loading...', uk: 'Завантаження...' },
  save: { ru: 'Сохранить', en: 'Save', uk: 'Зберегти' },
  delete: { ru: 'Удалить', en: 'Delete', uk: 'Видалити' },
  edit: { ru: 'Редактировать', en: 'Edit', uk: 'Редагувати' },
  close: { ru: 'Закрыть', en: 'Close', uk: 'Закрити' },
  add: { ru: 'Добавить', en: 'Add', uk: 'Додати' },
  search: { ru: 'Поиск', en: 'Search', uk: 'Пошук' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved as Language) || 'ru';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('app-language', lang);
  };

  const t = (key: string): string => {
    const translation = translations[key];
    if (!translation) {
      console.warn(`Translation not found for key: ${key}`);
      return key;
    }
    return translation[language] || translation.ru || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
