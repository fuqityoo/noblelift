# Совместимость с Expo и React Native

Проект собран так, чтобы один код работал в **Expo** на платформах **iOS**, **Android** и **Web** (react-native-web).

## Что сделано для поддержки Expo/RN

### 1. Хранение токенов (не только Web)

- **Раньше:** использовался только `localStorage` (есть только в браузере).
- **Сейчас:** модуль `src/lib/storage.ts`:
  - **Web:** по‑прежнему `localStorage` (синхронно).
  - **iOS/Android:** `@react-native-async-storage/async-storage` с in-memory кэшем; при старте вызывается `initTokenStorage()`, чтобы прочитать токены с диска до первых запросов.

В `auth.bootstrap()` первым делом вызывается `await initTokenStorage()`, затем проверка токенов и запросы к API.

### 2. Зависимость

В `package.json` добавлена зависимость:

```json
"@react-native-async-storage/async-storage": "1.23.1"
```

Установка через Expo:

```bash
npx expo install @react-native-async-storage/async-storage
```

### 3. Платформо-зависимый код

- **Открытие ссылок:** везде используется `Linking` из `react-native`; на Web вызывается `window.open` только при `Platform.OS === 'web'`.
- **Диалоги:** на Web — `alert()`, на iOS/Android — `Alert.alert()` из `react-native`.
- **Форма создания задачи:** дата и файл на Web — нативные `<input type="date">` и `<input type="file">`; на мобильных — только `TextInput` и текст про недоступность загрузки файла.
- **Переменные окружения:** чтение через `globalThis`/`global`, без опоры на `window` при первом обращении.

### 4. Импорты

- Вместо `require('react-native').Linking` и `require('react-native').Alert` везде используются обычные импорты из `react-native`: `Linking`, `Alert`, `Platform` и т.д.

## Запуск под Expo

```bash
npm install
npx expo start
# затем: w — web, i — iOS, a — Android
```

Или сразу платформа:

```bash
npx expo start --web
npx expo start --ios
npx expo start --android
```

Код не использует «голый» native код и не требует eject; достаточно стандартного Expo-проекта.
