# MAD CAMP Games Tournament App

Уеб приложение за лагерен турнир с публична класация, админ панел, профили на участници и Supabase база данни.

## Какво има в тази версия

- `/` — публична начална страница с класация, игри и брой рундове.
- `/profile` — участникът въвежда личния си PIN и вижда собствената си история на точки.
- `/login` — админ вход.
- `/admin` — защитен админ панел.
- Участниците имат само: **име** и **PIN код**.
- Игрите имат рундове.
- Всеки рунд има отделни точки за 1во до 8мо място.
- При запис на резултат можеш да въвеждаш участник по **име или PIN**.
- Визуалните стилове са изнесени в отделна папка: `app/styles/madcamp.css`.

---

## 1. Какво ти трябва

Трябват ти:

1. Node.js LTS или нова версия.
2. Supabase проект.
3. Този проект, разархивиран на лаптопа ти.

Провери Node и npm:

```bash
node -v
npm -v
```

---

## 2. Важно за npm registry

Ако npm се опитва да сваля пакети от грешен адрес, пусни:

```bash
npm.cmd config set registry https://registry.npmjs.org/
npm.cmd config get registry
```

Трябва да върне:

```text
https://registry.npmjs.org/
```

---

## 3. Инсталиране на пакетите

Влез в папката на проекта и пусни:

```bash
npm.cmd install --legacy-peer-deps
```

Ако имаш стари счупени инсталации, изтрий:

```text
node_modules
package-lock.json
```

после пак пусни:

```bash
npm.cmd install --legacy-peer-deps
```

---

## 4. Supabase настройка

В проекта има файл:

```text
.env.local
```

Вътре трябва да има:

```env
NEXT_PUBLIC_SUPABASE_URL=https://твоя-проект.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=твоят-publishable-key
```

Не слагай `/rest/v1` в URL-а.

Правилно:

```env
NEXT_PUBLIC_SUPABASE_URL=https://npffhrpakihisrwfgbpy.supabase.co
```

Грешно:

```env
NEXT_PUBLIC_SUPABASE_URL=https://npffhrpakihisrwfgbpy.supabase.co/rest/v1
```

---

## 5. Създаване на таблиците

1. Влез в Supabase.
2. Отвори проекта.
3. Отвори **SQL Editor**.
4. Натисни **New query**.
5. Отвори файла:

```text
supabase/schema.sql
```

6. Копирай целия SQL код.
7. Paste в SQL Editor.
8. Натисни **Run**.

Важно: този `schema.sql` reset-ва таблиците. Ако вече имаш реални данни, те ще бъдат изтрити.

---

## 6. Стартиране локално

В папката на проекта пусни:

```bash
npm.cmd run dev
```

После отвори:

```text
http://localhost:3000
```

---

## 7. Страници

### Публична страница

```text
http://localhost:3000
```

Тук се виждат:

- класация;
- брой участници;
- брой игри;
- брой рундове;
- списък с игри.

Тук **не се показват PIN кодове** и **не се показва история защо някой е получил точки**.

### Профил на участник

```text
http://localhost:3000/profile
```

Участникът въвежда своя PIN и вижда:

- общи точки;
- точки по категории;
- лична история на точките.

### Admin login

```text
http://localhost:3000/login
```

Login:

```text
Pesho
MADCAMP
```

### Admin panel

```text
http://localhost:3000/admin
```

Там можеш да:

- добавяш участници;
- редактираш имена и PIN кодове;
- триеш участници;
- добавяш игри;
- добавяш/редактираш/триеш рундове;
- задаваш различни точки за всеки рунд;
- записваш резултат от рунд по име или PIN;
- добавяш ръчни точки;
- триеш записи с точки.

---

## 8. Как работят игрите и рундовете

Играта пази само името си.

Рундовете пазят:

- към коя игра са;
- номер на рунда;
- точки за 1во място;
- точки за 2ро място;
- ...
- точки за 8мо място.

Така можеш да имаш например:

| Игра | Рунд | 1во | 2ро | 3то |
|---|---:|---:|---:|---:|
| Black Market | 1 | 100 | 80 | 60 |
| Black Market | 2 | 150 | 120 | 90 |
| Black Market | 3 | 50 | 40 | 30 |

---

## 9. Въвеждане на резултат

В админ панела:

1. Избираш игра.
2. Избираш рунд.
3. Въвеждаш участниците по места.

Полетата са:

```text
1во място
2ро място
3то място
...
8мо място
```

Във всяко поле можеш да въведеш:

- името на участника;
- или PIN кода му.

Ако има двама участници с еднакво име, използвай PIN код.

---

## 10. Важно за сигурността

Тази версия е MVP за тестване. Публичната страница не показва чувствителна информация, но Supabase правилата в момента са отворени, за да може админ панелът да работи лесно от frontend-а.

Преди реален лагер с истински участници е добре да направим по-сигурна версия с:

- Supabase Auth;
- роли: admin/player;
- по-строги RLS policies;
- server-side actions за админ операции.


---

## Update: Participant profile page

This version adds a participant profile page at `/profile`:

- participants log in with their PIN;
- they can see their own PIN;
- they can see all participants without seeing other people's PINs;
- they can see their own points and point history;
- game points show game + round;
- manual/admin bonus points show the title set by the admin;
- participants can upload a profile photo from their phone.

Important: run `supabase/schema.sql` again in Supabase SQL Editor, because the `players` table now has `avatar_url` and the app creates an `avatars` Supabase Storage bucket.
