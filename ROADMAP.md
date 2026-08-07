# AgriGuru Online - Feature Integration Roadmap & Step-by-Step Guide

This guide details the step-by-step phases of the project. Follow this guide to prepare UI specifications and API details for each step. We will build, integrate, and verify each step one by one.

---

## Phase 1: Localized Landing Page & Static Shells
In this phase, we establish the public landing page with multi-language capabilities and device adaptations.

### What to Prepare
- **UI Design**: Home page wireframe/layout, hero text, section content, image placeholders, and CTAs.
- **Translations**: Specific translation keys for English, Arabic (RTL), Chinese, and French if you want to extend `locales/`.
- **API Needed**: **None**. This phase relies on static content and Next.js 16 file layouts.

---

## Phase 2: User Authentication (Login & Signup UI/Flows)
In this phase, we implement the auth gateway and coordinate the Guest Header vs. Authenticated User Header views.

### What to Prepare
- **UI Design**: Designs/layouts for the Login page, Registration page, error validation modals, and active input button styles.
- **API Needed**: 
  - **Login Endpoint**: URL (e.g. `/api/auth/login`), request method (POST), expected request body, and response payload structure (JWT token location/name).
  - **Signup Endpoint**: URL, payload keys, and response schema.
  - **Logout Endpoint**: (If server-invalidated) or details on session cookies.

---

## Phase 3: Main User Dashboard
In this phase, we build the post-login landing zone (Dashboard) for our 10,000+ active users, optimizing loading shells.

### What to Prepare
- **UI Design**: Dashboard grid layouts (e.g. overview cards, transaction tables, recent activities list, chart widgets).
- **API Needed**:
  - **Dashboard Stats Endpoint**: Metrics data (e.g. total views, earnings, users).
  - **Activities Endpoint**: Recent activity lists to display inside tables.
  - *Note*: We will implement Server Components wrapped in React `<Suspense>` boundaries to fetch and display this data instantly, utilizing `'use cache'` with configured `cacheLife` profiles to avoid redundant backend calls.

---

## Phase 4: User Profile & Account Settings
In this phase, we implement forms for updating personal information, uploading avatars, and editing settings.

### What to Prepare
- **UI Design**: Profile settings page layout, form validation styles, avatar upload area, and feedback alerts (success/error).
- **API Needed**:
  - **Get Profile Endpoint**: URL for retrieving the authenticated user's profile details.
  - **Update Profile Endpoint**: Payload structure for updating credentials.
  - *Note*: We will use React Server Actions with `updateTag('user-profile')` to update data on the server and trigger immediate cache invalidation.

---

## Phase 5: SEO, Meta & Performance Audit
In this final phase, we configure sitemaps, semantic tags, schema markings, and verify Core Web Vitals (LCP, FCP).

### What to Prepare
- **Meta Specifications**: SEO titles, descriptions, and OpenGraph/Twitter social sharing parameters per language.
- **API Needed**: **None**. We will configure dynamic JSON-LD metadata and sitemaps.

---

## How to Share Assets & Start a Step
When you are ready to begin a phase:
1. **For UI Details**: Paste the code template, layout specifications, or Tailwind classes in the chat.
2. **For API Details**: Share the endpoint path, request/response JSON schema, and token/cookie details.
3. We will activate the step, write code, run builds, and verify execution before moving to the next.
