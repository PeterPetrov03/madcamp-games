# MadCamp Games

Tournament management system for MadCamp.

## Features

* Admin panel
* Player profiles
* PIN login system
* Leaderboard
* Games and rounds
* Manual points
* Round-based scoring
* Supabase integration
* Public homepage
* Middleware protection for admin routes

---

# Prerequisites

Install the following:

* Node.js 24+
* Git
* VS Code (recommended)
* Supabase account

Verify installation:

```bash
node -v
npm -v
git --version
```

---

# Clone Repository

```bash
git clone https://github.com/PeterPetrov03/madcamp-games.git

cd madcamp-games
```

---

# Install Dependencies

```bash
npm install
```

---

# Supabase Setup

Create a new Supabase project.

Inside Supabase:

```text
SQL Editor
```

Run:

```text
supabase/schema.sql
```

This creates all required tables and views.

---

# Environment Variables

Create:

```text
.env.local
```

Example:

```env
NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

Do NOT commit this file.

---

# Run Project

Development:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

# Project Structure

```text
app/
 ├── page.tsx
 ├── login/
 ├── admin/
 └── profile/

lib/
 ├── auth.ts
 └── supabase.ts

supabase/
 └── schema.sql

middleware.ts
```

---

# Routes

## Public Homepage

```text
/
```

Visible to everyone.

Contains:

* Leaderboard
* Games overview
* Public information

No sensitive information is shown.

---

## Login

```text
/login
```

Admin login page.

---

## Admin

```text
/admin
```

Protected route.

Allows:

* Create players
* Create games
* Create rounds
* Award points
* Manage leaderboard

---

## Profile

```text
/profile
```

Player area.

Players can:

* View own points
* View own PIN
* View point history
* Upload profile picture

---

# Default Admin Credentials

Development only.

Username:

```text
Pesho
```

Password:

```text
MADCAMP
```

---

# Git Ignore

The following files should never be committed:

```text
node_modules/
.next/
.env
.env.local
```

---

# Roadmap

Planned features:

* Secret achievements
* Public live activity feed
* Top 4 finalists section
* Daily rankings
* Attendance tracking
* Heart-rate challenges
* Camp projector mode
* Achievement badges
* Team competitions
* Notifications

---

# Deployment

Recommended platforms:

* Vercel
* Netlify

Database:

* Supabase

---

# Technology Stack

* Next.js
* React
* TypeScript
* Tailwind CSS
* Supabase
* GitHub

---

# Contributing

1. Create branch
2. Commit changes
3. Push branch
4. Create Pull Request
