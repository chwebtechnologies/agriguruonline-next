'use client'

import { useServerInsertedHTML } from 'next/navigation'

export default function ThemeInitializer() {
  useServerInsertedHTML(() => {
    return (
      <script
        id="theme-initializer"
        dangerouslySetInnerHTML={{
          __html: `
            (function() {
              try {
                var t = localStorage.getItem('theme') || 'system';
                var d = document.documentElement;
                if (t === 'dark') {
                  d.classList.add('dark');
                  d.classList.remove('light');
                } else if (t === 'light') {
                  d.classList.remove('dark');
                  d.classList.add('light');
                } else {
                  d.classList.remove('dark');
                  d.classList.remove('light');
                }
              } catch(e) {}
            })()
          `,
        }}
      />
    )
  })

  return null
}
