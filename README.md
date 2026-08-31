# GMS - Governance Management System

A React + TypeScript + Vite application for the Supreme Secondary Learner Government (SSLG) governance platform. The project follows a UKEY-first identity model and role-based access structure for school governance workflows.

## Overview

This app is designed around real governance operations for student leadership, including:

- UKEY-based authentication and identity handling
- role-aware dashboard access
- meetings and governance tracking
- workspace membership and admin management
- setup and onboarding for first-time users
- password reset and email confirmation flows

## Tech Stack

- React
- TypeScript
- Vite
- Supabase
- React Router
- Tailwind CSS
- Lucide React

## Core Features

- Login using UKEY lookup and Supabase Auth
- First-time account setup flow
- Password reset and email confirmation support
- Governance dashboard with summary metrics and recent activity
- Meetings management page
- SYSVER/admin management surfaces
- User and workspace management components
- Role-aware dashboard insights and action panels

## Project Structure

```text
src/
  components/
    Dashboard/
    Icon.tsx
    Layout.tsx
    UserManagement.tsx
    WorkspaceManagement.tsx
    WorkspaceMembers.tsx
  lib/
    auth.ts
    icons.ts
    supabase.ts
  pages/
    Dashboard.tsx
    ForgotPassword.tsx
    Login.tsx
    MeetingDetail.tsx
    Meetings.tsx
    ResetPassword.tsx
    Setup.tsx
    SYSVER.tsx
  App.tsx
  main.tsx
```

## Local Development

1. Install dependencies

```bash
npm install
```

2. Create a local environment file if needed

```bash
cp .env.example .env
```

3. Add your Supabase credentials

```env
VITE_SUPABASE_URL=your_project_url
VITE_SUPABASE_ANON_KEY=your_anon_key
```

4. Start the app

```bash
npm run dev
```

5. Build for production

```bash
npm run build
```

## Authentication and Identity Model

The application is designed around the following assumptions:

- UKEY is the primary identity source
- User records are stored in the public `users` table
- Access and views are role-based, not email-only
- `setup_complete` and related onboarding metadata are part of the user lifecycle

## Governance Workflow Notes

This is a production-oriented prototype for school governance operations and is intentionally designed to be practical, low-cost, and easy to maintain.

## Important Notes

- The frontend is currently aligned with a governance-first dashboard model.
- Some live Supabase schema and auth policy setup may still be required for full end-to-end onboarding in a production database.
- Password reset and email confirmation redirect URLs should be configured in the Supabase project settings.

## Status

The app currently includes the main governance shell, authentication flow, dashboard, admin surfaces, meetings, and onboarding/update routes for a UKEY-based student governance system.

