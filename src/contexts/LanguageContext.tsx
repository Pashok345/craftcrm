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
  participantsMenu: { ru: 'Участники', en: 'Participants', uk: 'Учасники' },
  settingsMenu: { ru: 'Настройки', en: 'Settings', uk: 'Налаштування' },
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
  overview: { ru: 'Обзор вашей CRM системы', en: 'Overview of your CRM system', uk: 'Огляд вашої CRM системи' },
  totalTasks: { ru: 'Всего задач', en: 'Total Tasks', uk: 'Усього завдань' },
  completedTasks: { ru: 'Выполнено задач', en: 'Completed Tasks', uk: 'Виконано завдань' },
  totalMessages: { ru: 'Сообщений', en: 'Messages', uk: 'Повідомлень' },
  teamMembers: { ru: 'Сотрудников', en: 'Team Members', uk: 'Співробітників' },
  timeStats: { ru: 'Общее время на задачи', en: 'Total time on tasks', uk: 'Загальний час на завдання' },
  timeStatsDesc: { ru: 'Статистика по времени будет доступна после добавления задач с оценкой времени', en: 'Time statistics will be available after adding tasks with time estimates', uk: 'Статистика за часом буде доступна після додавання завдань з оцінкою часу' },
  
  // Tasks
  tasksTitle: { ru: 'Задачи', en: 'Tasks', uk: 'Завдання' },
  tasksDescription: { ru: 'Управление задачами проекта', en: 'Project task management', uk: 'Керування завданнями проекту' },
  addTask: { ru: 'Добавить задачу', en: 'Add task', uk: 'Додати завдання' },
  list: { ru: 'Список', en: 'List', uk: 'Список' },
  ganttChart: { ru: 'Диаграмма Ганта', en: 'Gantt Chart', uk: 'Діаграма Ганта' },
  kanban: { ru: 'Канбан', en: 'Kanban', uk: 'Канбан' },
  noTasks: { ru: 'Нет задач', en: 'No tasks', uk: 'Немає завдань' },
  createFirstTask: { ru: 'Создайте первую задачу для начала работы', en: 'Create your first task to get started', uk: 'Створіть перше завдання для початку роботи' },
  createTask: { ru: 'Создать задачу', en: 'Create task', uk: 'Створити завдання' },
  
  // Task statuses
  statusTodo: { ru: 'К выполнению', en: 'To Do', uk: 'До виконання' },
  statusInProgress: { ru: 'В работе', en: 'In Progress', uk: 'В роботі' },
  statusReview: { ru: 'На проверке', en: 'In Review', uk: 'На перевірці' },
  statusDone: { ru: 'Выполнено', en: 'Done', uk: 'Виконано' },
  
  // Kanban
  addColumn: { ru: 'Добавить колонку', en: 'Add column', uk: 'Додати колонку' },
  columnName: { ru: 'Название колонки', en: 'Column name', uk: 'Назва колонки' },
  editColumn: { ru: 'Редактировать', en: 'Edit', uk: 'Редагувати' },
  deleteColumn: { ru: 'Удалить', en: 'Delete', uk: 'Видалити' },
  saveColumn: { ru: 'Сохранить', en: 'Save', uk: 'Зберегти' },
  
  // Projects
  projectsTitle: { ru: 'Проекты', en: 'Projects', uk: 'Проекти' },
  projectsDescription: { ru: 'Управление проектами компании', en: 'Company project management', uk: 'Керування проектами компанії' },
  newProject: { ru: 'Новый проект', en: 'New project', uk: 'Новий проект' },
  noProjects: { ru: 'Нет проектов', en: 'No projects', uk: 'Немає проектів' },
  createFirstProject: { ru: 'Создайте первый проект для начала работы', en: 'Create your first project to get started', uk: 'Створіть перший проект для початку роботи' },
  createProject: { ru: 'Создать проект', en: 'Create project', uk: 'Створити проект' },
  
  // Project statuses
  projectPlanning: { ru: 'Планирование', en: 'Planning', uk: 'Планування' },
  projectActive: { ru: 'Активный', en: 'Active', uk: 'Активний' },
  projectOnHold: { ru: 'Приостановлен', en: 'On Hold', uk: 'Призупинено' },
  projectCompleted: { ru: 'Завершён', en: 'Completed', uk: 'Завершено' },
  projectCancelled: { ru: 'Отменён', en: 'Cancelled', uk: 'Скасовано' },
  
  // Meetings
  meetingsTitle: { ru: 'Встречи', en: 'Meetings', uk: 'Зустрічі' },
  meetingsDescription: { ru: 'Календарь встреч и мероприятий', en: 'Calendar of meetings and events', uk: 'Календар зустрічей та заходів' },
  addMeeting: { ru: 'Добавить встречу', en: 'Add meeting', uk: 'Додати зустріч' },
  more: { ru: 'ещё', en: 'more', uk: 'ще' },
  
  // Week days
  mon: { ru: 'Пн', en: 'Mon', uk: 'Пн' },
  tue: { ru: 'Вт', en: 'Tue', uk: 'Вт' },
  wed: { ru: 'Ср', en: 'Wed', uk: 'Ср' },
  thu: { ru: 'Чт', en: 'Thu', uk: 'Чт' },
  fri: { ru: 'Пт', en: 'Fri', uk: 'Пт' },
  sat: { ru: 'Сб', en: 'Sat', uk: 'Сб' },
  sun: { ru: 'Вс', en: 'Sun', uk: 'Нд' },
  
  // Users
  usersTitle: { ru: 'Пользователи', en: 'Users', uk: 'Користувачі' },
  usersDescription: { ru: 'Все пользователи CRM системы', en: 'All CRM system users', uk: 'Усі користувачі CRM системи' },
  addUser: { ru: 'Добавить пользователя', en: 'Add user', uk: 'Додати користувача' },
  noUsers: { ru: 'Нет пользователей', en: 'No users', uk: 'Немає користувачів' },
  usersWillAppear: { ru: 'Пользователи появятся после регистрации', en: 'Users will appear after registration', uk: 'Користувачі зʼявляться після реєстрації' },
  noName: { ru: 'Без имени', en: 'No name', uk: 'Без імені' },
  
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
