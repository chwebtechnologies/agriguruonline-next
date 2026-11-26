export interface CmsContentItem {
  field_id: string;
  type: string;
  header?: string;
  image_url: string;
  image?: string;
  text_content: string;
  index: number;
}

export interface CmsPageData {
  id: string;
  title?: string;
  page_title?: string;
  meta_title?: string;
  name?: string;
  meta_keywords?: string;
  keywords?: string;
  meta_description?: string;
  meta_desc?: string;
  description?: string;
  link_type: string;
  page_description: CmsContentItem[];
  url?: string;
  is_footer_content: boolean;
  footer_section?: string;
  is_active: boolean;
  slug: string;
  social_image?: string;
  og_image?: string;
  social_preview_image?: string;
  preview_image?: string;
  meta_image?: string;
  image?: string;
  image_url?: string;
  banner_image?: string;
  cover_image?: string;
  thumbnail?: string;
}

export interface CmsContentResponse {
  success: number;
  message: string;
  data: CmsPageData;
  response_time?: string;
}

export interface FooterLinkItem {
  name: string;
  title: string;
  link_type: 'PAGE' | 'URL' | string;
  slug: string;
  url: string;
}

export type FooterSections = Record<string, FooterLinkItem[]>;

export interface FooterResponse {
  success: number;
  message: string;
  data: FooterSections;
  response_time?: string;
}
