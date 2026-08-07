import { lang } from 'next/root-params'


const dictionaries = {
  en: () => import('@/locales/en.json').then((module) => module.default),
  ar: () => import('@/locales/ar.json').then((module) => module.default),
  zh: () => import('@/locales/zh.json').then((module) => module.default),
  fr: () => import('@/locales/fr.json').then((module) => module.default),
}

export type Locale = keyof typeof dictionaries

export const hasLocale = (locale: string): locale is Locale =>
  locale in dictionaries

export const getDictionary = async () => {
  const locale = await lang()
  if (!hasLocale(locale)) return dictionaries['en']()
  return dictionaries[locale]()
}
