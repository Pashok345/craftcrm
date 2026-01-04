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
  settingsDescription: { ru: 'Настройки приложения', en: 'Application settings', uk: 'Налаштування додатку' },
  
  // Profile
  profileTitle: { ru: 'Профиль', en: 'Profile', uk: 'Профіль' },
  profileDescription: { ru: 'Управление профилем и личными данными', en: 'Manage profile and personal data', uk: 'Керування профілем та особистими даними' },
  personalInfo: { ru: 'Личная информация', en: 'Personal information', uk: 'Особиста інформація' },
  profileSaved: { ru: 'Профиль сохранён', en: 'Profile saved', uk: 'Профіль збережено' },
  avatarUploaded: { ru: 'Фото загружено', en: 'Photo uploaded', uk: 'Фото завантажено' },
  errorUploadingAvatar: { ru: 'Ошибка загрузки фото', en: 'Error uploading photo', uk: 'Помилка завантаження фото' },
  
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
  backToTasks: { ru: 'Назад к задачам', en: 'Back to tasks', uk: 'Назад до завдань' },
  taskNotFound: { ru: 'Задача не найдена', en: 'Task not found', uk: 'Завдання не знайдено' },
  deleteTask: { ru: 'Удалить задачу', en: 'Delete task', uk: 'Видалити завдання' },
  deleteTaskConfirm: { ru: 'Вы уверены, что хотите удалить эту задачу? Это действие нельзя отменить.', en: 'Are you sure you want to delete this task? This action cannot be undone.', uk: 'Ви впевнені, що хочете видалити це завдання? Цю дію не можна скасувати.' },
  taskDeleted: { ru: 'Задача удалена', en: 'Task deleted', uk: 'Завдання видалено' },
  dueDate: { ru: 'Срок', en: 'Due date', uk: 'Термін' },
  links: { ru: 'Ссылки', en: 'Links', uk: 'Посилання' },
  executor: { ru: 'исполнитель', en: 'executor', uk: 'виконавець' },
  observer: { ru: 'наблюдатель', en: 'observer', uk: 'спостерігач' },
  comments: { ru: 'Комментарии', en: 'Comments', uk: 'Коментарі' },
  noComments: { ru: 'Нет комментариев', en: 'No comments', uk: 'Немає коментарів' },
  writeComment: { ru: 'Написать комментарий...', en: 'Write a comment...', uk: 'Написати коментар...' },
  commentAdded: { ru: 'Комментарий добавлен', en: 'Comment added', uk: 'Коментар додано' },
  errorAddingComment: { ru: 'Ошибка при добавлении комментария', en: 'Error adding comment', uk: 'Помилка додавання коментаря' },
  
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
  editProject: { ru: 'Редактировать проект', en: 'Edit project', uk: 'Редагувати проект' },
  deleteProject: { ru: 'Удалить проект', en: 'Delete project', uk: 'Видалити проект' },
  deleteProjectConfirm: { ru: 'Вы уверены, что хотите удалить этот проект? Это действие нельзя отменить.', en: 'Are you sure you want to delete this project? This action cannot be undone.', uk: 'Ви впевнені, що хочете видалити цей проект? Цю дію не можна скасувати.' },
  projectDeleted: { ru: 'Проект удалён', en: 'Project deleted', uk: 'Проект видалено' },
  projectUpdated: { ru: 'Проект обновлён', en: 'Project updated', uk: 'Проект оновлено' },
  projectName: { ru: 'Название проекта', en: 'Project name', uk: 'Назва проекту' },
  enterProjectName: { ru: 'Введите название проекта', en: 'Enter project name', uk: 'Введіть назву проекту' },
  description: { ru: 'Описание', en: 'Description', uk: 'Опис' },
  projectDescriptionPlaceholder: { ru: 'Описание проекта...', en: 'Project description...', uk: 'Опис проекту...' },
  status: { ru: 'Статус', en: 'Status', uk: 'Статус' },
  projectManager: { ru: 'Менеджер проекта', en: 'Project manager', uk: 'Менеджер проекту' },
  selectManager: { ru: 'Выберите менеджера', en: 'Select manager', uk: 'Оберіть менеджера' },
  budget: { ru: 'Бюджет', en: 'Budget', uk: 'Бюджет' },
  startDate: { ru: 'Дата начала', en: 'Start date', uk: 'Дата початку' },
  endDate: { ru: 'Дата окончания', en: 'End date', uk: 'Дата закінчення' },
  projectTasks: { ru: 'Задачи проекта', en: 'Project tasks', uk: 'Завдання проекту' },
  noTasksInProject: { ru: 'Нет задач в этом проекте', en: 'No tasks in this project', uk: 'Немає завдань у цьому проекті' },
  total: { ru: 'Всего', en: 'Total', uk: 'Усього' },
  errorUpdating: { ru: 'Ошибка при обновлении', en: 'Error updating', uk: 'Помилка оновлення' },
  errorDeleting: { ru: 'Ошибка при удалении', en: 'Error deleting', uk: 'Помилка видалення' },
  
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
  calendarView: { ru: 'Календарь', en: 'Calendar', uk: 'Календар' },
  dayView: { ru: 'День', en: 'Day', uk: 'День' },
  
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
  
  // Profile form
  fio: { ru: 'ФИО', en: 'Full name', uk: 'ПІБ' },
  enterFio: { ru: 'Введите ФИО', en: 'Enter full name', uk: 'Введіть ПІБ' },
  
  // File attachments
  addFile: { ru: 'Добавить файл', en: 'Add file', uk: 'Додати файл' },
  attachments: { ru: 'Вложения', en: 'Attachments', uk: 'Вкладення' },
  fileUploaded: { ru: 'Файл загружен', en: 'File uploaded', uk: 'Файл завантажено' },
  errorUploadingFile: { ru: 'Ошибка загрузки файла', en: 'Error uploading file', uk: 'Помилка завантаження файлу' },
  
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
