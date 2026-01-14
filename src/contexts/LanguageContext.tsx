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
  chats: { ru: 'Чаты', en: 'Chats', uk: 'Чати' },
  employees: { ru: 'Сотрудники', en: 'Employees', uk: 'Співробітники' },
  noEmployees: { ru: 'Нет сотрудников', en: 'No employees', uk: 'Немає співробітників' },
  chatCreated: { ru: 'Чат создан', en: 'Chat created', uk: 'Чат створено' },
  chatWith: { ru: 'Чат с', en: 'Chat with', uk: 'Чат з' },
  error: { ru: 'Ошибка', en: 'Error', uk: 'Помилка' },
  failedToCreateChat: { ru: 'Не удалось создать чат', en: 'Failed to create chat', uk: 'Не вдалося створити чат' },
  
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
  
  // Process run actions
  editProcessRun: { ru: 'Редактировать запуск', en: 'Edit run', uk: 'Редагувати запуск' },
  deleteProcessRun: { ru: 'Удалить запуск', en: 'Delete run', uk: 'Видалити запуск' },
  deleteProcessRunConfirm: { ru: 'Вы уверены, что хотите удалить этот запуск процесса?', en: 'Are you sure you want to delete this process run?', uk: 'Ви впевнені, що хочете видалити цей запуск процесу?' },
  processRunDeleted: { ru: 'Запуск удалён', en: 'Run deleted', uk: 'Запуск видалено' },
  processRunUpdated: { ru: 'Запуск обновлён', en: 'Run updated', uk: 'Запуск оновлено' },
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
