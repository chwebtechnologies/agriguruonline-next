export interface MarketReportTranslation {
  lang_code: string
  title?: string
  subject_title?: string
  description?: string
}

export interface MarketReportItem {
  id: string
  _id?: string
  id_no?: string | number
  report_no?: string | number
  image_type?: string
  image?: string
  thumbnail?: string
  title?: string
  subject_title?: string
  description?: string
  page_description?: string
  category?: string | { id?: string; name?: string; category_name?: string; title?: string; slug?: string } | any
  category_name?: string
  categories?: any[]
  publish_date?: string
  created_at?: string
  report_date?: string
  posting_date?: string
  date?: string
  is_active?: boolean
  slug?: string
  file?: string
  file_url?: string
  pdf_file?: string
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

