export interface MarketReportTranslation {
  lang_code: string
  title: string
  description: string
}

export interface MarketReportItem {
  id: string
  id_no?: string | number
  image_type?: string
  image?: string
  thumbnail?: string
  title?: string
  subject_title?: string
  description?: string
  page_description?: string
  is_active?: boolean
  slug?: string
  file?: string
  file_url?: string
  file_name?: string
  translations?: MarketReportTranslation[]
}

export interface MarketReportsResponse {
  success: number
  message: string
  data?: {
    market_reports?: MarketReportItem[]
    total?: number
  } | MarketReportItem[] | unknown
  response_time?: string
}
