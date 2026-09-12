'use client'

import { useState, useEffect } from 'react'
import { useTheme } from '@/components/providers/ThemeProvider'

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const changeTheme = (newTheme: 'light' | 'dark' | 'system') => {
    setTheme(newTheme)
  }

  const currentTheme = mounted ? theme : 'system'

  return (
    <div className="flex items-center gap-1 rounded-full bg-muted/50 p-1 border border-border">
      <button
        onClick={() => changeTheme('light')}
        className={`rounded-full p-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          currentTheme === 'light'
            ? 'bg-background text-emerald-600 shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Light Mode"
        aria-label="Light Mode"
      >
        <i className="fa-solid fa-sun text-sm"></i>
      </button>

      <button
        onClick={() => changeTheme('dark')}
        className={`rounded-full p-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          currentTheme === 'dark'
            ? 'bg-background text-emerald-600 shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="Dark Mode"
        aria-label="Dark Mode"
      >
        <i className="fa-solid fa-moon text-sm"></i>
      </button>

      <button
        onClick={() => changeTheme('system')}
        className={`rounded-full p-1.5 transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
          currentTheme === 'system'
            ? 'bg-background text-emerald-600 shadow-sm'
            : 'text-muted-foreground hover:text-foreground'
        }`}
        title="System Preference"
        aria-label="System Preference"
      >
        <i className="fa-solid fa-desktop text-sm"></i>
      </button>
    </div>
  )
}
