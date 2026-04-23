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
  
  // Theme
  themeTitle: { ru: 'Тема оформления', en: 'Theme', uk: 'Тема оформлення' },
  themeLight: { ru: 'Светлая', en: 'Light', uk: 'Світла' },
  themeDark: { ru: 'Тёмная', en: 'Dark', uk: 'Темна' },
  themeSystem: { ru: 'Системная', en: 'System', uk: 'Системна' },
  
  // Notification settings
  notificationSettings: { ru: 'Уведомления', en: 'Notifications', uk: 'Сповіщення' },
  notifyMeetings: { ru: 'Уведомления о встречах', en: 'Meeting notifications', uk: 'Сповіщення про зустрічі' },
  notifyTasks: { ru: 'Уведомления о задачах', en: 'Task notifications', uk: 'Сповіщення про завдання' },
  notifyMessages: { ru: 'Уведомления о сообщениях', en: 'Message notifications', uk: 'Сповіщення про повідомлення' },
  soundNotifications: { ru: 'Звук уведомлений', en: 'Notification sound', uk: 'Звук сповіщень' },
  
  // Email
  email: { ru: 'Почта', en: 'Email', uk: 'Пошта' },
  enterEmail: { ru: 'Введите e-mail', en: 'Enter email', uk: 'Введіть e-mail' },
  
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
  chats: { ru: 'Чаты', en: 'Chats', uk: 'Чати' },
  employees: { ru: 'Сотрудники', en: 'Employees', uk: 'Співробітники' },
  noEmployees: { ru: 'Нет сотрудников', en: 'No employees', uk: 'Немає співробітників' },
  chatCreated: { ru: 'Чат создан', en: 'Chat created', uk: 'Чат створено' },
  chatWith: { ru: 'Чат с', en: 'Chat with', uk: 'Чат з' },
  error: { ru: 'Ошибка', en: 'Error', uk: 'Помилка' },
  failedToCreateChat: { ru: 'Не удалось создать чат', en: 'Failed to create chat', uk: 'Не вдалося створити чат' },
  deleteChat: { ru: 'Удалить чат', en: 'Delete chat', uk: 'Видалити чат' },
  leaveChat: { ru: 'Покинуть чат', en: 'Leave chat', uk: 'Покинути чат' },
  confirmDeleteChat: { ru: 'Удалить чат?', en: 'Delete chat?', uk: 'Видалити чат?' },
  confirmLeaveChat: { ru: 'Покинуть чат?', en: 'Leave chat?', uk: 'Покинути чат?' },
  deleteWarning: { ru: 'Все сообщения будут удалены безвозвратно.', en: 'All messages will be permanently deleted.', uk: 'Усі повідомлення будуть видалені назавжди.' },
  leaveWarning: { ru: 'Вы больше не сможете видеть сообщения этого чата.', en: 'You will no longer be able to see messages in this chat.', uk: 'Ви більше не зможете бачити повідомлення цього чату.' },
  chatDeleted: { ru: 'Чат удалён', en: 'Chat deleted', uk: 'Чат видалено' },
  leftChat: { ru: 'Вы вышли из чата', en: 'You left the chat', uk: 'Ви вийшли з чату' },
  leave: { ru: 'Покинуть', en: 'Leave', uk: 'Покинути' },
  chatParticipants: { ru: 'Участники чата', en: 'Chat participants', uk: 'Учасники чату' },
  currentMembers: { ru: 'Текущие участники', en: 'Current members', uk: 'Поточні учасники' },
  addParticipants: { ru: 'Добавить участников', en: 'Add participants', uk: 'Додати учасників' },
  membersAdded: { ru: 'Участники добавлены', en: 'Members added', uk: 'Учасників додано' },
  errorAddingMembers: { ru: 'Ошибка при добавлении участников', en: 'Error adding members', uk: 'Помилка додавання учасників' },
  memberRemoved: { ru: 'Участник удалён', en: 'Member removed', uk: 'Учасника видалено' },
  errorRemovingMember: { ru: 'Ошибка при удалении участника', en: 'Error removing member', uk: 'Помилка видалення учасника' },
  cannotRemoveCreator: { ru: 'Нельзя удалить создателя чата', en: 'Cannot remove chat creator', uk: 'Неможливо видалити творця чату' },
  noUsersToAdd: { ru: 'Все пользователи уже добавлены', en: 'All users already added', uk: 'Усіх користувачів вже додано' },
  addSelected: { ru: 'Добавить выбранных', en: 'Add selected', uk: 'Додати обраних' },
  adding: { ru: 'Добавление...', en: 'Adding...', uk: 'Додавання...' },
  creator: { ru: 'Создатель', en: 'Creator', uk: 'Творець' },
  selected: { ru: 'Выбрано', en: 'Selected', uk: 'Обрано' },
  close: { ru: 'Закрыть', en: 'Close', uk: 'Закрити' },
  
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
  executors: { ru: 'Исполнители', en: 'Executors', uk: 'Виконавці' },
  observer: { ru: 'наблюдатель', en: 'observer', uk: 'спостерігач' },
  comments: { ru: 'Комментарии', en: 'Comments', uk: 'Коментарі' },
  noComments: { ru: 'Нет комментариев', en: 'No comments', uk: 'Немає коментарів' },
  writeComment: { ru: 'Написать комментарий...', en: 'Write a comment...', uk: 'Написати коментар...' },
  commentAdded: { ru: 'Комментарий добавлен', en: 'Comment added', uk: 'Коментар додано' },
  errorAddingComment: { ru: 'Ошибка при добавлении комментария', en: 'Error adding comment', uk: 'Помилка додавання коментаря' },
  commentDeleted: { ru: 'Комментарий удален', en: 'Comment deleted', uk: 'Коментар видалено' },
  commentUpdated: { ru: 'Комментарий обновлен', en: 'Comment updated', uk: 'Коментар оновлено' },
  deleteComment: { ru: 'Удалить комментарий', en: 'Delete comment', uk: 'Видалити коментар' },
  deleteCommentConfirm: { ru: 'Вы уверены, что хотите удалить этот комментарий?', en: 'Are you sure you want to delete this comment?', uk: 'Ви впевнені, що хочете видалити цей коментар?' },
  
  // Task statuses
  statusTodo: { ru: 'К выполнению', en: 'To Do', uk: 'До виконання' },
  statusInProgress: { ru: 'В работе', en: 'In Progress', uk: 'В роботі' },
  statusReview: { ru: 'На проверке', en: 'In Review', uk: 'На перевірці' },
  statusDone: { ru: 'Выполнено', en: 'Done', uk: 'Виконано' },
  statusPlanning: { ru: 'Планирование', en: 'Planning', uk: 'Планування' },
  statusActive: { ru: 'Активный', en: 'Active', uk: 'Активний' },
  statusOnHold: { ru: 'Приостановлен', en: 'On hold', uk: 'Призупинено' },
  statusCompleted: { ru: 'Завершён', en: 'Completed', uk: 'Завершено' },
  statusCancelled: { ru: 'Отменён', en: 'Cancelled', uk: 'Скасовано' },
  
  // Kanban
  addColumn: { ru: 'Добавить колонку', en: 'Add column', uk: 'Додати колонку' },
  columnName: { ru: 'Название колонки', en: 'Column name', uk: 'Назва колонки' },
  editColumn: { ru: 'Редактировать', en: 'Edit', uk: 'Редагувати' },
  deleteColumn: { ru: 'Удалить', en: 'Delete', uk: 'Видалити' },
  saveColumn: { ru: 'Сохранить', en: 'Save', uk: 'Зберегти' },
  filterByAssignee: { ru: 'Исполнители', en: 'Assignees', uk: 'Виконавці' },
  noAssignees: { ru: 'Нет исполнителей', en: 'No assignees', uk: 'Немає виконавців' },
  clearFilter: { ru: 'Сбросить фильтр', en: 'Clear filter', uk: 'Скинути фільтр' },
  
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
  createMeeting: { ru: 'Создать встречу', en: 'Create meeting', uk: 'Створити зустріч' },
  editMeeting: { ru: 'Редактировать встречу', en: 'Edit meeting', uk: 'Редагувати зустріч' },
  meetingTitle: { ru: 'Название встречи', en: 'Meeting title', uk: 'Назва зустрічі' },
  enterTitle: { ru: 'Введите название', en: 'Enter title', uk: 'Введіть назву' },
  describeMeeting: { ru: 'Опишите встречу', en: 'Describe the meeting', uk: 'Опишіть зустріч' },
  selectDate: { ru: 'Выберите дату', en: 'Select date', uk: 'Оберіть дату' },
  startTime: { ru: 'Начало', en: 'Start time', uk: 'Початок' },
  endTime: { ru: 'Окончание', en: 'End time', uk: 'Закінчення' },
  meetingCreated: { ru: 'Встреча создана', en: 'Meeting created', uk: 'Зустріч створено' },
  errorCreatingMeeting: { ru: 'Ошибка при создании встречи', en: 'Error creating meeting', uk: 'Помилка створення зустрічі' },
  meetingUpdated: { ru: 'Встреча обновлена', en: 'Meeting updated', uk: 'Зустріч оновлено' },
  errorUpdatingMeeting: { ru: 'Ошибка при обновлении', en: 'Error updating meeting', uk: 'Помилка оновлення зустрічі' },
  cannotSchedulePastTime: { ru: 'Нельзя назначить встречу на прошедшее время', en: 'Cannot schedule a meeting in the past', uk: 'Не можна призначити зустріч на минулий час' },
  meetingInviteTitle: { ru: 'Приглашение на встречу', en: 'Meeting invitation', uk: 'Запрошення на зустріч' },
  meetingInviteMessage: { ru: 'Вас пригласили на встречу', en: 'You have been invited to a meeting', uk: 'Вас запросили на зустріч' },
  at: { ru: 'в', en: 'at', uk: 'о' },
  
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
  add: { ru: 'Добавить', en: 'Add', uk: 'Додати' },
  search: { ru: 'Поиск', en: 'Search', uk: 'Пошук' },
  searchPlaceholder: { ru: 'Поиск...', en: 'Search...', uk: 'Пошук...' },
  sortBy: { ru: 'Сортировка', en: 'Sort by', uk: 'Сортування' },
  sortByDate: { ru: 'По дате', en: 'By date', uk: 'За датою' },
  sortByStatus: { ru: 'По статусу', en: 'By status', uk: 'За статусом' },
  sortByName: { ru: 'По названию', en: 'By name', uk: 'За назвою' },
  createdBy: { ru: 'Создал', en: 'Created by', uk: 'Створив' },
  newest: { ru: 'Сначала новые', en: 'Newest first', uk: 'Спочатку нові' },
  oldest: { ru: 'Сначала старые', en: 'Oldest first', uk: 'Спочатку старі' },
  
  // Assignees
  addParticipant: { ru: 'Добавить участника', en: 'Add participant', uk: 'Додати учасника' },
  role: { ru: 'Роль', en: 'Role', uk: 'Роль' },
  selectUser: { ru: 'Выберите пользователя', en: 'Select user', uk: 'Оберіть користувача' },
  noAvailableUsers: { ru: 'Нет доступных пользователей', en: 'No available users', uk: 'Немає доступних користувачів' },
  assigneeAdded: { ru: 'Участник добавлен', en: 'Participant added', uk: 'Учасника додано' },
  newTaskAssigned: { ru: 'Вас добавили в задачу', en: 'You were added to a task', uk: 'Вас додали до завдання' },
  youWereAddedToTask: { ru: 'Вы добавлены в задачу', en: 'You were added to task', uk: 'Вас додано до завдання' },
  newCommentOnTask: { ru: 'Новый комментарий к задаче', en: 'New comment on task', uk: 'Новий коментар до завдання' },
  
  // Processes
  processes: { ru: 'Процессы', en: 'Processes', uk: 'Процеси' },
  processesTitle: { ru: 'Процессы', en: 'Processes', uk: 'Процеси' },
  processesDescription: { ru: 'Управление бизнес-процессами', en: 'Business process management', uk: 'Керування бізнес-процесами' },
  createProcess: { ru: 'Создать процесс', en: 'Create Process', uk: 'Створити процес' },
  editProcess: { ru: 'Редактировать процесс', en: 'Edit Process', uk: 'Редагувати процес' },
  noProcesses: { ru: 'Нет процессов', en: 'No processes', uk: 'Немає процесів' },
  processName: { ru: 'Название процесса', en: 'Process name', uk: 'Назва процесу' },
  enterProcessName: { ru: 'Введите название', en: 'Enter name', uk: 'Введіть назву' },
  processType: { ru: 'Тип процесса', en: 'Process type', uk: 'Тип процесу' },
  selectType: { ru: 'Выберите тип', en: 'Select type', uk: 'Оберіть тип' },
  noType: { ru: 'Без типа', en: 'No type', uk: 'Без типу' },
  newTypeName: { ru: 'Новый тип...', en: 'New type...', uk: 'Новий тип...' },
  typeAdded: { ru: 'Тип добавлен', en: 'Type added', uk: 'Тип додано' },
  responsibleDepartment: { ru: 'Ответственный отдел', en: 'Responsible department', uk: 'Відповідальний відділ' },
  selectDepartment: { ru: 'Выберите отдел', en: 'Select department', uk: 'Оберіть відділ' },
  newDepartmentName: { ru: 'Новый отдел...', en: 'New department...', uk: 'Новий відділ...' },
  departmentAdded: { ru: 'Отдел добавлен', en: 'Department added', uk: 'Відділ додано' },
  customFields: { ru: 'Пользовательские поля', en: 'Custom fields', uk: 'Користувацькі поля' },
  addField: { ru: 'Добавить поле', en: 'Add field', uk: 'Додати поле' },
  fieldName: { ru: 'Название поля', en: 'Field name', uk: 'Назва поля' },
  fieldTypeText: { ru: 'Строка', en: 'Text', uk: 'Текст' },
  fieldTypeTextarea: { ru: 'Текстовое поле', en: 'Text area', uk: 'Текстове поле' },
  fieldTypeSelect: { ru: 'Список выбора', en: 'Select list', uk: 'Список вибору' },
  selectOptionsPlaceholder: { ru: 'Опции через запятую', en: 'Options comma-separated', uk: 'Опції через кому' },
  fields: { ru: 'Полей', en: 'Fields', uk: 'Полів' },
  runProcess: { ru: 'Запустить', en: 'Run', uk: 'Запустити' },
  processRuns: { ru: 'Запуски процесса', en: 'Process runs', uk: 'Запуски процесу' },
  noProcessRuns: { ru: 'Нет запусков', en: 'No runs', uk: 'Немає запусків' },
  noFieldsToFill: { ru: 'Нет полей для заполнения', en: 'No fields to fill', uk: 'Немає полів для заповнення' },
  startProcess: { ru: 'Запустить процесс', en: 'Start process', uk: 'Запустити процес' },
  selectOption: { ru: 'Выберите...', en: 'Select...', uk: 'Оберіть...' },
  processCreated: { ru: 'Процесс создан', en: 'Process created', uk: 'Процес створено' },
  processUpdated: { ru: 'Процесс обновлён', en: 'Process updated', uk: 'Процес оновлено' },
  processStarted: { ru: 'Процесс запущен', en: 'Process started', uk: 'Процес запущено' },
  processDescriptionPlaceholder: { ru: 'Описание процесса...', en: 'Process description...', uk: 'Опис процесу...' },
  runName: { ru: 'Название запуска', en: 'Run name', uk: 'Назва запуску' },
  enterRunName: { ru: 'Введите название', en: 'Enter name', uk: 'Введіть назву' },
  initiatorDepartment: { ru: 'Отдел-инициатор', en: 'Initiator department', uk: 'Відділ-ініціатор' },
  processInfo: { ru: 'Информация о процессе', en: 'Process info', uk: 'Інформація про процес' },
  processRunNotFound: { ru: 'Запуск процесса не найден', en: 'Process run not found', uk: 'Запуск процесу не знайдено' },
  backToProcesses: { ru: 'Назад к процессам', en: 'Back to processes', uk: 'Назад до процесів' },
  statusUpdated: { ru: 'Статус обновлён', en: 'Status updated', uk: 'Статус оновлено' },
  takeToWork: { ru: 'Взять в работу', en: 'Take to work', uk: 'Взяти в роботу' },
  markComplete: { ru: 'Завершить', en: 'Complete', uk: 'Завершити' },
  info: { ru: 'Информация', en: 'Info', uk: 'Інформація' },
  startedBy: { ru: 'Запустил', en: 'Started by', uk: 'Запустив' },
  startedAt: { ru: 'Дата запуска', en: 'Started at', uk: 'Дата запуску' },
  completedAt: { ru: 'Дата завершения', en: 'Completed at', uk: 'Дата завершення' },
  untitled: { ru: 'Без названия', en: 'Untitled', uk: 'Без назви' },
  status_pending: { ru: 'Ожидает', en: 'Pending', uk: 'Очікує' },
  status_in_progress: { ru: 'В работе', en: 'In Progress', uk: 'В роботі' },
  status_completed: { ru: 'Завершено', en: 'Completed', uk: 'Завершено' },
  status_cancelled: { ru: 'Отменено', en: 'Cancelled', uk: 'Скасовано' },
  
  // Avatar color
  avatarColor: { ru: 'Цвет аватарки', en: 'Avatar color', uk: 'Колір аватарки' },
  avatarColorDescription: { ru: 'Выберите цвет для вашего инициала', en: 'Choose a color for your initials', uk: 'Оберіть колір для ваших ініціалів' },
  
  // Theme
  theme: { ru: 'Тема', en: 'Theme', uk: 'Тема' },
  lightTheme: { ru: 'Светлая', en: 'Light', uk: 'Світла' },
  darkTheme: { ru: 'Тёмная', en: 'Dark', uk: 'Темна' },
  systemTheme: { ru: 'Системная', en: 'System', uk: 'Системна' },

  // Project additions
  reviewer: { ru: 'Проверяющий', en: 'Reviewer', uk: 'Перевіряючий' },
  selectReviewer: { ru: 'Выберите проверяющего', en: 'Select reviewer', uk: 'Оберіть перевіряючого' },
  projectCreated: { ru: 'Проект создан', en: 'Project created', uk: 'Проект створено' },
  projectCreatedDescription: { ru: 'Новый проект успешно добавлен', en: 'New project added successfully', uk: 'Новий проект успішно додано' },
  errorCreating: { ru: 'Ошибка при создании', en: 'Error creating', uk: 'Помилка створення' },
  select: { ru: 'Выберите', en: 'Select', uk: 'Оберіть' },

  // Process comments
  newCommentOnProcess: { ru: 'Новый комментарий к процессу', en: 'New comment on process', uk: 'Новий коментар до процесу' },
  send: { ru: 'Отправить', en: 'Send', uk: 'Надіслати' },

  // Process run statuses
  completed: { ru: 'Завершен', en: 'Completed', uk: 'Завершено' },
  cancelled: { ru: 'Отменен', en: 'Cancelled', uk: 'Скасовано' },
  inProgress: { ru: 'В работе', en: 'In Progress', uk: 'В роботі' },
  pending: { ru: 'Ожидает', en: 'Pending', uk: 'Очікує' },
  showMore: { ru: 'Показать ещё', en: 'Show more', uk: 'Показати ще' },
  showLess: { ru: 'Свернуть', en: 'Show less', uk: 'Згорнути' },

  // Dashboard
  totalProjects: { ru: 'Всего проектов', en: 'Total Projects', uk: 'Всього проектів' },
  completedProjects: { ru: 'Завершено проектов', en: 'Completed Projects', uk: 'Завершено проектів' },
  totalProcesses: { ru: 'Всего процессов', en: 'Total Processes', uk: 'Всього процесів' },
  unreadNotifications: { ru: 'Непрочитанных', en: 'Unread', uk: 'Непрочитаних' },
  tasksByStatus: { ru: 'Задачи по статусам', en: 'Tasks by Status', uk: 'Задачі за статусами' },
  overviewComparison: { ru: 'Общий обзор', en: 'Overview Comparison', uk: 'Загальний огляд' },
  noData: { ru: 'Нет данных', en: 'No data', uk: 'Немає даних' },
  
  // Process description
  processDescription: { ru: 'Описание процесса', en: 'Process Description', uk: 'Опис процесу' },
  noAttachments: { ru: 'Нет вложений', en: 'No attachments', uk: 'Немає вкладень' },
  changeStatus: { ru: 'Изменить статус', en: 'Change status', uk: 'Змінити статус' },

  // Message attachments
  failedToSendMessage: { ru: 'Не удалось отправить сообщение', en: 'Failed to send message', uk: 'Не вдалося надіслати повідомлення' },

  // Dashboard project statuses
  projectsByStatus: { ru: 'Проекты по статусам', en: 'Projects by Status', uk: 'Проекти за статусами' },
  planning: { ru: 'Планирование', en: 'Planning', uk: 'Планування' },
  active: { ru: 'Активный', en: 'Active', uk: 'Активний' },
  onHold: { ru: 'Приостановлен', en: 'On Hold', uk: 'Призупинено' },
  
  // Project filtering
  filterByStatus: { ru: 'Фильтр по статусу', en: 'Filter by status', uk: 'Фільтр за статусом' },
  allProjects: { ru: 'Все проекты', en: 'All projects', uk: 'Всі проекти' },
  activeProjects: { ru: 'Активные', en: 'Active', uk: 'Активні' },
  completedProjectsFilter: { ru: 'Завершённые', en: 'Completed', uk: 'Завершені' },
  
  // Process run actions
  editProcessRun: { ru: 'Редактировать запуск', en: 'Edit run', uk: 'Редагувати запуск' },
  deleteProcessRun: { ru: 'Удалить запуск', en: 'Delete run', uk: 'Видалити запуск' },
  deleteProcessRunConfirm: { ru: 'Вы уверены, что хотите удалить этот запуск процесса?', en: 'Are you sure you want to delete this process run?', uk: 'Ви впевнені, що хочете видалити цей запуск процесу?' },
  processRunDeleted: { ru: 'Запуск удалён', en: 'Run deleted', uk: 'Запуск видалено' },
  processRunUpdated: { ru: 'Запуск обновлён', en: 'Run updated', uk: 'Запуск оновлено' },

  // Analytics
  analytics: { ru: 'Аналитика', en: 'Analytics', uk: 'Аналітика' },
  analyticsTitle: { ru: 'Отчёты и аналитика', en: 'Reports & Analytics', uk: 'Звіти та аналітика' },
  analyticsDescription: { ru: 'Статистика и отчёты по проектам и задачам', en: 'Statistics and reports for projects and tasks', uk: 'Статистика та звіти по проектах та задачах' },
  thisWeek: { ru: 'Эта неделя', en: 'This week', uk: 'Цей тиждень' },
  thisMonth: { ru: 'Этот месяц', en: 'This month', uk: 'Цей місяць' },
  allTime: { ru: 'Всё время', en: 'All time', uk: 'Весь час' },
  timeTracked: { ru: 'Отслежено времени', en: 'Time tracked', uk: 'Відстежено часу' },
  activeProjectsCount: { ru: 'Активных проектов', en: 'Active projects', uk: 'Активних проектів' },
  tagsUsed: { ru: 'Используется тегов', en: 'Tags used', uk: 'Використано тегів' },
  timeByEmployee: { ru: 'Время по сотрудникам', en: 'Time by employee', uk: 'Час за співробітниками' },
  popularTags: { ru: 'Популярные теги', en: 'Popular tags', uk: 'Популярні теги' },
  noTimeEntries: { ru: 'Нет записей времени', en: 'No time entries', uk: 'Немає записів часу' },
  startTrackingTime: { ru: 'Начните отслеживать время в задачах', en: 'Start tracking time in tasks', uk: 'Почніть відстежувати час у задачах' },
  noTags: { ru: 'Нет тегов', en: 'No tags', uk: 'Немає тегів' },
  createTagsHint: { ru: 'Создайте теги для организации задач', en: 'Create tags to organize tasks', uk: 'Створіть теги для організації задач' },
  hours: { ru: 'ч', en: 'h', uk: 'г' },
  minutes: { ru: 'м', en: 'm', uk: 'хв' },
  hoursShort: { ru: 'ч', en: 'h', uk: 'г' },
  minutesShort: { ru: 'м', en: 'm', uk: 'хв' },
  
  // User analytics
  selectEmployee: { ru: 'Выберите сотрудника', en: 'Select employee', uk: 'Оберіть співробітника' },
  allEmployees: { ru: 'Все сотрудники', en: 'All employees', uk: 'Всі співробітники' },
  projectsCount: { ru: 'Проектов', en: 'Projects', uk: 'Проектів' },
  commentsCount: { ru: 'Комментариев', en: 'Comments', uk: 'Коментарів' },
  meetingsCount: { ru: 'Совещаний', en: 'Meetings', uk: 'Нарад' },
  tagsCreated: { ru: 'Создано тегов', en: 'Tags created', uk: 'Створено тегів' },
  avgCompletionDays: { ru: 'Среднее время выполнения', en: 'Avg completion time', uk: 'Середній час виконання' },
  days: { ru: 'дн.', en: 'days', uk: 'дн.' },
  overviewTab: { ru: 'Обзор', en: 'Overview', uk: 'Огляд' },
  tasksPerProject: { ru: 'Задачи по проектам', en: 'Tasks per project', uk: 'Задачі по проектах' },
  taskStatistics: { ru: 'Статистика задач', en: 'Task statistics', uk: 'Статистика задач' },
  totalTimeTracked: { ru: 'Всего отслежено времени', en: 'Total time tracked', uk: 'Всього відстежено часу' },
  timeEntriesCount: { ru: 'Записей времени', en: 'Time entries', uk: 'Записів часу' },
  avgEntryDuration: { ru: 'Средняя длительность записи', en: 'Avg entry duration', uk: 'Середня тривалість запису' },

  // Time tracking
  timeTracking: { ru: 'Учёт времени', en: 'Time tracking', uk: 'Облік часу' },
  timerStarted: { ru: 'Таймер запущен', en: 'Timer started', uk: 'Таймер запущено' },
  timerStopped: { ru: 'Таймер остановлен', en: 'Timer stopped', uk: 'Таймер зупинено' },
  start: { ru: 'Старт', en: 'Start', uk: 'Старт' },
  stop: { ru: 'Стоп', en: 'Stop', uk: 'Стоп' },
  whatAreYouWorkingOn: { ru: 'Над чем работаете?', en: 'What are you working on?', uk: 'Над чим працюєте?' },
  durationMinutes: { ru: 'Минуты', en: 'Minutes', uk: 'Хвилини' },
  timeAdded: { ru: 'Время добавлено', en: 'Time added', uk: 'Час додано' },
  timeEntryDeleted: { ru: 'Запись удалена', en: 'Entry deleted', uk: 'Запис видалено' },
  invalidDuration: { ru: 'Некорректная длительность', en: 'Invalid duration', uk: 'Невірна тривалість' },
  timerInProgress: { ru: 'В процессе', en: 'In progress', uk: 'В процесі' },

  // Tags
  tagsAndLabels: { ru: 'Теги и метки', en: 'Tags & Labels', uk: 'Теги та мітки' },
  addTag: { ru: 'Добавить тег', en: 'Add tag', uk: 'Додати тег' },
  selectTag: { ru: 'Выберите тег', en: 'Select tag', uk: 'Оберіть тег' },
  tagName: { ru: 'Название тега', en: 'Tag name', uk: 'Назва тегу' },
  tagCreated: { ru: 'Тег создан', en: 'Tag created', uk: 'Тег створено' },
  createNewTag: { ru: 'Создать новый тег', en: 'Create new tag', uk: 'Створити новий тег' },
  deleteTag: { ru: 'Удалить тег?', en: 'Delete tag?', uk: 'Видалити тег?' },
  deleteTagConfirm: { ru: 'Тег будет удалён из всех задач. Это действие нельзя отменить.', en: 'Tag will be removed from all tasks. This action cannot be undone.', uk: 'Тег буде видалено з усіх задач. Цю дію неможливо скасувати.' },
  tagDeleted: { ru: 'Тег удалён', en: 'Tag deleted', uk: 'Тег видалено' },

  // Export
  exportReport: { ru: 'Экспорт отчёта', en: 'Export Report', uk: 'Експорт звіту' },
  exportPDF: { ru: 'Скачать PDF', en: 'Download PDF', uk: 'Завантажити PDF' },
  exportExcel: { ru: 'Скачать Excel', en: 'Download Excel', uk: 'Завантажити Excel' },
  reportGenerated: { ru: 'Отчёт сгенерирован', en: 'Report generated', uk: 'Звіт згенеровано' },
  reportTitle: { ru: 'Аналитический отчёт CRM', en: 'CRM Analytics Report', uk: 'Аналітичний звіт CRM' },
  generatedAt: { ru: 'Сгенерировано', en: 'Generated at', uk: 'Згенеровано' },
  summary: { ru: 'Сводка', en: 'Summary', uk: 'Зведення' },
  tasksList: { ru: 'Список задач', en: 'Tasks List', uk: 'Список задач' },
  projectsList: { ru: 'Список проектов', en: 'Projects List', uk: 'Список проектів' },
  timeEntriesList: { ru: 'Записи времени', en: 'Time Entries', uk: 'Записи часу' },
  noDeadline: { ru: 'Без срока', en: 'No deadline', uk: 'Без терміну' },
  noBudget: { ru: 'Без бюджета', en: 'No budget', uk: 'Без бюджету' },
  noDescription: { ru: 'Без описания', en: 'No description', uk: 'Без опису' },
  filters: { ru: 'Фильтры', en: 'Filters', uk: 'Фільтри' },
  activeFilters: { ru: 'Фильтры', en: 'Filters', uk: 'Фільтри' },
  tags: { ru: 'Теги', en: 'Tags', uk: 'Теги' },
  from: { ru: 'От', en: 'From', uk: 'Від' },
  to: { ru: 'До', en: 'To', uk: 'До' },
  manualSort: { ru: 'Вручную', en: 'Manual', uk: 'Вручну' },
  hotkeys: { ru: 'Горячие клавиши', en: 'Hotkeys', uk: 'Гарячі клавіші' },
  hotkeysHint: { ru: 'Нажмите для подсказок по горячим клавишам', en: 'Click to view keyboard shortcuts', uk: 'Натисніть для підказок по гарячих клавішах' },
  taskTitle: { ru: 'Название задачи', en: 'Task title', uk: 'Назва завдання' },
  project: { ru: 'Проект', en: 'Project', uk: 'Проект' },
  deadline: { ru: 'Дедлайн', en: 'Deadline', uk: 'Дедлайн' },
  createdAt: { ru: 'Дата создания', en: 'Created', uk: 'Дата створення' },
  totalCount: { ru: 'Всего', en: 'Total', uk: 'Усього' },

  // User invitations
  sendInvitation: { ru: 'Отправить приглашение', en: 'Send invitation', uk: 'Надіслати запрошення' },
  sendInvite: { ru: 'Отправить', en: 'Send', uk: 'Надіслати' },
  name: { ru: 'Имя', en: 'Name', uk: 'Імʼя' },
  invitationSent: { ru: 'Приглашение отправлено', en: 'Invitation sent', uk: 'Запрошення надіслано' },
  invitationSentDescription: { ru: 'Письмо с ссылкой для входа отправлено на {email}', en: 'An email with login link has been sent to {email}', uk: 'Лист із посиланням для входу надіслано на {email}' },
  invitationError: { ru: 'Не удалось отправить приглашение', en: 'Failed to send invitation', uk: 'Не вдалося надіслати запрошення' },
  userAlreadyExists: { ru: 'Пользователь с таким email уже существует', en: 'User with this email already exists', uk: 'Користувач з такою поштою вже існує' },
  invitationNote: { ru: 'Пользователь получит письмо со ссылкой для входа. После входа ему нужно будет установить пароль и указать должность. Аккаунт станет активным после верификации администратором.', en: 'User will receive an email with login link. After logging in, they need to set password and position. Account will be active after admin verification.', uk: 'Користувач отримає лист із посиланням для входу. Після входу потрібно встановити пароль та вказати посаду. Акаунт стане активним після верифікації адміністратором.' },
  fillRequiredFields: { ru: 'Заполните все обязательные поля', en: 'Fill all required fields', uk: 'Заповніть усі обовʼязкові поля' },
  
  // User profile dialog
  userProfile: { ru: 'Профиль пользователя', en: 'User Profile', uk: 'Профіль користувача' },
  userVerified: { ru: 'Пользователь верифицирован', en: 'User verified', uk: 'Користувача верифіковано' },
  verificationRevoked: { ru: 'Верификация отозвана', en: 'Verification revoked', uk: 'Верифікацію скасовано' },
  verificationError: { ru: 'Ошибка изменения верификации', en: 'Verification error', uk: 'Помилка верифікації' },
  adminGranted: { ru: 'Права админа выданы', en: 'Admin rights granted', uk: 'Права адміністратора надано' },
  adminRevoked: { ru: 'Права админа отозваны', en: 'Admin rights revoked', uk: 'Права адміністратора скасовано' },
  roleError: { ru: 'Ошибка изменения прав', en: 'Role change error', uk: 'Помилка зміни прав' },
  userDeleted: { ru: 'Пользователь удалён', en: 'User deleted', uk: 'Користувача видалено' },
  deleteError: { ru: 'Ошибка удаления', en: 'Delete error', uk: 'Помилка видалення' },
  invitationResent: { ru: 'Приглашение отправлено повторно', en: 'Invitation resent', uk: 'Запрошення надіслано повторно' },
  profileUpdated: { ru: 'Профиль обновлён', en: 'Profile updated', uk: 'Профіль оновлено' },
  administrator: { ru: 'Администратор', en: 'Administrator', uk: 'Адміністратор' },
  invitationSentBadge: { ru: 'Отправлено приглашение', en: 'Invitation sent', uk: 'Надіслано запрошення' },
  verified: { ru: 'Верифицирован', en: 'Verified', uk: 'Верифіковано' },
  notVerified: { ru: 'Не верифицирован', en: 'Not verified', uk: 'Не верифіковано' },
  userEmail: { ru: 'Почта', en: 'Email', uk: 'Пошта' },
  verification: { ru: 'Верификация', en: 'Verification', uk: 'Верифікація' },
  adminRights: { ru: 'Права администратора', en: 'Admin rights', uk: 'Права адміністратора' },
  resendInvitation: { ru: 'Отправить повторно', en: 'Resend invitation', uk: 'Надіслати повторно' },
  deleteUserTitle: { ru: 'Видалити користувача?', en: 'Delete user?', uk: 'Видалити користувача?' },
  deleteUserConfirm: { ru: 'Вы уверены, что хотите удалить пользователя {name}? Это действие нельзя отменить.', en: 'Are you sure you want to delete user {name}? This action cannot be undone.', uk: 'Ви впевнені, що хочете видалити користувача {name}? Цю дію не можна скасувати.' },
  no: { ru: 'Нет', en: 'No', uk: 'Ні' },
  yesDelete: { ru: 'Да, удалить', en: 'Yes, delete', uk: 'Так, видалити' },
  
  // Sales
  sales: { ru: 'Продажи', en: 'Sales', uk: 'Продажі' },
  salesTitle: { ru: 'Продажи', en: 'Sales', uk: 'Продажі' },
  salesDescription: { ru: 'Управление сделками и клиентами', en: 'Deal and client management', uk: 'Керування угодами та клієнтами' },
  salesFunnel: { ru: 'Воронка продаж', en: 'Sales Funnel', uk: 'Воронка продажів' },
  clients: { ru: 'Клиенты', en: 'Clients', uk: 'Клієнти' },
  proposals: { ru: 'Коммерческие предложения', en: 'Proposals', uk: 'Комерційні пропозиції' },
  
  // Deals
  totalDeals: { ru: 'Всего сделок', en: 'Total deals', uk: 'Усього угод' },
  totalAmount: { ru: 'Общая сумма', en: 'Total amount', uk: 'Загальна сума' },
  addDeal: { ru: 'Добавить сделку', en: 'Add deal', uk: 'Додати угоду' },
  editDeal: { ru: 'Редактировать сделку', en: 'Edit deal', uk: 'Редагувати угоду' },
  dealTitle: { ru: 'Название сделки', en: 'Deal title', uk: 'Назва угоди' },
  enterDealTitle: { ru: 'Введите название сделки', en: 'Enter deal title', uk: 'Введіть назву угоди' },
  amount: { ru: 'Сумма', en: 'Amount', uk: 'Сума' },
  expectedCloseDate: { ru: 'Ожидаемая дата закрытия', en: 'Expected close date', uk: 'Очікувана дата закриття' },
  client: { ru: 'Клиент', en: 'Client', uk: 'Клієнт' },
  selectClient: { ru: 'Выберите клиента', en: 'Select client', uk: 'Оберіть клієнта' },
  noClient: { ru: 'Без клиента', en: 'No client', uk: 'Без клієнта' },
  stage: { ru: 'Этап', en: 'Stage', uk: 'Етап' },
  probability: { ru: 'Вероятность', en: 'Probability', uk: 'Ймовірність' },
  dealDescriptionPlaceholder: { ru: 'Описание сделки...', en: 'Deal description...', uk: 'Опис угоди...' },
  dealCreated: { ru: 'Сделка создана', en: 'Deal created', uk: 'Угоду створено' },
  dealUpdated: { ru: 'Сделка обновлена', en: 'Deal updated', uk: 'Угоду оновлено' },
  dealDeleted: { ru: 'Сделка удалена', en: 'Deal deleted', uk: 'Угоду видалено' },
  deleteDeal: { ru: 'Удалить сделку', en: 'Delete deal', uk: 'Видалити угоду' },
  deleteDealConfirm: { ru: 'Вы уверены, что хотите удалить эту сделку?', en: 'Are you sure you want to delete this deal?', uk: 'Ви впевнені, що хочете видалити цю угоду?' },
  
  // Stages
  addStage: { ru: 'Добавить этап', en: 'Add stage', uk: 'Додати етап' },
  editStage: { ru: 'Редактировать этап', en: 'Edit stage', uk: 'Редагувати етап' },
  stageName: { ru: 'Название этапа', en: 'Stage name', uk: 'Назва етапу' },
  enterStageName: { ru: 'Введите название этапа', en: 'Enter stage name', uk: 'Введіть назву етапу' },
  stageColor: { ru: 'Цвет этапа', en: 'Stage color', uk: 'Колір етапу' },
  stageCreated: { ru: 'Этап создан', en: 'Stage created', uk: 'Етап створено' },
  stageUpdated: { ru: 'Этап обновлён', en: 'Stage updated', uk: 'Етап оновлено' },
  
  // Deal Comments
  unknownUser: { ru: 'Неизвестный пользователь', en: 'Unknown user', uk: 'Невідомий користувач' },
  
  // Clients
  noClients: { ru: 'Нет клиентов', en: 'No clients', uk: 'Немає клієнтів' },
  addFirstClient: { ru: 'Добавьте первого клиента', en: 'Add your first client', uk: 'Додайте першого клієнта' },
  addClient: { ru: 'Добавить клиента', en: 'Add client', uk: 'Додати клієнта' },
  editClient: { ru: 'Редактировать клиента', en: 'Edit client', uk: 'Редагувати клієнта' },
  clientName: { ru: 'Имя клиента', en: 'Client name', uk: 'Імʼя клієнта' },
  enterClientName: { ru: 'Введите имя клиента', en: 'Enter client name', uk: 'Введіть імʼя клієнта' },
  company: { ru: 'Компания', en: 'Company', uk: 'Компанія' },
  companyName: { ru: 'Название компании', en: 'Company name', uk: 'Назва компанії' },
  clientPosition: { ru: 'Должность клиента', en: 'Client position', uk: 'Посада клієнта' },
  notes: { ru: 'Заметки', en: 'Notes', uk: 'Нотатки' },
  clientNotesPlaceholder: { ru: 'Заметки о клиенте...', en: 'Notes about client...', uk: 'Нотатки про клієнта...' },
  searchClients: { ru: 'Поиск клиентов...', en: 'Search clients...', uk: 'Пошук клієнтів...' },
  clientCreated: { ru: 'Клиент добавлен', en: 'Client created', uk: 'Клієнта додано' },
  clientUpdated: { ru: 'Клиент обновлён', en: 'Client updated', uk: 'Клієнта оновлено' },
  clientDeleted: { ru: 'Клиент удалён', en: 'Client deleted', uk: 'Клієнта видалено' },
  deleteClient: { ru: 'Удалить клиента', en: 'Delete client', uk: 'Видалити клієнта' },
  deleteClientConfirm: { ru: 'Вы уверены, что хотите удалить этого клиента?', en: 'Are you sure you want to delete this client?', uk: 'Ви впевнені, що хочете видалити цього клієнта?' },
  interactionHistory: { ru: 'История взаимодействий', en: 'Interaction history', uk: 'Історія взаємодій' },
  clientDeals: { ru: 'Сделки клиента', en: 'Client deals', uk: 'Угоди клієнта' },
  noInteractions: { ru: 'Нет взаимодействий', en: 'No interactions', uk: 'Немає взаємодій' },
  noDealsForClient: { ru: 'Нет сделок для этого клиента', en: 'No deals for this client', uk: 'Немає угод для цього клієнта' },
  noAmount: { ru: 'Сумма не указана', en: 'No amount', uk: 'Суму не вказано' },
  interactionDescription: { ru: 'Описание взаимодействия...', en: 'Interaction description...', uk: 'Опис взаємодії...' },
  interactionAdded: { ru: 'Взаимодействие добавлено', en: 'Interaction added', uk: 'Взаємодію додано' },
  
  // Proposals
  noProposals: { ru: 'Нет предложений', en: 'No proposals', uk: 'Немає пропозицій' },
  createFirstProposal: { ru: 'Создайте первое коммерческое предложение', en: 'Create your first proposal', uk: 'Створіть першу комерційну пропозицію' },
  createProposal: { ru: 'Создать предложение', en: 'Create proposal', uk: 'Створити пропозицію' },
  editProposal: { ru: 'Редактировать предложение', en: 'Edit proposal', uk: 'Редагувати пропозицію' },
  proposalTitle: { ru: 'Название предложения', en: 'Proposal title', uk: 'Назва пропозиції' },
  enterProposalTitle: { ru: 'Введите название', en: 'Enter title', uk: 'Введіть назву' },
  searchProposals: { ru: 'Поиск предложений...', en: 'Search proposals...', uk: 'Пошук пропозицій...' },
  validUntil: { ru: 'Действительно до', en: 'Valid until', uk: 'Дійсне до' },
  deal: { ru: 'Сделка', en: 'Deal', uk: 'Угода' },
  selectDeal: { ru: 'Выберите сделку', en: 'Select deal', uk: 'Оберіть угоду' },
  noDeal: { ru: 'Без сделки', en: 'No deal', uk: 'Без угоди' },
  proposalDraft: { ru: 'Черновик', en: 'Draft', uk: 'Чернетка' },
  proposalSent: { ru: 'Отправлено', en: 'Sent', uk: 'Надіслано' },
  proposalAccepted: { ru: 'Принято', en: 'Accepted', uk: 'Прийнято' },
  proposalRejected: { ru: 'Отклонено', en: 'Rejected', uk: 'Відхилено' },
  proposalItems: { ru: 'Позиции предложения', en: 'Proposal items', uk: 'Позиції пропозиції' },
  addItem: { ru: 'Добавить позицию', en: 'Add item', uk: 'Додати позицію' },
  itemName: { ru: 'Название', en: 'Name', uk: 'Назва' },
  quantity: { ru: 'Кол-во', en: 'Qty', uk: 'Кількість' },
  price: { ru: 'Цена', en: 'Price', uk: 'Ціна' },
  proposalCreated: { ru: 'Предложение создано', en: 'Proposal created', uk: 'Пропозицію створено' },
  proposalUpdated: { ru: 'Предложение обновлено', en: 'Proposal updated', uk: 'Пропозицію оновлено' },
  proposalDeleted: { ru: 'Предложение удалено', en: 'Proposal deleted', uk: 'Пропозицію видалено' },
  deleteProposal: { ru: 'Удалить предложение', en: 'Delete proposal', uk: 'Видалити пропозицію' },
  deleteProposalConfirm: { ru: 'Вы уверены, что хотите удалить это предложение?', en: 'Are you sure you want to delete this proposal?', uk: 'Ви впевнені, що хочете видалити цю пропозицію?' },
  downloadPDF: { ru: 'Скачать PDF', en: 'Download PDF', uk: 'Завантажити PDF' },
  commercialProposal: { ru: 'Коммерческое предложение', en: 'Commercial Proposal', uk: 'Комерційна пропозиція' },
  date: { ru: 'Дата', en: 'Date', uk: 'Дата' },
  pdfGenerated: { ru: 'PDF сгенерирован', en: 'PDF generated', uk: 'PDF згенеровано' },
  
  // Stage reordering
  stagesReordered: { ru: 'Порядок этапов изменён', en: 'Stages reordered', uk: 'Порядок етапів змінено' },
  
  // Funnel analytics
  revenueForecast: { ru: 'Прогноз выручки', en: 'Revenue forecast', uk: 'Прогноз виручки' },
  avgDealCycle: { ru: 'Средний цикл сделки', en: 'Avg deal cycle', uk: 'Середній цикл угоди' },
  stageConversion: { ru: 'Конверсия по этапам', en: 'Stage conversion', uk: 'Конверсія за етапами' },
  conversion: { ru: 'Конверсия', en: 'Conversion', uk: 'Конверсія' },
  amountByStage: { ru: 'Сумма по этапам', en: 'Amount by stage', uk: 'Сума за етапами' },
  dealDistribution: { ru: 'Распределение сделок', en: 'Deal distribution', uk: 'Розподіл угод' },
  funnelAnalytics: { ru: 'Аналитика воронки', en: 'Funnel analytics', uk: 'Аналітика воронки' },
  
  // Client import/export
  importCSV: { ru: 'Импорт CSV', en: 'Import CSV', uk: 'Імпорт CSV' },
  exportCSV: { ru: 'Экспорт CSV', en: 'Export CSV', uk: 'Експорт CSV' },
  importSuccess: { ru: 'Импорт завершён', en: 'Import completed', uk: 'Імпорт завершено' },
  importError: { ru: 'Ошибка импорта', en: 'Import error', uk: 'Помилка імпорту' },
  exportSuccess: { ru: 'Файл экспортирован', en: 'File exported', uk: 'Файл експортовано' },
  
  // Subtasks
  subtasks: { ru: 'Подзадачи', en: 'Subtasks', uk: 'Підзавдання' },
  addSubtask: { ru: 'Добавить подзадачу...', en: 'Add subtask...', uk: 'Додати підзавдання...' },
  
  // Message reactions & mentions
  reactionAdded: { ru: 'Реакция добавлена', en: 'Reaction added', uk: 'Реакцію додано' },
  mentionedYou: { ru: 'упомянул вас', en: 'mentioned you', uk: 'згадав вас' },
  mentionInChat: { ru: 'Упоминание в чате', en: 'Mention in chat', uk: 'Згадка в чаті' },
  mentionInComment: { ru: 'Упоминание в комментарии', en: 'Mention in comment', uk: 'Згадка в коментарі' },
  mentionedYouInComment: { ru: 'упомянул вас в комментарии', en: 'mentioned you in a comment', uk: 'згадав вас у коментарі' },
  
  // Proposal enhancements
  uploadFile: { ru: 'Загрузить файл', en: 'Upload file', uk: 'Завантажити файл' },
  uploading: { ru: 'Загрузка...', en: 'Uploading...', uk: 'Завантаження...' },
  attachmentUploaded: { ru: 'Файл загружен', en: 'File uploaded', uk: 'Файл завантажено' },
  attachmentDeleted: { ru: 'Файл удалён', en: 'File deleted', uk: 'Файл видалено' },
  sendProposalEmail: { ru: 'Отправить КП на e-mail', en: 'Send proposal via email', uk: 'Надіслати КП на e-mail' },
  clientEmailRequired: { ru: 'У клиента не указан e-mail', en: 'Client email is required', uk: 'У клієнта не вказано e-mail' },
  proposalSentSuccess: { ru: 'КП отмечено как отправленное', en: 'Proposal marked as sent', uk: 'КП позначено як надіслане' },
  sentTo: { ru: 'Отправлено на', en: 'Sent to', uk: 'Надіслано на' },
  // Global search
  globalSearchPlaceholder: { ru: 'Поиск по задачам, проектам, клиентам, сделкам...', en: 'Search tasks, projects, clients, deals...', uk: 'Пошук по завданнях, проектах, клієнтах, угодах...' },
  noResults: { ru: 'Ничего не найдено', en: 'No results found', uk: 'Нічого не знайдено' },
  deals: { ru: 'Сделки', en: 'Deals', uk: 'Угоди' },
  
  // Favorites
  noFavorites: { ru: 'Нет избранных элементов', en: 'No favorites yet', uk: 'Немає обраних елементів' },
  addToFavorites: { ru: 'Добавить в избранное', en: 'Add to favorites', uk: 'Додати до обраного' },
  removeFromFavorites: { ru: 'Убрать из избранного', en: 'Remove from favorites', uk: 'Видалити з обраного' },
  
  // Dashboard customization
  customize: { ru: 'Настроить', en: 'Customize', uk: 'Налаштувати' },
  done: { ru: 'Готово', en: 'Done', uk: 'Готово' },
  toggleWidgets: { ru: 'Включить/выключить виджеты', en: 'Toggle widgets', uk: 'Увімкнути/вимкнути віджети' },
  
  // Recurring tasks
  recurringTasks: { ru: 'Повторяющиеся задачи', en: 'Recurring tasks', uk: 'Повторювані завдання' },
  createTemplate: { ru: 'Создать шаблон', en: 'Create template', uk: 'Створити шаблон' },
  editTemplate: { ru: 'Редактировать шаблон', en: 'Edit template', uk: 'Редагувати шаблон' },
  templateTitle: { ru: 'Название шаблона', en: 'Template title', uk: 'Назва шаблону' },
  recurrenceType: { ru: 'Периодичность', en: 'Recurrence', uk: 'Періодичність' },
  daily: { ru: 'Ежедневно', en: 'Daily', uk: 'Щоденно' },
  weekly: { ru: 'Еженедельно', en: 'Weekly', uk: 'Щотижнево' },
  monthly: { ru: 'Ежемесячно', en: 'Monthly', uk: 'Щомісяця' },
  interval: { ru: 'Интервал', en: 'Interval', uk: 'Інтервал' },
  templateActive: { ru: 'Активный', en: 'Active', uk: 'Активний' },

  // Whiteboards (Доски)
  whiteboards: { ru: 'Доски', en: 'Boards', uk: 'Дошки' },
  whiteboardsTitle: { ru: 'Доски', en: 'Boards', uk: 'Дошки' },
  whiteboardsDescription: {
    ru: 'Создавайте доски, схемы и диаграммы как в Miro',
    en: 'Create boards, schemes and diagrams Miro-style',
    uk: 'Створюйте дошки, схеми та діаграми як у Miro',
  },
  newWhiteboard: { ru: 'Новая доска', en: 'New board', uk: 'Нова дошка' },
  createWhiteboard: { ru: 'Создать доску', en: 'Create board', uk: 'Створити дошку' },
  whiteboardTitle: { ru: 'Название доски', en: 'Board title', uk: 'Назва дошки' },
  whiteboardDescriptionLabel: { ru: 'Описание', en: 'Description', uk: 'Опис' },
  whiteboardLinkProject: { ru: 'Привязать к проекту', en: 'Link to project', uk: 'Привʼязати до проєкту' },
  whiteboardNoProject: { ru: 'Без проекта (личная)', en: 'No project (personal)', uk: 'Без проєкту (особиста)' },
  myWhiteboards: { ru: 'Мои доски', en: 'My boards', uk: 'Мої дошки' },
  projectWhiteboards: { ru: 'Доски проектов', en: 'Project boards', uk: 'Дошки проєктів' },
  sharedWhiteboards: { ru: 'Совместные', en: 'Shared with me', uk: 'Спільні' },
  whiteboardEmpty: { ru: 'Досок пока нет', en: 'No boards yet', uk: 'Дошок поки немає' },
  whiteboardEmptyHint: {
    ru: 'Создайте первую доску, чтобы начать рисовать схемы',
    en: 'Create your first board to start drawing',
    uk: 'Створіть першу дошку, щоб почати малювати',
  },
  whiteboardDeleted: { ru: 'Доска удалена', en: 'Board deleted', uk: 'Дошку видалено' },
  whiteboardCreated: { ru: 'Доска создана', en: 'Board created', uk: 'Дошку створено' },
  whiteboardSaved: { ru: 'Сохранено', en: 'Saved', uk: 'Збережено' },
  whiteboardSaving: { ru: 'Сохранение...', en: 'Saving...', uk: 'Збереження...' },
  whiteboardLoadError: {
    ru: 'Не удалось загрузить доску',
    en: 'Failed to load board',
    uk: 'Не вдалося завантажити дошку',
  },
  whiteboardSaveError: {
    ru: 'Не удалось сохранить изменения',
    en: 'Failed to save changes',
    uk: 'Не вдалося зберегти зміни',
  },
  whiteboardMembers: { ru: 'Участники', en: 'Members', uk: 'Учасники' },
  whiteboardAddMember: { ru: 'Добавить участника', en: 'Add member', uk: 'Додати учасника' },
  whiteboardRoleEditor: { ru: 'Редактор', en: 'Editor', uk: 'Редактор' },
  whiteboardRoleViewer: { ru: 'Наблюдатель', en: 'Viewer', uk: 'Спостерігач' },
  whiteboardOwner: { ru: 'Владелец', en: 'Owner', uk: 'Власник' },
  whiteboardReadOnly: {
    ru: 'У вас доступ только для просмотра',
    en: 'You have view-only access',
    uk: 'У вас доступ лише для перегляду',
  },
  whiteboardConfirmDelete: {
    ru: 'Удалить доску? Это действие необратимо.',
    en: 'Delete board? This cannot be undone.',
    uk: 'Видалити дошку? Цю дію неможливо скасувати.',
  },
  whiteboardSearchUser: { ru: 'Найти сотрудника...', en: 'Find user...', uk: 'Знайти співробітника...' },
  whiteboardLastEdited: { ru: 'Изменена', en: 'Edited', uk: 'Змінено' },
};

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

// Default context value to prevent crashes during React error recovery
const defaultLanguageContext: LanguageContextType = {
  language: 'uk',
  setLanguage: () => {},
  t: (key: string) => {
    const translation = translations[key];
    return translation?.uk || key;
  },
};

const LanguageContext = createContext<LanguageContextType>(defaultLanguageContext);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('app-language');
    return (saved as Language) || 'uk';
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
  return useContext(LanguageContext);
};
