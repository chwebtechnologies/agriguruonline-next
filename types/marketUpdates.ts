export interface MarketUpdateTranslation {
  lang_code: string
  title: string
  description: string
}

export interface MarketUpdateItem {
  id: string
  image_type: string
  image: string
  thumbnail: string
  title: string
  description: string
  page_description: string
  is_active: boolean
  slug: string
  created_at?: string
  translations: MarketUpdateTranslation[]
}

export interface MarketUpdatesResponse {
  success: number
  message: string
  data: {
    flyers: MarketUpdateItem[]
    total: number
  }
  response_time: string
}
