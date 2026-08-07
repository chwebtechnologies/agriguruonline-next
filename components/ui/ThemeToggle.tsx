'use client'

import { useLayoutEffect, useState } from 'react'

export default function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system')

  useLayoutEffect(() => {
    const savedTheme = (localStorage.getItem('theme') as 'light' | 'dark' | 'system') || 'system'
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(savedTheme)
  }, [])

  const changeTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
    localStorage.setItem('theme', newTheme)
    
    const root = document.documentElement
    if (
      newTheme === 'dark' ||
      (newTheme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      root.classList.add('dark')
    } else {
      root.classList.remove('dark')
    }
  }

  return (
    <div className="flex items-center gap-1 rounded-full bg-zinc-200/50 p-1 dark:bg-zinc-800/50 border border-zinc-200 dark:border-zinc-800">
      <button
        onClick={() => changeTheme('light')}
        className={`rounded-full p-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          theme === 'light'
            ? 'bg-white text-emerald-600 shadow-sm dark:bg-zinc-700'
            : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50'
        }`}
        title="Light Mode"
        aria-label="Light Mode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
        </svg>
      </button>

      <button
        onClick={() => changeTheme('dark')}
        className={`rounded-full p-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          theme === 'dark'
            ? 'bg-white text-emerald-600 shadow-sm dark:bg-zinc-700'
            : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50'
        }`}
        title="Dark Mode"
        aria-label="Dark Mode"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
        </svg>
      </button>

      <button
        onClick={() => changeTheme('system')}
        className={`rounded-full p-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          theme === 'system'
            ? 'bg-white text-emerald-600 shadow-sm dark:bg-zinc-700'
            : 'text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-50'
        }`}
        title="System Preference"
        aria-label="System Preference"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25M19.5 3H4.5A1.5 1.5 0 003 4.5v10.5a1.5 1.5 0 001.5 1.5h15a1.5 1.5 0 001.5-1.5V4.5A1.5 1.5 0 0019.5 3z" />
        </svg>
      </button>
    </div>
  )
}
