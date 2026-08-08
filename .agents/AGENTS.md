# Theme Compliance Rules
- **Strict Theme Adherence**: ALWAYS use `var(--background)` and `var(--foreground)` or their Tailwind equivalents (`bg-background` and `text-foreground`) for main structural elements. DO NOT hardcode colors like `bg-zinc-50` or `text-zinc-900` unless explicitly overriding the theme for a specific component. Ensure all newly added code strictly supports both light and dark modes dynamically through these CSS variables.

<RULE[AGENTS.md]>
# Layout and Skeleton Rules
- **Consistent Layout**: ANY new page's layout MUST perfectly match the start and end of the header layout used in `app/[lang]/category/[slug]/page.tsx`. Do not use arbitrary wrappers like `max-w-[1200px]` if the parent uses `max-w-7xl mx-auto pt-3 pb-5`.
- **Immediate Skeletons**: Every async page MUST have a corresponding `loading.tsx` that displays immediately (no wait time). The skeleton layout must structurally match the final page exactly (same wrappers, same grid) to prevent layout shifts.
</RULE[AGENTS.md]>
