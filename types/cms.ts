export interface CmsContentItem {
  field_id: string;
  type: string;
  header?: string;
  image_url: string;
  text_content: string;
  index: number;
}

export interface CmsPageData {
  id: string;
  title: string;
  name: string;
  meta_keywords?: string;
  meta_description?: string;
  link_type: string;
  page_description: CmsContentItem[];
  url?: string;
  is_footer_content: boolean;
  footer_section?: string;
  is_active: boolean;
  slug: string;
}

export interface CmsContentResponse {
  success: number;
  message: string;
  data: CmsPageData;
  response_time?: string;
}
