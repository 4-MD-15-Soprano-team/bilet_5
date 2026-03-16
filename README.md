## We are sysadmins — документация (ветка `feature`)

Этот проект — лендинг и личный кабинет для команды **We are sysadmins**.  
Фронтенд — статический (`index.html`, `register.html`, `login.html`, `profile.html`), бэкенд‑часть реализована через **Supabase** (аутентификация, профили пользователей и заявки).

### Стек

- **Frontend**: чистые `HTML`, `CSS`, `JavaScript` (без фреймворков)
- **Auth**: Supabase Email Auth (`auth.users`)
- **БД**: Supabase Postgres (`profiles`, `applications`)
- **Хостинг**: GitHub Pages (`main` → GitHub Actions → Pages)

### Схема базы данных

![DB schema](images/shema.png)

Таблица пользователей `auth.users` — системная, она на схеме таблиц в SupaBase не показана, но используется как источник `auth.user().id` для связей.

### Таблицы Supabase (текстовое описание)

- **profiles**
  - `id uuid` — PK, совпадает с `auth.users.id` (1:1 с пользователем)
  - `email text`
  - `name text`
  - `phone text`
  - `avatar_url text`
  - `company text`
  - `position text`
  - `department text`
  - `created_at timestamptz`
  - `updated_at timestamptz`

- **applications**
  - `id uuid` — PK
  - `user_id uuid` — FK на `auth.users.id` (1 → many)
  - `name text`
  - `email text`
  - `phone text`
  - `company text`
  - `workplaces text`
  - `service text`
  - `comment text`
  - `status text` — статус заявки (`new`, `in_progress`, и т.п.)
  - `created_at timestamptz`

### Как это связано с фронтендом

- Регистрация (`register.html`, `js/auth-register.js`):
  - `supabase.auth.signUp({ email, password })`
  - после успешной регистрации создаётся/обновляется запись в `profiles`.
- Вход (`login.html`, `js/auth-login.js`):
  - `supabase.auth.signInWithPassword({ email, password })`
  - успешный вход перенаправляет на `profile.html`.
- Профиль (`profile.html`, `js/profile.js`):
  - читает/обновляет `profiles` по `auth.user().id`
  - создаёт и показывает заявки из таблицы `applications`.
- Заявка с лендинга (`index.html` + Supabase):
  - форма «Заказать консультацию» создаёт запись в `applications` для текущего авторизованного пользователя.


