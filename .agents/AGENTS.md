# Theme Compliance Rules
- **Strict Theme Adherence**: ALWAYS use `var(--background)` and `var(--foreground)` or their Tailwind equivalents (`bg-background` and `text-foreground`) for main structural elements. DO NOT hardcode colors like `bg-zinc-50` or `text-zinc-900` unless explicitly overriding the theme for a specific component. Ensure all newly added code strictly supports both light and dark modes dynamically through these CSS variables.

<RULE[AGENTS.md]>
# Layout and Skeleton Rules
- **Consistent Layout**: ANY new page's layout MUST perfectly match the start and end of the header layout used in `app/[lang]/category/[slug]/page.tsx`. Do not use arbitrary wrappers like `max-w-[1200px]` if the parent uses `max-w-7xl mx-auto pt-3 pb-5`.
- **Immediate Skeletons**: Every async page MUST have a corresponding `loading.tsx` that displays immediately (no wait time). The skeleton layout must structurally match the final page exactly (same wrappers, same grid) to prevent layout shifts.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
# UI and Styling Rules
- **Icons**: ALWAYS use Font Awesome for standard icons (like Google, Apple, social icons, etc.) instead of pasting raw SVGs. Use the `fa-brands`, `fa-solid`, etc. classes properly (e.g. `<i className="fa-brands fa-apple"></i>`).
- **Spacing**: Do NOT use excessive vertical spacing or arbitrary padding (like `py-12`, `min-h-screen`, large empty gaps) unless specifically asked. Stick to the spacing matching the category pages (e.g. `pt-3 pb-5`, `px-2 sm:px-0`) for consistency and avoid adding card containers if the page should flow seamlessly.
</RULE[AGENTS.md]>

<RULE[AGENTS.md]>
# Security and Authentication Rules
- **Profile Page Security**: The profile page MUST strictly require the user to be logged in. Always verify the authentication token (e.g. `auth_token` or `__Secure-uid`) from `cookies()`. If no token exists, immediately redirect the user to the login page (e.g. `/[lang]/login`).
- **Profile Data Fetching**: Profile data must be fetched using the provided API `https://user-api.agriguruonline.cloud/user/my-profile?lang_code=en&source=web` using the `Authorization: Bearer <token>` header to ensure 100% security with no compromise.
</RULE[AGENTS.md]>
