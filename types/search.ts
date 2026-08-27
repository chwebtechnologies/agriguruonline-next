export interface SearchProductPort {
  id: string
  price: number
  port?: {
    id?: string
    name: string
    unlocode?: string
    city?: string
  }
  destination_ports?: Array<{
    port?: {
      id?: string
      name: string
      unlocode?: string
      city?: string
    }
  }>
}

export interface SearchProduct {
  id: string
  name: string
  slug: string
  product_code: string
  loading_ports?: SearchProductPort[]
  category?: {
    id: string
    name: string
    slug?: string
  }
  country?: {
    id: string
    name: string
    flag: string
    iso2: string
  }
  image_type?: string
  image?: string
  thumbnail?: string
  tags?: string
  is_marketed?: boolean
  best_seller?: boolean
  frequently_search?: boolean
  quality_specification?: string
  is_active?: boolean
}

export interface SearchApiResponse {
  success: number
  message: string
  data: {
    products: SearchProduct[]
    total: number
  }
  response_time?: string
}

export interface RecentSearchItem {
  id: string
  query: string
  timestamp: number
  type?: 'query' | 'product' | 'category'
  title?: string
  url?: string
}
