# Noblelift

Корпоративное приложение для управления задачами, автопарком, справочниками и сотрудниками.

Состав проекта:
- **noblelift-backend** — API на FastAPI (Python), PostgreSQL
- **noblelift-app-main** — клиент на React Native (Expo), веб и мобильные платформы

---

## Требования

- **Node.js** 18+ (для фронтенда)
- **Python** 3.10+ (для бэкенда)
- **PostgreSQL** 14+ (база данных)
- **Git**

---

## 1. Установка PostgreSQL

### Ubuntu / Debian

```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### macOS (Homebrew)

```bash
brew install postgresql@14
brew services start postgresql@14
```

### Windows

Скачайте установщик с [официального сайта PostgreSQL](https://www.postgresql.org/download/windows/) и установите, запомнив пароль пользователя `postgres`.

---

## 2. Создание базы данных

Войдите в PostgreSQL под пользователем `postgres`:

**Linux/macOS:**
```bash
sudo -u postgres psql
```

**Windows:** откройте «SQL Shell (psql)» из меню Пуск и введите пароль `postgres`.

В консоли psql выполните:

```sql
CREATE USER noblelift_user WITH PASSWORD 'ваш_пароль';
CREATE DATABASE noblelift OWNER noblelift_user;
\q
```

Замените `ваш_пароль` на свой пароль. Логин и имя базы можно менять, но тогда их нужно указать в `.env` бэкенда.

---

## 3. Бэкенд (API)

### 3.1. Переход в папку и виртуальное окружение

```bash
cd noblelift-backend
python3 -m venv venv
```

**Активация окружения:**

- Linux/macOS: `source venv/bin/activate`
- Windows: `venv\Scripts\activate`

### 3.2. Установка зависимостей

```bash
pip install -r requirements.txt
```

### 3.3. Настройка переменных окружения

Создайте файл `.env` в папке `noblelift-backend` (можно скопировать из `.env.example`):

```bash
cp .env.example .env
```

Отредактируйте `.env`. Обязательно укажите:

```env
DATABASE_URL=postgresql+psycopg2://noblelift_user:ваш_пароль@localhost:5432/noblelift
JWT_SECRET=ваш_секретный_ключ_для_jwt
```

Остальные параметры можно оставить по умолчанию (см. `.env.example`).

### 3.4. Миграции базы данных

```bash
alembic upgrade head
```

### 3.5. Запуск сервера

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API будет доступен по адресу: **http://localhost:8000**  
Документация: **http://localhost:8000/docs**

---

## 4. Фронтенд (приложение)

### 4.1. Установка зависимостей

Откройте **новый терминал** и перейдите в папку фронтенда:

```bash
cd noblelift-app-main
npm install
```

### 4.2. Настройка URL API

Создайте файл `.env` в папке `noblelift-app-main`:

```env
EXPO_PUBLIC_API_BASE_URL=http://localhost:8000/api/v1
```

Если бэкенд запущен на другом компьютере или порту — укажите его адрес, например:

```env
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.100:8000/api/v1
```

### 4.3. Запуск приложения

```bash
npm start
```

или:

```bash
npx expo start
```

В консоли Expo можно:
- нажать **w** — открыть веб-версию в браузере;
- отсканировать QR-код — открыть в приложении Expo Go на телефоне (телефон и компьютер должны быть в одной сети).

---

## 5. Порядок запуска

1. Запустить PostgreSQL (если не запущен как служба).
2. Запустить бэкенд: из `noblelift-backend` выполнить `uvicorn app.main:app --reload --host 0.0.0.0 --port 8000`.
3. Запустить фронтенд: из `noblelift-app-main` выполнить `npm start` и открыть веб или мобильное приложение.

---

## 6. Структура репозитория

```
noblelift/
├── README.md
├── noblelift-backend/     # API (FastAPI, PostgreSQL, Alembic)
│   ├── app/
│   ├── alembic/
│   ├── requirements.txt
│   ├── .env.example
│   └── .env              # не коммитить, создать локально
└── noblelift-app-main/   # Клиент (Expo, React Native)
    ├── src/
    ├── package.json
    └── .env              # не коммитить, создать локально
```

---

## 7. Первый вход

После первого запуска бэкенда в базе обычно создаются роли и при необходимости начальные данные (зависит от миграций и сидов). Если в системе ещё нет пользователей, их нужно создать через API или добавить скрипт/сид создания первого супер-админа — уточните в проекте наличие таких скриптов или инструкций.

---

## Устранение неполадок

- **Ошибка подключения к БД** — проверьте, что PostgreSQL запущен, а в `.env` указаны верные `DATABASE_URL`, логин и пароль.
- **Фронт не видит API** — убедитесь, что в `.env` фронта указан правильный `EXPO_PUBLIC_API_BASE_URL` и бэкенд запущен на этом адресе и порту.
- **CORS** — бэкенд настроен на разрешение запросов с любых источников; при необходимости ограничьте `CORS_ORIGINS` в настройках приложения.
