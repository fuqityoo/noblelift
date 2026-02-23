# Users (`users`)
| Поле          | Тип                 | Обяз. | По умолчанию | Описание                              |
|---------------|---------------------|-------|--------------|---------------------------------------|
| id            | bigserial (PK)      | ✔     | —            | Уникальный идентификатор пользователя |
| email         | text (unique)       | ✔     | —            | Почта для логина                      |
| phone         | text                | ✖     | —            | Номер телефона                        |
| password_hash | text                | ✔     | —            | Хэш пароля                            |
| full_name     | text                | ✔     | —            | ФИО                                   |
| title         | text                | ✖     | —            | Должность                             |
| avatar_url    | text                | ✖     | —            | Фото                                  |
| role_id       | int (FK → roles.id) | ✔     | —            | Роль доступа                          |
| is_active     | boolean             | ✔     | true         | Активен ли пользователь               |
| created_at    | timestamptz         | ✔     | now()        | Дата создания                         |

# Roles (`roles`)
| Поле | Тип           | Обяз. | По умолчанию | Описание                             |
|------|---------------|-------|--------------|--------------------------------------|
| id   | serial (PK)   | ✔     | —            | Идентификатор роли                   |
| code | text (unique) | ✔     | —            | `super_admin`, `manager`, `employee` |
| name | text          | ✔     | —            | Название роли                        |

# Profiles (`profiles`)
| Поле           | Тип                        | Обяз. | По умолчанию | Описание                                   |
|----------------|----------------------------|-------|--------------|--------------------------------------------|
| user_id        | bigint (PK, FK → users.id) | ✔     | —            | Один профиль на пользователя               |
| status_id      | int (FK → statuses.id)     | ✔     | —            | Текущий статус                             |
| status_payload | jsonb                      | ✖     | —            | Доп. данные (периоды отпуск/командировка)  |
| links          | jsonb                      | ✖     | —            | Контакты: telegram, whatsapp, email, phone |
| arrived_at     | timestamptz                | ✖     | —            | Время прихода                              |
| last_seen_at   | timestamptz                | ✖     | —            | Последняя активность                       |

# Statuses (`statuses`)
| Поле      | Тип           | Обяз. | По умолчанию | Описание                                                                        |
|-----------|---------------|-------|--------------|---------------------------------------------------------------------------------|
| id        | serial (PK)   | ✔     | —            | Идентификатор статуса                                                           |
| code      | text (unique) | ✔     | —            | `in_office`, `remote`, `away`, `meeting`, `dayoff`, `business_trip`, `vacation` |
| name      | text          | ✔     | —            | Название статуса                                                                |
| is_active | boolean       | ✔     | true         | Признак активности                                                              |

# Refresh Tokens (`refresh_tokens`)
| Поле       | Тип                    | Обяз. | По умолчанию | Описание         |
|------------|------------------------|-------|--------------|------------------|
| id         | bigserial (PK)         | ✔     | —            | Идентификатор    |
| user_id    | bigint (FK → users.id) | ✔     | —            | Пользователь     |
| token      | text (unique)          | ✔     | —            | Токен обновления |
| expires_at | timestamptz            | ✔     | —            | Время истечения  |
| user_agent | text                   | ✖     | —            | Клиент           |
| created_at | timestamptz            | ✔     | now()        | Дата выдачи      |
| revoked_at | timestamptz            | ✖     | —            | Дата отзыва      |

# Task Topics (`task_topics`)
| Поле      | Тип           | Обяз. | По умолчанию | Описание           |
|-----------|---------------|-------|--------------|--------------------|
| id        | serial (PK)   | ✔     | —            | Идентификатор темы |
| name      | text (unique) | ✔     | —            | Название темы      |
| is_active | boolean       | ✔     | true         | Активна ли тема    |

# Tasks (`tasks`)
| Поле        | Тип                  | Обяз. | По умолчанию | Описание                             |
|-------------|----------------------|-------|--------------|--------------------------------------|
| id          | bigserial (PK)       | ✔     | —            | Идентификатор                        |
| creator_id  | bigint FK → users    | ✔     | —            | Создатель                            |
| assignee_id | bigint FK → users    | ✖     | NULL         | Исполнитель                          |
| title       | text                 | ✔     | —            | Название                             |
| content     | text                 | ✖     | —            | Описание                             |
| due_date    | timestamptz          | ✖     | —            | Дедлайн                              |
| priority    | enum                 | ✔     | medium       | low/medium/high/urgent               |
| status      | enum                 | ✔     | new          | new/in_progress/pause/done/cancelled |
| topic_id    | int FK → task_topics | ✖     | —            | Тема из справочника                  |
| topic_text  | text                 | ✖     | —            | Тема свободным текстом               |
| is_private  | boolean              | ✔     | false        | Приватная ли задача                  |
| type        | enum                 | ✔     | regular      | regular/common                       |
| archived    | boolean              | ✔     | false        | Архив                                |
| created_at  | timestamptz          | ✔     | now()        | Дата создания                        |
| updated_at  | timestamptz          | ✔     | now()        | Дата обновления                      |

# Task Files (`task_files`)
| Поле        | Тип               | Обяз. | По умолчанию | Описание          |
|-------------|-------------------|-------|--------------|-------------------|
| id          | bigserial (PK)    | ✔     | —            | Идентификатор     |
| task_id     | bigint FK → tasks | ✔     | —            | Задача            |
| file_key    | text              | ✔     | —            | Ключ/путь к файлу |
| file_name   | text              | ✔     | —            | Имя файла         |
| size        | bigint            | ✖     | —            | Размер            |
| mime        | text              | ✖     | —            | MIME-тип          |
| uploaded_by | bigint FK → users | ✖     | —            | Кто загрузил      |
| created_at  | timestamptz       | ✔     | now()        | Дата загрузки     |

# Task Events (`task_events`)
| Поле       | Тип               | Обяз. | По умолчанию | Описание              |
|------------|-------------------|-------|--------------|-----------------------|
| id         | bigserial (PK)    | ✔     | —            | Идентификатор события |
| task_id    | bigint FK → tasks | ✔     | —            | Задача                |
| type       | text              | ✔     | —            | Тип события           |
| payload    | jsonb             | ✖     | —            | Детали                |
| created_at | timestamptz       | ✔     | now()        | Дата события          |
| actor_id   | bigint FK → users | ✖     | —            | Инициатор             |

# Shared Tasks Pool (`shared_tasks_pool`) — VIEW
Задачи с `type='common'` и `assignee_id IS NULL`, не архивные и не приватные.

# Task Archive Exports (`task_archive_exports`)
| Поле       | Тип               | Обяз. | По умолчанию | Описание      |
|------------|-------------------|-------|--------------|---------------|
| id         | bigserial (PK)    | ✔     | —            | Идентификатор |
| actor_id   | bigint FK → users | ✔     | —            | Кто выгрузил  |
| file_url   | text              | ✖     | —            | Ссылка на CSV |
| created_at | timestamptz       | ✔     | now()        | Дата выгрузки |

# Notifications (`notifications`)
| Поле       | Тип               | Обяз. | По умолчанию | Описание        |
|------------|-------------------|-------|--------------|-----------------|
| id         | bigserial (PK)    | ✔     | —            | Идентификатор   |
| user_id    | bigint FK → users | ✔     | —            | Получатель      |
| type       | text              | ✔     | —            | Тип уведомления |
| title      | text              | ✔     | —            | Заголовок       |
| body       | text              | ✖     | —            | Текст           |
| payload    | jsonb             | ✖     | —            | Доп. данные     |
| is_read    | boolean           | ✔     | false        | Прочитано       |
| created_at | timestamptz       | ✔     | now()        | Дата            |

# Push Subscriptions (`push_subscriptions`)
| Поле       | Тип               | Обяз. | По умолчанию | Описание           |
|------------|-------------------|-------|--------------|--------------------|
| id         | bigserial (PK)    | ✔     | —            | Идентификатор      |
| user_id    | bigint FK → users | ✔     | —            | Пользователь       |
| endpoint   | text              | ✔     | —            | WebPush endpoint   |
| keys       | jsonb             | ✔     | —            | Ключи p256dh, auth |
| ua         | text              | ✖     | —            | User-Agent         |
| created_at | timestamptz       | ✔     | now()        | Дата               |

# Directories (`directories`)
| Поле          | Тип                     | Обяз. | По умолчанию | Описание         |
|---------------|-------------------------|-------|--------------|------------------|
| id            | bigserial (PK)          | ✔     | —            | Идентификатор    |
| parent_id     | bigint FK → directories | ✖     | —            | Родитель         |
| name          | text                    | ✔     | —            | Название         |
| access_policy | jsonb                   | ✖     | —            | Политика доступа |

# Documents (`documents`)
| Поле         | Тип                     | Обяз. | По умолчанию | Описание      |
|--------------|-------------------------|-------|--------------|---------------|
| id           | bigserial (PK)          | ✔     | —            | Идентификатор |
| directory_id | bigint FK → directories | ✔     | —            | Раздел        |
| title        | text                    | ✔     | —            | Название      |
| file_key     | text                    | ✔     | —            | Ключ/путь     |
| mime         | text                    | ✖     | —            | MIME-тип      |
| size         | bigint                  | ✖     | —            | Размер        |
| version      | int                     | ✔     | 1            | Версия        |
| created_at   | timestamptz             | ✔     | now()        | Дата          |
| created_by   | bigint FK → users       | ✔     | —            | Автор         |

# Permissions (`permissions`)
| Поле          | Тип            | Обяз. | По умолчанию | Описание           |
|---------------|----------------|-------|--------------|--------------------|
| id            | bigserial (PK) | ✔     | —            | Идентификатор      |
| subject_type  | enum           | ✔     | —            | user/role          |
| subject_id    | bigint         | ✔     | —            | ID субъекта        |
| resource_type | enum           | ✔     | —            | directory/document |
| resource_id   | bigint         | ✔     | —            | ID ресурса         |
| action        | enum           | ✔     | —            | read/write/admin   |

# Vehicles (`vehicles`)
| Поле      | Тип            | Обяз. | По умолчанию | Описание           |
|-----------|----------------|-------|--------------|--------------------|
| id        | bigserial (PK) | ✔     | —            | Идентификатор      |
| name      | text           | ✔     | —            | Имя (марка/модель) |
| plate     | text (unique)  | ✔     | —            | Госномер           |
| color     | text           | ✖     | —            | Цвет               |
| is_active | boolean        | ✔     | true         | В парке ли авто    |

# Vehicle Logs (`vehicle_logs`)
| Поле       | Тип                  | Обяз. | По умолчанию | Описание      |
|------------|----------------------|-------|--------------|---------------|
| id         | bigserial (PK)       | ✔     | —            | Идентификатор |
| vehicle_id | bigint FK → vehicles | ✔     | —            | Машина        |
| user_id    | bigint FK → users    | ✔     | —            | Пользователь  |
| action     | enum                 | ✔     | —            | take/release  |
| created_at | timestamptz          | ✔     | now()        | Дата          |
| note       | text                 | ✖     | —            | Комментарий   |

# Teams (`teams`)
| Поле       | Тип            | Обяз. | По умолчанию | Описание      |
|------------|----------------|-------|--------------|---------------|
| id         | bigserial (PK) | ✔     | —            | Идентификатор |
| name       | text           | ✔     | —            | Название      |
| created_at | timestamptz    | ✔     | now()        | Дата создания |

# Team Members (`team_members`)
| Поле      | Тип               | Обяз. | По умолчанию | Описание       |
|-----------|-------------------|-------|--------------|----------------|
| team_id   | bigint FK → teams | ✔     | —            | Команда        |
| user_id   | bigint FK → users | ✔     | —            | Участник       |
| joined_at | timestamptz       | ✔     | now()        | Когда добавлен |

# Audit Log (`audit_log`)
| Поле       | Тип               | Обяз. | По умолчанию | Описание      |
|------------|-------------------|-------|--------------|---------------|
| id         | bigserial (PK)    | ✔     | —            | Идентификатор |
| actor_id   | bigint FK → users | ✖     | —            | Кто сделал    |
| action     | text              | ✔     | —            | Тип операции  |
| entity     | text              | ✔     | —            | Тип сущности  |
| entity_id  | bigint            | ✔     | —            | ID сущности   |
| diff       | jsonb             | ✖     | —            | Изменения     |
| created_at | timestamptz       | ✔     | now()        | Дата события  |
