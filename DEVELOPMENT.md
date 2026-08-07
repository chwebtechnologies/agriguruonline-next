# AgriGuru Online - Frontend Developer Handbook & Project Guidelines

Welcome to the AgriGuru Online Frontend project. This document serves as the guide for developers and AI agents. It outlines the codebase structure, architectural standards, and token/performance optimization guidelines.

---

## 1. Directory Structure

```
├── app/
│   ├── [lang]/                  # All localized route pages
│   │   ├── page.tsx             # Localized Homepage (PPR Enabled)
│   │   ├── layout.tsx           # Localized Root Layout (RTL & System Theme script)
│   │   └── dictionaries.ts      # Lazy Translation Dictionary Loader
│   ├── globals.css              # Tailwind CSS imports & Responsive style rules
│   └── layout.tsx               # (Obsolete - Deleted, app/[lang]/layout.tsx is the Root)
├── components/
│   ├── layout/                  # Structural components
│   │   ├── Header.tsx           # Server Component Header (Coordinating Guest/Auth layouts)
│   │   ├── HeaderGuest.tsx      # Header for Guest (Zero API overhead / loading skeleton)
│   │   └── HeaderAuth.tsx       # Header for Authenticated Users (Server-cached details)
│   └── ui/                      # Base UI widgets
│       ├── ThemeToggle.tsx      # Dark / Light / System switcher
│       └── LangSwitcher.tsx     # Language routing switcher
├── locales/                     # Language JSON translation files
│   ├── en.json
│   ├── ar.json
│   ├── zh.json
│   └── fr.json
└── proxy.ts                     # Next.js 16 Edge proxy file (replaces middleware.ts)
```

---

## 2. Core Architectural Pillars

### A. Localization (i18n) & RTL Direction
- **Detection**: Handled at the network boundary in [proxy.ts](file:///Users/harshit/Desktop/agriguru-online/proxy.ts). It parses `Accept-Language` headers and routes users to `/[lang]/` paths.
- **Root Params**: Use `import { lang } from 'next/root-params'` inside Server Components to get the active locale dynamically without prop drilling.
- **RTL Support**: In [app/[lang]/layout.tsx](file:///Users/harshit/Desktop/agriguru-online/app/[lang]/layout.tsx), we dynamically assign `dir="rtl"` if the current locale is `ar` (Arabic) and `dir="ltr"` for other languages.
- **Lazy Imports**: Dictionaries in [app/[lang]/dictionaries.ts](file:///Users/harshit/Desktop/agriguru-online/app/[lang]/dictionaries.ts) load dynamic JSON files asynchronously on the server. No unused translations are bundled into client-side code.

### B. Dynamic Theme Switching (FOUC-Free)
- **Inline Head Script**: To prevent Flash of Unstyled Content (FOUC) on static pre-rendered shells, a synchronous script in `<head>` reads `localStorage` and sets `.dark` class list on `<html>` before initial paint.
- **Component Sync**: The theme toggle [ThemeToggle.tsx](file:///Users/harshit/Desktop/agriguru-online/components/ui/ThemeToggle.tsx) uses `useLayoutEffect` to synchronize the client state and updates the class on state change.

### C. Device Adaptability (Projectors & TVs to Keypad Phones)
- **TVs & Projectors (>1920px)**: Custom Tailwind v4 media queries scale the base font size up to `20px` / `24px` and expand container limits (`max-w-7xl` dynamically scales) for high distance readability.
- **Keypad Phones (<320px)**: CSS rules stack layout items into simple vertical blocks. Focus highlights (`focus-visible`) are prominent (3px Emerald border) for tactile button navigation. Base font sizes scale down to `13px`.

### D. Optimized Headers (API Conservation)
- **Authentication**: Check for the cookie `auth_token`.
- **Guest Access**: Guest headers [HeaderGuest.tsx](file:///Users/harshit/Desktop/agriguru-online/components/layout/HeaderGuest.tsx) load static links immediately with zero API calls.
- **Auth Access**: Authenticated headers [HeaderAuth.tsx](file:///Users/harshit/Desktop/agriguru-online/components/layout/HeaderAuth.tsx) retrieve user details asynchronously. They are wrapped in a `<Suspense>` boundary in [app/[lang]/page.tsx](file:///Users/harshit/Desktop/agriguru-online/app/[lang]/page.tsx) so the profile fetch doesn't block page shell load times.
- **Next.js 16 caching**: The user profile query is wrapped in `'use cache'` with `cacheLife('minutes')` to prevent redundant server operations.

---

## 3. Developer / Agent Guidelines for Context & Token Optimization

To optimize development workflows and save LLM token usage, follow these strict directives:

1. **Avoid Bulk Overwrites**: Use targeted code replacements. Do not rewrite large components completely when fixing a small bug.
2. **Comment Rationale**: Always add short comments explaining the logic (e.g. why a component is wrapped in `Suspense`, why `suppressHydrationWarning` is used).
3. **Run Caching Correctly**:
   - Apply `'use cache'` to functions doing heavy data fetching.
   - Use `cacheLife(...)` inside cache scopes.
   - Use `updateTag('tag-name')` in Server Actions to trigger immediate revalidation when mutations occur.
4. **Prerendering Safety**: Never invoke `cookies()`, `headers()`, or `connection()` directly in static areas. Always push dynamic reads down into child Server Components wrapped in a `<Suspense>` boundary so the parent container can build statically.
