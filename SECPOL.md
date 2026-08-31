# Security Policy

## Purpose

This document defines the expected security posture for the GMS governance platform and the responsibilities of developers, administrators, and users who work with the application.

## Scope

This policy applies to the React + TypeScript frontend, Supabase authentication, application configuration, environment variables, and any governance data handled by the platform.

## Core Principles

- Protect student and governance data through least-privilege access.
- Treat UKEY as the primary identity reference.
- Restrict admin-only actions and sensitive views to authorized roles.
- Keep secrets out of source control and out of client-side code.
- Validate and verify authentication and authorization flows before deployment.

## Data Handling

- Do not commit `.env` files or any credentials to the repository.
- Store Supabase keys and secrets only in environment variables managed by the deployment environment.
- Avoid exposing sensitive information through logs, console output, or UI debug states.
- Ensure role-based checks are enforced on protected pages and admin features.

## Authentication and Access Control

- Authentication must use Supabase Auth and project-approved flows.
- UKEY-based identity lookups must be treated as authoritative where required.
- Role-based access checks must be applied before rendering or allowing privileged actions.
- Session restoration and logout flows must remain functional after refresh or navigation.
- Reset-password and setup flows must use approved redirect URLs and secure validation paths.

## Admin Responsibilities

- SYSVER and similar administrative areas must be restricted to authorized roles only.
- User creation and role assignment must be reviewed before launch in production.
- Data imports and bulk updates must be validated before being applied.
- Any changes to permissions, policies, or user metadata must be documented.

## Secure Development Practices

- Keep dependencies updated and review security advisories for project libraries.
- Validate new features with a production build before merge.
- Avoid unnecessary third-party packages and keep the app simple and maintainable.
- Keep code review focused on incorrect access checks, unsafe queries, and improper state exposure.

## Reporting Security Issues

If a potential security problem is discovered, report it privately and immediately to the project maintainer or system administrator. Do not disclose sensitive details publicly until they have been assessed and addressed.

## Enforcement

Violations of this security policy may result in restricted access, removal of privileges, or project-level corrective action depending on severity.

## Review

This policy should be reviewed when major auth changes, app permissions, or governance workflows are introduced.
