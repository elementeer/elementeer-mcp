export interface ControlSchema {
  type: string;
  label?: string;
  description?: string;
  default?: unknown;
  enum?: string[];
  required?: boolean;
}

export interface WidgetSchema {
  widget_type: string;
  source: 'core' | 'essential-addons' | 'ultimate-addons' | 'powerpack' | 'elementskit' | 'happy-addons' | 'premium-addons' | 'the-plus-addons' | 'crocoblock';
  text_fields: string[];
  link_fields: string[];
  media_fields: string[];
  controls: Record<string, ControlSchema>;
  notes?: string;
}

export interface DescribeWidgetResult {
  status: 'supported' | 'unsupported';
  widget_type: string;
  schema?: WidgetSchema;
  hint?: string;
  supported_types?: string[];
}

const CORE_SCHEMAS: Record<string, WidgetSchema> = {
  heading: {
    widget_type: 'heading',
    source: 'core',
    text_fields: ['title'],
    link_fields: ['link'],
    media_fields: [],
    controls: {
      title: { type: 'text', label: 'Title', required: true },
      link: { type: 'url', label: 'Link' },
      tag: { type: 'select', label: 'HTML Tag', enum: ['h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'div', 'span', 'p'] },
      align: { type: 'select', label: 'Alignment', enum: ['left', 'center', 'right', 'justify'] },
      title_color: { type: 'color', label: 'Text Color' },
      typography_typography: { type: 'typography', label: 'Typography' },
    },
  },
  'text-editor': {
    widget_type: 'text-editor',
    source: 'core',
    text_fields: ['editor'],
    link_fields: [],
    media_fields: [],
    controls: {
      editor: { type: 'wysiwyg', label: 'Content', required: true },
      text_color: { type: 'color', label: 'Text Color' },
      typography_typography: { type: 'typography', label: 'Typography' },
      drop_cap: { type: 'switch', label: 'Drop Cap' },
    },
  },
  button: {
    widget_type: 'button',
    source: 'core',
    text_fields: ['text'],
    link_fields: ['link'],
    media_fields: [],
    controls: {
      text: { type: 'text', label: 'Button Text', required: true },
      link: { type: 'url', label: 'Link' },
      button_type: { type: 'select', label: 'Type', enum: ['default', 'info', 'success', 'warning', 'danger'] },
      button_size: { type: 'select', label: 'Size', enum: ['xs', 'sm', 'md', 'lg', 'xl'] },
      icon: { type: 'icon', label: 'Icon' },
      icon_align: { type: 'select', label: 'Icon Position', enum: ['left', 'right'] },
    },
  },
  image: {
    widget_type: 'image',
    source: 'core',
    text_fields: ['caption'],
    link_fields: ['link'],
    media_fields: ['image'],
    controls: {
      image: { type: 'media', label: 'Image', required: true },
      image_size: { type: 'select', label: 'Image Size', enum: ['thumbnail', 'medium', 'medium_large', 'large', 'full', 'custom'] },
      caption: { type: 'text', label: 'Caption' },
      link: { type: 'url', label: 'Link' },
      align: { type: 'select', label: 'Alignment', enum: ['left', 'center', 'right'] },
    },
  },
  'icon-box': {
    widget_type: 'icon-box',
    source: 'core',
    text_fields: ['title_text', 'description_text'],
    link_fields: ['link'],
    media_fields: ['icon'],
    controls: {
      title_text: { type: 'text', label: 'Title', required: true },
      description_text: { type: 'textarea', label: 'Description' },
      icon: { type: 'icon', label: 'Icon' },
      link: { type: 'url', label: 'Link' },
      title_size: { type: 'select', label: 'Title Size', enum: ['default', 'small', 'medium', 'large', 'xl'] },
      icon_position: { type: 'select', label: 'Icon Position', enum: ['top', 'left'] },
    },
  },
  'icon-list': {
    widget_type: 'icon-list',
    source: 'core',
    text_fields: ['text'],
    link_fields: ['link'],
    media_fields: ['icon'],
    controls: {
      text: { type: 'text', label: 'Text', required: true },
      icon: { type: 'icon', label: 'Icon' },
      link: { type: 'url', label: 'Link' },
    },
    notes: 'icon-list items are in settings.icon_list[]. Each item has text, icon, and link fields.',
  },
  testimonial: {
    widget_type: 'testimonial',
    source: 'core',
    text_fields: ['testimonial_content', 'testimonial_name', 'testimonial_job'],
    link_fields: [],
    media_fields: ['testimonial_image'],
    controls: {
      testimonial_content: { type: 'textarea', label: 'Content', required: true },
      testimonial_name: { type: 'text', label: 'Name' },
      testimonial_job: { type: 'text', label: 'Title' },
      testimonial_image: { type: 'media', label: 'Image' },
    },
  },
  counter: {
    widget_type: 'counter',
    source: 'core',
    text_fields: ['title', 'prefix', 'suffix'],
    link_fields: [],
    media_fields: [],
    controls: {
      title: { type: 'text', label: 'Title' },
      starting_number: { type: 'number', label: 'Starting Number' },
      ending_number: { type: 'number', label: 'Ending Number', required: true },
      prefix: { type: 'text', label: 'Prefix' },
      suffix: { type: 'text', label: 'Suffix' },
    },
  },
  'progress-bar': {
    widget_type: 'progress-bar',
    source: 'core',
    text_fields: ['title', 'inner_text'],
    link_fields: [],
    media_fields: [],
    controls: {
      title: { type: 'text', label: 'Title', required: true },
      inner_text: { type: 'text', label: 'Inner Text' },
      percent: { type: 'number', label: 'Percentage', required: true },
      display_percentage: { type: 'select', label: 'Display Percentage', enum: ['show', 'hide'] },
    },
  },
  tabs: {
    widget_type: 'tabs',
    source: 'core',
    text_fields: ['tab_title', 'tab_content'],
    link_fields: [],
    media_fields: [],
    controls: {
      tab_title: { type: 'text', label: 'Tab Title', required: true },
      tab_content: { type: 'wysiwyg', label: 'Tab Content' },
    },
    notes: 'tabs items are in settings.tabs[]. Each tab has tab_title and tab_content fields.',
  },
  accordion: {
    widget_type: 'accordion',
    source: 'core',
    text_fields: ['tab_title', 'tab_content'],
    link_fields: [],
    media_fields: [],
    controls: {
      tab_title: { type: 'text', label: 'Title', required: true },
      tab_content: { type: 'wysiwyg', label: 'Content' },
    },
    notes: 'accordion items are in settings.tabs[]. Each item has tab_title and tab_content fields.',
  },
  toggle: {
    widget_type: 'toggle',
    source: 'core',
    text_fields: ['tab_title', 'tab_content'],
    link_fields: [],
    media_fields: [],
    controls: {
      tab_title: { type: 'text', label: 'Title', required: true },
      tab_content: { type: 'wysiwyg', label: 'Content' },
    },
  },
  alert: {
    widget_type: 'alert',
    source: 'core',
    text_fields: ['alert_title', 'alert_description'],
    link_fields: [],
    media_fields: [],
    controls: {
      alert_title: { type: 'text', label: 'Title', required: true },
      alert_description: { type: 'textarea', label: 'Description' },
      alert_type: { type: 'select', label: 'Type', enum: ['info', 'success', 'warning', 'danger'] },
    },
  },
  form: {
    widget_type: 'form',
    source: 'core',
    text_fields: ['form_name', 'button_text', 'success_message', 'error_message'],
    link_fields: ['redirect_url'],
    media_fields: [],
    controls: {
      form_name: { type: 'text', label: 'Form Name' },
      button_text: { type: 'text', label: 'Submit Button Text' },
      success_message: { type: 'textarea', label: 'Success Message' },
      error_message: { type: 'textarea', label: 'Error Message' },
      form_fields: { type: 'repeater', label: 'Form Fields' },
      redirect_url: { type: 'url', label: 'Redirect URL' },
    },
    notes: 'form fields are in settings.form_fields[]. Each field has field_label, field_type, and placeholder fields.',
  },
  divider: {
    widget_type: 'divider',
    source: 'core',
    text_fields: ['text'],
    link_fields: [],
    media_fields: [],
    controls: {
      text: { type: 'text', label: 'Text' },
      style: { type: 'select', label: 'Style', enum: ['solid', 'dashed', 'dotted', 'double'] },
    },
  },
  spacer: {
    widget_type: 'spacer',
    source: 'core',
    text_fields: [],
    link_fields: [],
    media_fields: [],
    controls: {
      space: { type: 'slider', label: 'Space', required: true },
    },
  },
  'google-maps': {
    widget_type: 'google-maps',
    source: 'core',
    text_fields: ['address'],
    link_fields: [],
    media_fields: [],
    controls: {
      address: { type: 'text', label: 'Address', required: true },
      zoom: { type: 'slider', label: 'Zoom' },
    },
  },
  video: {
    widget_type: 'video',
    source: 'core',
    text_fields: ['title'],
    link_fields: ['youtube_url', 'vimeo_url', 'external_url'],
    media_fields: [],
    controls: {
      title: { type: 'text', label: 'Title' },
      youtube_url: { type: 'url', label: 'YouTube URL' },
      vimeo_url: { type: 'url', label: 'Vimeo URL' },
      external_url: { type: 'url', label: 'External URL' },
    },
  },
  social: {
    widget_type: 'social-icons',
    source: 'core',
    text_fields: [],
    link_fields: ['url'],
    media_fields: [],
    controls: {
      url: { type: 'url', label: 'URL', required: true },
      icon: { type: 'icon', label: 'Icon' },
    },
    notes: 'social icons are in settings.social_icon_list[]. Each item has social_icon and link fields.',
  },
};

const EA_SCHEMAS: Record<string, WidgetSchema> = {
  'eael-advanced-heading': {
    widget_type: 'eael-advanced-heading',
    source: 'essential-addons',
    text_fields: ['eael_heading', 'eael_sub_heading'],
    link_fields: ['eael_link'],
    media_fields: [],
    controls: {
      eael_heading: { type: 'text', label: 'Heading', required: true },
      eael_sub_heading: { type: 'text', label: 'Sub Heading' },
      eael_link: { type: 'url', label: 'Link' },
    },
  },
  'eael-advanced-list': {
    widget_type: 'eael-advanced-list',
    source: 'essential-addons',
    text_fields: ['eael_text'],
    link_fields: ['eael_link'],
    media_fields: ['eael_icon'],
    controls: {
      eael_text: { type: 'text', label: 'Text', required: true },
      eael_icon: { type: 'icon', label: 'Icon' },
      eael_link: { type: 'url', label: 'Link' },
    },
  },
  'eael-cta-box': {
    widget_type: 'eael-cta-box',
    source: 'essential-addons',
    text_fields: ['eael_cta_title', 'eael_cta_content', 'eael_cta_btn_text'],
    link_fields: ['eael_cta_btn_link'],
    media_fields: ['eael_cta_img'],
    controls: {
      eael_cta_title: { type: 'text', label: 'Title', required: true },
      eael_cta_content: { type: 'textarea', label: 'Content' },
      eael_cta_btn_text: { type: 'text', label: 'Button Text' },
      eael_cta_btn_link: { type: 'url', label: 'Button Link' },
      eael_cta_img: { type: 'media', label: 'Image' },
    },
  },
  'eael-feature-list': {
    widget_type: 'eael-feature-list',
    source: 'essential-addons',
    text_fields: ['eael_title', 'eael_content'],
    link_fields: ['eael_link'],
    media_fields: ['eael_icon'],
    controls: {
      eael_title: { type: 'text', label: 'Title', required: true },
      eael_content: { type: 'textarea', label: 'Content' },
      eael_icon: { type: 'icon', label: 'Icon' },
      eael_link: { type: 'url', label: 'Link' },
    },
  },
  'eael-post-grid': {
    widget_type: 'eael-post-grid',
    source: 'essential-addons',
    text_fields: ['eael_show_load_more_text'],
    link_fields: [],
    media_fields: [],
    controls: {
      eael_post_grid_columns: { type: 'select', label: 'Columns' },
      eael_post_grid_post_count: { type: 'number', label: 'Post Count' },
      eael_show_load_more_text: { type: 'text', label: 'Load More Text' },
    },
  },
  'eael-image-accordion': {
    widget_type: 'eael-image-accordion',
    source: 'essential-addons',
    text_fields: ['eael_title', 'eael_content'],
    link_fields: ['eael_link'],
    media_fields: ['eael_image'],
    controls: {
      eael_title: { type: 'text', label: 'Title', required: true },
      eael_content: { type: 'textarea', label: 'Content' },
      eael_image: { type: 'media', label: 'Image' },
      eael_link: { type: 'url', label: 'Link' },
    },
  },
};

const UAE_SCHEMAS: Record<string, WidgetSchema> = {
  'uael-advanced-heading': {
    widget_type: 'uael-advanced-heading',
    source: 'ultimate-addons',
    text_fields: ['heading_title', 'sub_heading'],
    link_fields: ['heading_link'],
    media_fields: [],
    controls: {
      heading_title: { type: 'text', label: 'Heading', required: true },
      sub_heading: { type: 'text', label: 'Sub Heading' },
      heading_link: { type: 'url', label: 'Link' },
    },
  },
  'uael-image-gallery': {
    widget_type: 'uael-image-gallery',
    source: 'ultimate-addons',
    text_fields: ['gallery_title'],
    link_fields: [],
    media_fields: ['gallery_images'],
    controls: {
      gallery_title: { type: 'text', label: 'Gallery Title' },
      gallery_images: { type: 'gallery', label: 'Images' },
    },
  },
  'uael-faq': {
    widget_type: 'uael-faq',
    source: 'ultimate-addons',
    text_fields: ['question', 'answer'],
    link_fields: [],
    media_fields: [],
    controls: {
      question: { type: 'text', label: 'Question', required: true },
      answer: { type: 'textarea', label: 'Answer' },
    },
  },
};

const ALL_SCHEMAS: Record<string, WidgetSchema> = {
  ...CORE_SCHEMAS,
  ...EA_SCHEMAS,
  ...UAE_SCHEMAS,
};

export function describeWidgetType(widgetType: string): DescribeWidgetResult {
  const normalized = widgetType.toLowerCase().trim();

  if (ALL_SCHEMAS[normalized]) {
    return {
      status: 'supported',
      widget_type: normalized,
      schema: ALL_SCHEMAS[normalized],
    };
  }

  if (ALL_SCHEMAS[widgetType]) {
    return {
      status: 'supported',
      widget_type: widgetType,
      schema: ALL_SCHEMAS[widgetType],
    };
  }

  const supported = Object.keys(ALL_SCHEMAS).sort();
  const sourceHint: string[] = [];
  if (Object.keys(CORE_SCHEMAS).includes(normalized) || CORE_SCHEMAS[widgetType]) {
    return { status: 'supported', widget_type: widgetType, schema: CORE_SCHEMAS[widgetType] || CORE_SCHEMAS[normalized] };
  }

  return {
    status: 'unsupported',
    widget_type: widgetType,
    hint: `Widget type "${widgetType}" is not yet instrumented. Core Elementor widgets (${Object.keys(CORE_SCHEMAS).length}), Essential Addons widgets (${Object.keys(EA_SCHEMAS).length}), and Ultimate Addons widgets (${Object.keys(UAE_SCHEMAS).length}) are available.`,
    supported_types: supported,
  };
}

export function getSupportedWidgetTypes(): string[] {
  return Object.keys(ALL_SCHEMAS).sort();
}

export function getWidgetSources(): Record<string, number> {
  const sources: Record<string, number> = { core: 0 };
  for (const schema of Object.values(ALL_SCHEMAS)) {
    sources[schema.source] = (sources[schema.source] || 0) + 1;
  }
  return sources;
}
