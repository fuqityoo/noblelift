# Структура проекта (после рефакторинга)

## Стандартная схема Expo/React Native

```
src/
├── components/       # Переиспользуемые UI-компоненты
│   ├── Badge.tsx     # Бейдж (статус, срок, приоритет)
│   ├── Button.tsx    # Кнопка primary/ghost
│   ├── Card.tsx      # Контейнер-карточка
│   └── TaskCard.tsx  # Карточка задачи (моя / доступная)
├── constants/        # Константы и тема (реэкспорт из ui/theme)
│   └── index.ts
├── hooks/            # Кастомные хуки
│   └── useMyUserId.ts
├── lib/              # API и утилиты
│   ├── api.ts        # api(), getJSON, patchJSON, postJSON, postVoid, login, logout
│   ├── storage.ts    # Кроссплатформенное хранилище токенов
│   └── utils.ts      # formatDate, getStatusCode, getAssigneeId, uniqById, openUrl
├── models/           # Модели данных
│   ├── Task.ts
│   └── User.ts
├── navigation/
│   └── RootNavigator.tsx
├── screens/          # Экраны приложения
│   ├── TasksScreen.tsx
│   ├── AvailableTasksScreen.tsx
│   ├── CreateTaskScreen.tsx
│   ├── LoginScreen.tsx
│   ├── ProfileScreen.tsx
│   ├── DirectoryScreen.tsx
│   ├── ArchiveScreen.tsx
│   └── VehiclesScreen.tsx
├── services/         # Сервисы (бизнес-логика, вызовы API)
│   ├── TaskService.ts
│   ├── taskTopics.ts
│   └── vehicles.ts
├── state/            # Глобальное состояние приложения (задачи, машины, темы)
│   └── AppContext.tsx
├── store/            # Состояние вкладок и авторизация
│   ├── TabContext.tsx  # activeTab, setTab (отдельный контекст для меньших ре-рендеров)
│   └── auth.ts
└── ui/
    └── theme.ts      # Цвета, отступы, радиусы, брейкпоинты
```

## Поток данных

- **TabContext** — только вкладка (tasks / available / create / …). Подписан только RootNavigator → при смене задач/машин навигация не ре-рендерится.
- **AppContext** — задачи, темы, машины, сервис (TaskService), dispatch. Подписаны экраны задач, создания, архива, автопарка.
- **auth** — синглтон: профиль, login/logout, bootstrap. Подписаны App (проверка входа), LoginScreen, AppContext (загрузка данных по userId).

## Оптимизации

- Экраны задач используют общий **TaskCard** и хук **useMyUserId**.
- Общие хелперы: **getJSON**, **patchJSON**, **postJSON**, **postVoid** в `lib/api.ts`; **formatDate**, **getStatusCode**, **openUrl** в `lib/utils.ts`.
- **React.memo** на экранах и на TaskCard для уменьшения ре-рендеров.
- Разделение контекстов (Tab vs App) снижает ре-рендеры навигации при обновлении списка задач.
