'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'

interface ArticleAudioPlayerProps {
  title: string
  content: string
  lang: string
  label?: string
  contentType?: 'news' | 'event' | 'article'
}

// BCP-47 Language mapping for all 4 supported languages
const BCP47_LANG_CODES: Record<string, string> = {
  en: 'en-US',
  ar: 'ar-SA',
  zh: 'zh-CN',
  fr: 'fr-FR',
}

// Exhaustive male & novelty voice patterns across macOS, iOS, Windows, Android, Linux, Chrome
const MALE_VOICE_PATTERNS = [
  'male', 'man', 'boy', 'guy', 'homme', 'garçon',
  // macOS / iOS male voices
  'alex', 'fred', 'daniel', 'oliver', 'maged', 'majed', 'tarik', 'tariq', 'thomas', 'nicolas',
  'alain', 'henri', 'paul', 'pierre', 'claude', 'mathieu', 'guillaume', 'jean', 'jacques',
  'li-mu', 'limu', 'qi-che', 'qiche', 'danny', 'eddy', 'flo', 'grandpa', 'rocko', 'reed',
  'junior', 'ralph', 'albert', 'aman', 'rishi', 'bad news', 'bahh', 'bells', 'boing', 'bubbles',
  'cellos', 'deranged', 'good news', 'hysterical', 'pipe organ', 'trinoids',
  'whisper', 'zarvox', 'wobble', 'jester', 'superstar', 'organ', 'alva', 'juan', 'diego', 'jorge',
  // Squeaky / ancient / novelty macOS voices to strictly exclude
  'kathy', 'princess', 'grandma', 'sandy', 'shelley',
  // Windows / Microsoft / Android / Cloud male voices
  'david', 'mark', 'george', 'stefan', 'martin', 'richard', 'james', 'john',
  'yunjian', 'yunxi', 'yunyang', 'yunfeng', 'kangkang', 'zhiwei', 'naayf', 'hamed', 'shakir',
  'bassam', 'hamid', 'omar', 'ali', 'hassan', 'khalid', 'mustafa'
]

// Curated high-quality professional news anchor female voices per language for Web Speech API
const FEMALE_VOICE_NAMES_BY_LANG: Record<string, string[]> = {
  en: [
    'microsoft aria online (natural)', 'microsoft aria',
    'microsoft jenny online (natural)', 'microsoft jenny',
    'google us english', 'google uk english female',
    'samantha', 'karen', 'ava', 'allison', 'victoria', 'serena', 'moira', 'tessa', 'fiona',
    'neerja', 'swara', 'veena', 'joanna', 'salli', 'ivy',
    'female', 'woman'
  ],
  ar: [
    'microsoft salma online (natural)', 'microsoft zariyah online (natural)',
    'google العربية', 'google arabic',
    'salma', 'zariyah', 'laila', 'mariam', 'marium', 'fatima',
    'female', 'woman', 'أنثى', 'امرأة'
  ],
  zh: [
    'microsoft xiaoxiao online (natural)', 'microsoft xiaoxiao',
    'google 普通话', 'google 国语', 'google chinese',
    'xiaoxiao', 'tingting', 'ting-ting', 'sinji', 'meijia', 'xiaoyi',
    'female', 'woman', '女'
  ],
  fr: [
    'microsoft denise online (natural)', 'microsoft vivienne online (natural)',
    'google français', 'google french',
    'denise', 'amelie', 'amélie', 'audrey', 'chantal', 'virginie', 'julie', 'claire',
    'female', 'woman', 'femme'
  ]
}

// Multilingual labels by content type (News, Event, Article)
const DEFAULT_LABELS_BY_TYPE: Record<string, Record<string, string>> = {
  news: {
    en: 'Listen to this news now',
    ar: 'استمع إلى هذا الخبر الآن',
    zh: '立即收听本条新闻',
    fr: 'Écoutez cette actualité maintenant',
  },
  event: {
    en: 'Listen to this event now',
    ar: 'استمع إلى هذه الفعالية الآن',
    zh: '立即收听本场活动',
    fr: 'Écoutez cet événement maintenant',
  },
  article: {
    en: 'Listen to this article now',
    ar: 'استمع إلى هذا المقال الآن',
    zh: '立即收听本文',
    fr: 'Écoutez cet article maintenant',
  },
}

function isMaleVoice(name: string): boolean {
  const lower = name.toLowerCase()
  return MALE_VOICE_PATTERNS.some(p => {
    const regex = new RegExp(`(^|[^a-z])${p}([^a-z]|$)`, 'i')
    return regex.test(lower)
  })
}

function formatTime(totalSeconds: number): string {
  const safeSec = Math.max(0, Math.floor(totalSeconds))
  const mins = Math.floor(safeSec / 60)
  const secs = safeSec % 60
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function cleanHtmlToText(html: string): string {
  if (!html) return ''
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<br\s*[\/]?>/gi, '. ')
    .replace(/<\/p>/gi, '. ')
    .replace(/<\/div>/gi, '. ')
    .replace(/<\/li>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&laquo;/gi, '«')
    .replace(/&raquo;/gi, '»')
    .replace(/&hellip;/gi, '...')
    .replace(/&#\d+;/g, ' ')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export default function ArticleAudioPlayer({
  title,
  content,
  lang,
  label,
  contentType = 'news'
}: ArticleAudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [speed, setSpeed] = useState<number>(1.0)
  const [isDragging, setIsDragging] = useState<boolean>(false)
  const [isBuffering, setIsBuffering] = useState<boolean>(false)

  const langKey = (lang || 'en').toLowerCase().split('-')[0]
  const isArabic = langKey === 'ar'
  const isChinese = langKey === 'zh'

  // Plain text fallback chunks
  const initialSentences = useMemo(() => {
    const plainBody = cleanHtmlToText(content)
    if (!plainBody && !title) return ['AgriGuru Online']

    const maxLen = isChinese ? 80 : 160
    const rawChunks = (isChinese
      ? [title, plainBody].filter(Boolean).join('\n').split(/(?<=[。！？\n])\s*/u)
      : [title, plainBody].filter(Boolean).join('.\n').split(/(?<=[!?؟۔。！？\n]|(?<=\.(?!\d)))\s*/u)
    ).map(s => s.trim()).filter(s => s.length > 0)

    const finalSegments: string[] = []

    for (const chunk of rawChunks) {
      if (chunk.length > maxLen) {
        const subSplitRegex: RegExp = isChinese
          ? /(?<=[，、；：,;:])\s*/u
          : isArabic
          ? /(?<=[،؛:;,])\s*/u
          : /(?<=[,;:\u2014\u2013\-])\s+/u

        const subParts = chunk.split(subSplitRegex).map(p => p.trim()).filter(Boolean)
        let currentSub = ''

        for (const part of subParts) {
          if ((currentSub + (currentSub ? ' ' : '') + part).length > maxLen && currentSub.trim()) {
            finalSegments.push(currentSub.trim())
            currentSub = part
          } else {
            currentSub = currentSub ? (isChinese ? `${currentSub}${part}` : `${currentSub} ${part}`) : part
          }
        }
        if (currentSub.trim()) {
          finalSegments.push(currentSub.trim())
        }
      } else {
        finalSegments.push(chunk)
      }
    }

    return finalSegments.length > 0 ? finalSegments : [title || 'AgriGuru Online']
  }, [title, content, isChinese, isArabic])

  const [activeSentences, setActiveSentences] = useState<string[]>(initialSentences)

  // Keep activeSentences synchronized with content changes
  useEffect(() => {
    setActiveSentences(initialSentences)
  }, [initialSentences])

  // Calculate durations for each segment and cumulative start milestones
  const { sentenceDurations, sentenceStartTimes, totalDuration } = useMemo(() => {
    const durations: number[] = []
    const startTimes: number[] = []
    let accumulated = 0

    const isAsianLang = langKey === 'zh'
    for (const sentence of activeSentences) {
      startTimes.push(accumulated)
      let sec: number
      if (isAsianLang) {
        sec = Math.max(1.5, sentence.length / 3.0)
      } else if (langKey === 'ar') {
        const words = sentence.split(/\s+/).filter(Boolean).length
        sec = Math.max(1.5, words / 2.3)
      } else if (langKey === 'fr') {
        const words = sentence.split(/\s+/).filter(Boolean).length
        sec = Math.max(1.5, words / 2.5)
      } else {
        const words = sentence.split(/\s+/).filter(Boolean).length
        sec = Math.max(1.5, words / 2.5)
      }
      durations.push(sec)
      accumulated += sec
    }

    return {
      sentenceDurations: durations,
      sentenceStartTimes: startTimes,
      totalDuration: Math.max(1, accumulated)
    }
  }, [activeSentences, langKey])

  const progressRef = useRef<HTMLDivElement>(null)
  const currentSentenceIdxRef = useRef<number>(0)
  const speedRef = useRef<number>(1.0)
  const isPlayingRef = useRef<boolean>(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  speedRef.current = speed
  isPlayingRef.current = isPlaying

  // Dynamic context-aware label (News, Event, or Article)
  const displayLabel = useMemo(() => {
    if (label) {
      if (contentType === 'news' && label === 'Listen to this article now') {
        return DEFAULT_LABELS_BY_TYPE.news[langKey] || DEFAULT_LABELS_BY_TYPE.news.en
      }
      if (contentType === 'event' && label === 'Listen to this article now') {
        return DEFAULT_LABELS_BY_TYPE.event[langKey] || DEFAULT_LABELS_BY_TYPE.event.en
      }
      return label
    }
    const typeGroup = DEFAULT_LABELS_BY_TYPE[contentType] || DEFAULT_LABELS_BY_TYPE.news
    return typeGroup[langKey] || typeGroup.en
  }, [label, contentType, langKey])

  // Stop any active audio / speech (optional resetSource=true unloads media element)
  const stopAllPlayback = useCallback((resetSource = true) => {
    if (audioRef.current) {
      audioRef.current.pause()
      if (resetSource) {
        audioRef.current.removeAttribute('src')
        audioRef.current.load()
      }
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  // Reset playback if article content or language changes
  useEffect(() => {
    stopAllPlayback()
    setIsPlaying(false)
    setCurrentTime(0)
    currentSentenceIdxRef.current = 0
  }, [content, lang, stopAllPlayback])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAllPlayback()
    }
  }, [stopAllPlayback])

  // Find sentence index from a given playback time
  const getSentenceIdxForTime = useCallback((time: number): number => {
    let idx = 0
    for (let i = 0; i < sentenceStartTimes.length; i++) {
      if (time >= sentenceStartTimes[i]) {
        idx = i
      } else {
        break
      }
    }
    return Math.min(idx, activeSentences.length - 1)
  }, [sentenceStartTimes, activeSentences.length])

  // Pre-load voices on component mount
  useEffect(() => {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      const loadVoices = () => {
        window.speechSynthesis.getVoices()
      }
      loadVoices()
      window.speechSynthesis.onvoiceschanged = loadVoices
      return () => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.onvoiceschanged = null
        }
      }
    }
  }, [])

  // Curated professional female news anchor selector for Web Speech API
  const findBestLadyVoice = useCallback((voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | null => {
    if (!voices || voices.length === 0) return null

    const matchingVoices = voices.filter(v => {
      const vLang = v.lang.toLowerCase().replace('_', '-')
      if (langKey === 'zh') {
        return vLang.startsWith('zh') || vLang.startsWith('cmn') || vLang.startsWith('yue')
      }
      if (langKey === 'ar') {
        return vLang.startsWith('ar')
      }
      if (langKey === 'fr') {
        return vLang.startsWith('fr')
      }
      return vLang.startsWith('en')
    })

    if (matchingVoices.length === 0) return null

    let bestVoice: SpeechSynthesisVoice | null = null
    let bestScore = -99999

    const knownFemaleNames = FEMALE_VOICE_NAMES_BY_LANG[langKey] || FEMALE_VOICE_NAMES_BY_LANG.en

    for (const v of matchingVoices) {
      const nameLower = v.name.toLowerCase()

      // Strictly eliminate male voices
      if (isMaleVoice(nameLower)) {
        continue
      }

      // Check if voice matches known female patterns
      const isKnownFemale = knownFemaleNames.some(fn => nameLower.includes(fn))
      if (!isKnownFemale && langKey === 'ar') {
        // For Arabic, strictly reject unknown voices to prevent OS falling back to male (e.g. Majed)
        continue
      }

      let score = 0
      if (isKnownFemale) score += 2000

      // Prioritize modern high-quality neural / online / natural / enhanced broadcast voices
      if (/natural|neural|online|enhanced|premium/i.test(nameLower)) score += 5000
      if (/salma|zariyah|aria|jenny|xiaoxiao|denise/i.test(nameLower)) score += 4000
      if (/google/i.test(nameLower)) score += 3000
      if (/siri|ava/i.test(nameLower)) score += 2000
      if (/samantha|laila|amelie|tingting|meijia|sinji/i.test(nameLower)) score += 1500

      if (v.default) score += 200

      if (score > bestScore) {
        bestScore = score
        bestVoice = v
      }
    }

    if (bestScore < 0) {
      const strictlyNonMale = matchingVoices.find(v => !isMaleVoice(v.name))
      if (strictlyNonMale) return strictlyNonMale
    }

    // For non-Arabic (en, zh, fr): preserve reliable fallback so Web Speech API works as expected
    if (langKey !== 'ar') {
      return bestVoice || matchingVoices.find(v => !isMaleVoice(v.name)) || matchingVoices[0] || null
    }

    // For Arabic: strictly return verified female voice, otherwise null to stream Google Arabic Female TTS
    return bestVoice
  }, [langKey])

  // Ref to speak next sentence without circular dependencies
  const playSentenceRef = useRef<(index: number) => void>(() => {})

  // Play sentence engine (Dual-engine: High-performance female Web Speech API OR Studio Google Female Stream)
  const playSentence = useCallback((index: number) => {
    if (index >= activeSentences.length) {
      setIsPlaying(false)
      setIsBuffering(false)
      stopAllPlayback(true)
      setCurrentTime(totalDuration)
      currentSentenceIdxRef.current = 0
      return
    }

    currentSentenceIdxRef.current = index
    const textToSpeak = activeSentences[index]
    if (!textToSpeak) return

    const baseStartTime = sentenceStartTimes[index] || 0
    const estSegmentDuration = sentenceDurations[index] || 2.5

    // Set aligned time
    setCurrentTime(baseStartTime)

    // Check available voices for Web Speech API
    const allVoices = typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis.getVoices()
      : []
    const femaleVoice = findBestLadyVoice(allVoices)

    const matchingVoicesExist = allVoices.some(v => {
      const vl = v.lang.toLowerCase().replace('_', '-')
      if (langKey === 'fr') return vl.startsWith('fr')
      if (langKey === 'en') return vl.startsWith('en')
      return false
    })

    // Engine 1: Web Speech API (Used for English & French where browser has local native voices)
    // For Arabic and Chinese: ALWAYS use Engine 2 (/api/tts)
    // because CMS articles are in English, and /api/tts translates into authentic Arabic/Mandarin
    // and synthesizes studio broadcast female voices with zero macOS male voices or broken pinyin.
    const canUseSpeechSynthesis = typeof window !== 'undefined' && 'speechSynthesis' in window && (
      (langKey === 'en' && (femaleVoice !== null || matchingVoicesExist)) ||
      (langKey === 'fr' && (femaleVoice !== null || matchingVoicesExist))
    )

    if (canUseSpeechSynthesis) {
      setIsBuffering(false)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
      window.speechSynthesis.cancel()

      const utterance = new SpeechSynthesisUtterance(textToSpeak)
      utterance.lang = BCP47_LANG_CODES[langKey] || 'en-US'
      utterance.rate = speedRef.current
      utterance.pitch = 1.0
      if (femaleVoice) {
        utterance.voice = femaleVoice
      }

      // Smooth real-time progress update without server roundtrips
      const startTimestamp = Date.now()
      timerRef.current = setInterval(() => {
        if (!isPlayingRef.current) return
        const elapsedSec = ((Date.now() - startTimestamp) / 1000) * speedRef.current
        const nextStartTime = sentenceStartTimes[index + 1] || totalDuration
        const calculatedTime = Math.min(nextStartTime - 0.05, baseStartTime + elapsedSec)
        setCurrentTime(calculatedTime)
      }, 50)

      utterance.onend = () => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        if (isPlayingRef.current) {
          const nextIdx = index + 1
          if (nextIdx < activeSentences.length) {
            playSentenceRef.current(nextIdx)
          } else {
            setIsPlaying(false)
            setCurrentTime(totalDuration)
            currentSentenceIdxRef.current = 0
          }
        }
      }

      utterance.onerror = (e) => {
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
        if (e.error !== 'canceled' && e.error !== 'interrupted') {
          if (isPlayingRef.current && index + 1 < activeSentences.length) {
            playSentenceRef.current(index + 1)
          }
        }
      }

      window.speechSynthesis.speak(utterance)
      return
    }

    // Engine 2: Studio Google Female Stream with Auto-Translation via /api/tts
    setIsBuffering(true)
    const audioUrl = `/api/tts?text=${encodeURIComponent(textToSpeak)}&lang=${langKey}`

    if (!audioRef.current) {
      audioRef.current = new Audio()
    }

    const audio = audioRef.current
    audio.src = audioUrl
    audio.playbackRate = speedRef.current

    // Preload next sentence for 0ms latency transition
    if (index + 1 < activeSentences.length) {
      const nextAudio = new Audio(`/api/tts?text=${encodeURIComponent(activeSentences[index + 1])}&lang=${langKey}`)
      nextAudio.preload = 'auto'
    }

    audio.onplaying = () => {
      setIsBuffering(false)
    }

    audio.oncanplay = () => {
      setIsBuffering(false)
    }

    audio.ontimeupdate = () => {
      if (isPlayingRef.current && audio.duration) {
        const ratio = audio.currentTime / audio.duration
        const currentElapsed = baseStartTime + (ratio * estSegmentDuration)
        setCurrentTime(Math.min(totalDuration, currentElapsed))
      }
    }

    audio.onended = () => {
      if (isPlayingRef.current) {
        const nextIdx = index + 1
        if (nextIdx < activeSentences.length) {
          playSentenceRef.current(nextIdx)
        } else {
          setIsPlaying(false)
          setIsBuffering(false)
          setCurrentTime(totalDuration)
          currentSentenceIdxRef.current = 0
        }
      }
    }

    audio.play().catch(err => {
      console.warn('[Audio Player] play notice:', err)
      setIsBuffering(false)
      if (isPlayingRef.current && index + 1 < activeSentences.length) {
        playSentenceRef.current(index + 1)
      }
    })
  }, [activeSentences, langKey, sentenceStartTimes, sentenceDurations, totalDuration, stopAllPlayback, findBestLadyVoice])

  useEffect(() => {
    playSentenceRef.current = playSentence
  }, [playSentence])

  // Play / Pause toggle
  const togglePlay = () => {
    if (isPlaying) {
      // PAUSE:
      stopAllPlayback(false)
      setIsPlaying(false)
      setIsBuffering(false)
      currentSentenceIdxRef.current = getSentenceIdxForTime(currentTime)
    } else {
      // PLAY / RESUME:
      const targetIdx = getSentenceIdxForTime(currentTime)
      currentSentenceIdxRef.current = targetIdx
      setIsPlaying(true)

      // If audio element has current src loaded and paused, resume playback directly
      if (audioRef.current && audioRef.current.src && !audioRef.current.ended) {
        audioRef.current.playbackRate = speedRef.current
        audioRef.current.play().catch(() => {
          playSentence(targetIdx)
        })
      } else {
        playSentence(targetIdx)
      }
    }
  }

  // Seek to specific timestamp
  const seekToTime = useCallback((targetTime: number) => {
    const clamped = Math.max(0, Math.min(totalDuration, targetTime))
    setCurrentTime(clamped)

    const targetIdx = getSentenceIdxForTime(clamped)
    currentSentenceIdxRef.current = targetIdx

    if (isPlayingRef.current) {
      playSentence(targetIdx)
    } else {
      stopAllPlayback()
    }
  }, [totalDuration, getSentenceIdxForTime, playSentence, stopAllPlayback])

  // Rewind 10 seconds
  const handleRewind10 = () => {
    seekToTime(currentTime - 10)
  }

  // Forward 10 seconds
  const handleForward10 = () => {
    seekToTime(currentTime + 10)
  }

  // Speed cycle: 0.75x -> 1.0x -> 1.25x -> 1.5x -> 2.0x
  const handleSpeedCycle = () => {
    const speeds = [0.75, 1.0, 1.25, 1.5, 2.0]
    const currentIndex = speeds.indexOf(speed)
    const nextSpeed = speeds[(currentIndex + 1) % speeds.length]
    setSpeed(nextSpeed)
    speedRef.current = nextSpeed

    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed
    }

    if (isPlaying) {
      const currentIdx = currentSentenceIdxRef.current
      playSentence(currentIdx)
    }
  }

  // Handle Scrubbing / Progress Bar Click and Drag
  // Uses LTR bounds so both LTR and RTL pages calculate identically
  const calculateSeekFromEvent = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (!progressRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clickX = Math.max(0, Math.min(rect.width, clientX - rect.left))
    const ratio = clickX / rect.width
    return ratio * totalDuration
  }

  const handleProgressMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true)
    const target = calculateSeekFromEvent(e)
    if (target !== undefined) seekToTime(target)
  }

  const handleProgressTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    setIsDragging(true)
    const target = calculateSeekFromEvent(e)
    if (target !== undefined) seekToTime(target)
  }

  // Progress percentage
  const progressPercent = Math.min(100, Math.max(0, (currentTime / totalDuration) * 100))
  const remainingTime = Math.max(0, totalDuration - currentTime)

  return (
    <div className="w-full mt-1 mb-4 p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border border-border bg-card/70 dark:bg-card/50 shadow-xs transition-colors">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* BIG CIRCULAR PLAY / PAUSE BUTTON */}
        <button
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
          className="w-11 h-11 sm:w-12 sm:h-12 rounded-full border-2 border-foreground/80 dark:border-foreground/70 flex items-center justify-center text-foreground hover:bg-muted/80 hover:border-brand-blue hover:text-brand-blue active:scale-95 transition-all cursor-pointer shrink-0 shadow-xs group"
        >
          {isBuffering && isPlaying ? (
            <i className="fa-solid fa-circle-notch fa-spin text-[15px] sm:text-base text-brand-blue"></i>
          ) : isPlaying ? (
            <i className="fa-solid fa-pause text-[15px] sm:text-base group-hover:scale-110 transition-transform"></i>
          ) : (
            <i className="fa-solid fa-play text-[15px] sm:text-base translate-x-0.5 group-hover:scale-110 transition-transform"></i>
          )}
        </button>

        {/* TRACK & CONTROLS */}
        <div className="flex-1 min-w-0">
          {/* Header Row: Label on Left, "Powered By AgriGuru Online" Badge on Right */}
          <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[13px] sm:text-[14px] font-bold text-foreground tracking-tight select-none">
                {displayLabel}
              </span>
              {isBuffering && isPlaying && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse">
                  <i className="fa-solid fa-circle-notch fa-spin text-[11px] text-brand-blue"></i>
                  {langKey === 'ar' ? 'جاري التحميل...' : langKey === 'zh' ? '正在加载...' : 'Loading audio...'}
                </span>
              )}
              {isPlaying && !isBuffering && (
                <span className="inline-flex items-center gap-1 text-[10.5px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  Playing
                </span>
              )}
            </div>

            {/* Custom Development Branding */}
            <div className="inline-flex items-center gap-1.5 text-[10.5px] sm:text-[11px] font-medium text-foreground/75 bg-muted/70 dark:bg-muted/50 px-2.5 py-0.5 rounded-full border border-border/80 select-none shrink-0 shadow-2xs">
              <i className="fa-solid fa-headphones text-[10px] text-amber-500"></i>
              <span>
                Powered by <strong className="font-bold text-foreground">AgriGuru Online</strong>
              </span>
            </div>
          </div>

          {/* PROGRESS SCRUBBER BAR: strictly dir="ltr" so in Arabic the bar and dot move in exact harmony */}
          <div
            ref={progressRef}
            dir="ltr"
            onMouseDown={handleProgressMouseDown}
            onTouchStart={handleProgressTouchStart}
            role="slider"
            aria-valuemin={0}
            aria-valuemax={totalDuration}
            aria-valuenow={currentTime}
            tabIndex={0}
            className="relative w-full h-3 flex items-center cursor-pointer group py-1 select-none"
          >
            {/* Background Track */}
            <div className="w-full h-1.5 rounded-full bg-muted dark:bg-muted/80 overflow-hidden relative">
              {/* Progress Fill */}
              <div
                className="h-full bg-foreground/70 dark:bg-foreground/80 transition-[width] duration-75 rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Draggable Scrubber Thumb */}
            <div
              className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-foreground shadow-sm transition-transform pointer-events-none ${
                isDragging || isPlaying ? 'scale-100 opacity-100' : 'opacity-0 group-hover:opacity-100 group-hover:scale-100'
              }`}
              style={{ left: `calc(${progressPercent}% - 7px)` }}
            />
          </div>

          {/* BOTTOM CONTROLS ROW: dir="ltr" for time progression orientation */}
          <div dir="ltr" className="flex items-center justify-between pt-1 text-xs text-foreground/75 select-none">
            {/* Elapsed Time (e.g. 00:43) */}
            <span className="font-medium tabular-nums text-[11.5px] sm:text-xs min-w-[34px]">
              {formatTime(currentTime)}
            </span>

            {/* Center Controls: -10s Rewind, +10s Forward, Speed Badge */}
            <div className="flex items-center gap-3 sm:gap-4 relative">
              {/* 10s REWIND BUTTON */}
              <button
                type="button"
                onClick={handleRewind10}
                title="Rewind 10 seconds"
                aria-label="Rewind 10 seconds"
                className="relative inline-flex items-center justify-center w-6 h-6 text-foreground/75 hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                <i className="fa-solid fa-rotate-left text-[17px] sm:text-[18px]"></i>
                <span className="absolute text-[7.5px] font-black leading-none top-[53%] left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none">
                  10
                </span>
              </button>

              {/* 10s FORWARD BUTTON */}
              <button
                type="button"
                onClick={handleForward10}
                title="Forward 10 seconds"
                aria-label="Forward 10 seconds"
                className="relative inline-flex items-center justify-center w-6 h-6 text-foreground/75 hover:text-foreground active:scale-95 transition-all cursor-pointer"
              >
                <i className="fa-solid fa-rotate-right text-[17px] sm:text-[18px]"></i>
                <span className="absolute text-[7.5px] font-black leading-none top-[53%] left-1/2 -translate-x-1/2 -translate-y-1/2 select-none pointer-events-none">
                  10
                </span>
              </button>

              {/* SPEED BADGE */}
              <button
                type="button"
                onClick={handleSpeedCycle}
                title="Playback speed"
                className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-muted hover:bg-muted/80 text-foreground/85 border border-border/80 transition-colors cursor-pointer tabular-nums"
              >
                {speed.toFixed(1)}x
              </button>
            </div>

            {/* Remaining Time (e.g. -01:29) */}
            <span className="font-medium tabular-nums text-[11.5px] sm:text-xs min-w-[38px] text-right">
              -{formatTime(remainingTime)}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
