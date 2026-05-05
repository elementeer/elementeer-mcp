export type ElementorTemplateType =
  | 'page'
  | 'section'
  | 'container'
  | 'widget'
  | 'popup'
  | 'kit'
  | 'global-widget';

export interface ElementeerTemplate {
  id: number;
  title: string;
  status: 'publish' | 'draft' | 'private' | 'trash';
  type: ElementorTemplateType;
  author: number;
  date: string;
  modified: string;
  elementor_data?: string; // raw JSON string from _elementor_data
  categories: string[];
  tags: string[];
  shortcode?: string;
}

export interface ElementeerTemplateList {
  templates: ElementeerTemplate[];
  total: number;
  total_pages: number;
}
