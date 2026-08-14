/**
 * REAL SECTION FIXTURE — Page 2340, Container 1c775162
 * "Was sich typischerweise sofort verbessert" (Handwerk-Variante)
 *
 * Bezugsquelle:   Respira `find_element` (include=content, post_id=2340) am 2026-08-12
 * Site:           fusionaize-preview / preview.fusionaize.com
 * Page:           2340
 * Container:      1c775162, admin_label "Was sich typischerweise sofort verbessert"
 * Pfad:           [3] (auf 2340; auf 2618 liegt derselbe Container unter [4])
 * Builder:        Elementor 4.2.2 (Pro 4.2.1)
 * Theme:          Astra 4.13.8
 *
 * Struktur:       1c775162 → addfe73 (FAQ, 3 Kinder) → d963208 → d2427fe (5 Icon-Boxen)
 * Icon-Box-IDs:   1cefa87, c2068b0, 4c63abf, 8ae0619, 3a4b09c
 *
 * Nutzung:        diff_pages-Test gegen reale Daten in diff-pages.test.ts
 *                 Gegenprobe zu PAGE_2618_SECTION4_1C775162.
 *
 * BEFUND:         Struktur UND IDs identisch zu 2618 (2340 ist Kopie von 2618),
 *                 TEXTE sind handwerk-spezifisch und weichen von 2618 (Beauty) ab.
 *                 Die Gap-Report-Annahme "3 statt 5 Icon-Boxen" ist widerlegt —
 *                 beide Seiten haben 5 icon-box-Widgets.
 *
 * Text-Diffs 2618 (Beauty) → 2340 (Handwerk):
 *   d5b8628  "oft schnell ... weitergeführt"              → "bei den meisten Betrieben sofort … vorqualifiziert und sauber übergeben"
 *   1cefa87  "…erreichbar" (ohne Punkt)                  → "…erreichbar." (mit Punkt)
 *   c2068b0  "Ohne endloses Hin und Her im Chat"          → "Ohne endlose Rückfrage-Ketten im Chat."
 *   4c63abf  "Mehr gebuchte Termine"                      → "Weniger Leerlauf im Kalender"
 *   8ae0619  "Weniger No-Shows"                           → "Weniger Rückfragen im Büro"
 *   3a4b09c  "Bessere Auslastung"                         → "Mehr passende Termine"
 */

export const PAGE_2340_SECTION4_1C775162: Record<string, unknown>[] = [
  {
    id: '1c775162',
    elType: 'container',
    settings: {
      padding: { unit: 'px', isLinked: true, top: '0', right: '0', bottom: '0', left: '0' },
      background_background: 'classic',
      background_color: '#FFFFFF',
      flex_gap: { unit: 'px', size: 0, sizes: [] },
      width: { unit: 'custom', size: 'auto', sizes: [] },
      border_width: { unit: 'custom', isLinked: false, top: '0px', right: '0px', bottom: '0px', left: '0px' },
      padding_tablet: { unit: 'custom', isLinked: false, top: '96px', right: '0px', bottom: '96px', left: '0px' },
      border_width_tablet: { unit: 'custom', isLinked: false, top: '0px', right: '0px', bottom: '0px', left: '0px' },
      padding_mobile: { unit: 'px', isLinked: false, top: '30', right: '0', bottom: '30', left: '0' },
      width_mobile: { unit: 'custom', size: 'auto', sizes: [] },
      border_width_mobile: { unit: 'custom', isLinked: false, top: '0px', right: '0px', bottom: '0px', left: '0px' },
      _custom_css: 'selector{display: block;}selector::before{border-bottom-width: 0px;border-left-width: 0px;border-right-width: 0px;border-top-width: 0px;}selector::after{border-bottom-width: 0px;border-left-width: 0px;border-right-width: 0px;border-top-width: 0px;}',
      defaultEditSettings: { defaultEditRoute: 'content' },
      editSettings: { defaultEditRoute: 'layout' },
      display_condition_list: [{ display_condition_login_status: 'subscriber', _id: 'd5ee63b' }],
      jet_parallax_layout_list: [],
      __globals__: { background_color: '' },
      _title: 'Was sich typischerweise sofort verbessert',
    },
    elements: [
      {
        id: 'addfe73',
        elType: 'container',
        settings: {
          flex_direction: 'column',
          flex_justify_content: 'center',
          flex_align_items: 'center',
          padding: { unit: 'px', top: '80', right: '0', bottom: '60', left: '0', isLinked: false },
          padding_tablet: { unit: 'px', top: '40', right: '20', bottom: '40', left: '20', isLinked: false },
          jet_parallax_layout_list: [],
          display_condition_list: [{ display_condition_login_status: 'subscriber', _id: '2f74dbb' }],
          background_background: 'classic',
          __globals__: { background_color: 'globals/colors?id=1b8cf39' },
          boxed_width: { unit: 'px', size: 1024, sizes: [] },
          _title: 'FAQ',
          padding_mobile: { unit: 'px', top: '20', right: '20', bottom: '20', left: '20', isLinked: true },
          content_width: 'full',
        },
        elements: [
          {
            id: '4181850',
            elType: 'widget',
            widgetType: 'heading',
            settings: {
              title: 'Was sich typischerweise sofort verbessert',
              align: 'center',
              typography_typography: 'custom',
              typography_font_family: 'Montserrat',
              typography_font_size: { unit: 'px', size: 36, sizes: [] },
              typography_font_weight: '600',
              typography_line_height: { unit: 'em', size: '', sizes: [] },
              _margin: { unit: 'px', top: '10', right: '0', bottom: '0', left: '0', isLinked: false },
              __globals__: { title_color: 'globals/colors?id=text' },
              title_color: '#17324C',
              typography_font_size_tablet: { unit: 'px', size: 32, sizes: [] },
              typography_font_size_mobile: { unit: 'px', size: 28, sizes: [] },
            },
            elements: [],
          },
          {
            id: 'd5b8628',
            elType: 'widget',
            widgetType: 'text-editor',
            settings: {
              editor: '<p>Diese Dinge verbessern sich bei den meisten Betrieben sofort – weil Anfragen schneller angenommen, besser vorqualifiziert und sauber übergeben werden.</p>',
              align: 'center',
              typography_typography: 'custom',
              typography_font_family: 'Open Sans',
              typography_font_size: { unit: 'px', size: 20, sizes: [] },
              typography_font_weight: '300',
              _padding: { unit: 'px', top: '0', right: '110', bottom: '0', left: '110', isLinked: false },
              __globals__: { text_color: 'globals/colors?id=text' },
              typography_font_size_mobile: { unit: 'px', size: 15, sizes: [] },
            },
            elements: [],
          },
          {
            id: 'd963208',
            elType: 'container',
            settings: {
              boxed_width: { unit: 'px', size: 800, sizes: [] },
              display_condition_list: [{ display_condition_login_status: 'subscriber', _id: '37564f0' }],
              jet_parallax_layout_list: [],
            },
            elements: [
              {
                id: 'd2427fe',
                elType: 'container',
                settings: {
                  content_width: 'full',
                  border_border: 'none',
                  border_width: { unit: 'px', top: '1', right: '1', bottom: '1', left: '1', isLinked: true },
                  border_color: '#54ABEE4D',
                  border_radius: { unit: 'px', top: '14', right: '14', bottom: '14', left: '14', isLinked: true },
                  box_shadow_box_shadow_type: 'yes',
                  box_shadow_box_shadow: { horizontal: 4, vertical: 4, blur: 10, spread: -10, color: 'rgba(0,0,0,0.5)' },
                  margin: { unit: 'px', top: '0', right: '0', bottom: '32', left: '0', isLinked: false },
                  padding: { unit: 'px', top: '36', right: '24', bottom: '24', left: '24', isLinked: false },
                  display_condition_list: [{ display_condition_login_status: 'subscriber', _id: 'cd8255f' }],
                  __globals__: { border_color: '', background_color: 'globals/colors?id=9b263b8' },
                  _title: 'How It Works',
                  flex_gap: { column: '0', row: '0', isLinked: true, unit: 'px', size: 0 },
                  jet_parallax_layout_list: [],
                  background_background: 'classic',
                },
                elements: [
                  {
                    id: '1cefa87',
                    elType: 'widget',
                    widgetType: 'icon-box',
                    settings: {
                      selected_icon: { value: 'fas fa-check', library: 'fa-solid' },
                      title_text: 'Weniger verpasste Anfragen',
                      description_text: 'Auch außerhalb der Öffnungszeiten erreichbar.',
                      title_size: 'div',
                      position: 'left',
                      icon_space: { unit: 'px', size: 17, sizes: [] },
                      primary_color: '#2EA75D',
                      icon_size: { unit: 'px', size: 24, sizes: [] },
                      title_typography_typography: 'custom',
                      title_typography_font_family: 'Open Sans',
                      title_typography_font_size: { unit: 'px', size: 18, sizes: [] },
                      title_typography_font_weight: '600',
                      title_color: '#1F497D',
                      _margin: { unit: 'px', top: '0', right: '0', bottom: '20', left: '0', isLinked: false },
                      __globals__: { title_color: 'globals/colors?id=text', primary_color: 'globals/colors?id=primary' },
                    },
                    elements: [],
                  },
                  {
                    id: 'c2068b0',
                    elType: 'widget',
                    widgetType: 'icon-box',
                    settings: {
                      selected_icon: { value: 'fas fa-check', library: 'fa-solid' },
                      title_text: 'Schnellere Rückmeldung',
                      description_text: 'Ohne endlose Rückfrage-Ketten im Chat.',
                      title_size: 'div',
                      position: 'left',
                      icon_space: { unit: 'px', size: 17, sizes: [] },
                      primary_color: '#2EA75D',
                      icon_size: { unit: 'px', size: 24, sizes: [] },
                      title_typography_typography: 'custom',
                      title_typography_font_family: 'Open Sans',
                      title_typography_font_size: { unit: 'px', size: 18, sizes: [] },
                      title_typography_font_weight: '600',
                      title_color: '#1F497D',
                      _margin: { unit: 'px', top: '0', right: '0', bottom: '20', left: '0', isLinked: false },
                      __globals__: { title_color: 'globals/colors?id=text', primary_color: 'globals/colors?id=primary' },
                    },
                    elements: [],
                  },
                  {
                    id: '4c63abf',
                    elType: 'widget',
                    widgetType: 'icon-box',
                    settings: {
                      selected_icon: { value: 'fas fa-check', library: 'fa-solid' },
                      title_text: 'Weniger Leerlauf im Kalender',
                      description_text: 'Weil freie Termine und Rückrufslots schneller wieder gefüllt werden.',
                      title_size: 'div',
                      position: 'left',
                      icon_space: { unit: 'px', size: 17, sizes: [] },
                      primary_color: '#2EA75D',
                      icon_size: { unit: 'px', size: 24, sizes: [] },
                      title_typography_typography: 'custom',
                      title_typography_font_family: 'Open Sans',
                      title_typography_font_size: { unit: 'px', size: 18, sizes: [] },
                      title_typography_font_weight: '600',
                      title_color: '#1F497D',
                      _margin: { unit: 'px', top: '0', right: '0', bottom: '20', left: '0', isLinked: false },
                      __globals__: { title_color: 'globals/colors?id=text', primary_color: 'globals/colors?id=primary' },
                    },
                    elements: [],
                  },
                  {
                    id: '8ae0619',
                    elType: 'widget',
                    widgetType: 'icon-box',
                    settings: {
                      selected_icon: { value: 'fas fa-check', library: 'fa-solid' },
                      title_text: 'Weniger Rückfragen im Büro',
                      description_text: 'Weil alle Angaben von Anfang an vollständig ankommen.',
                      title_size: 'div',
                      position: 'left',
                      icon_space: { unit: 'px', size: 17, sizes: [] },
                      primary_color: '#2EA75D',
                      icon_size: { unit: 'px', size: 24, sizes: [] },
                      title_typography_typography: 'custom',
                      title_typography_font_family: 'Open Sans',
                      title_typography_font_size: { unit: 'px', size: 18, sizes: [] },
                      title_typography_font_weight: '600',
                      title_color: '#1F497D',
                      _margin: { unit: 'px', top: '0', right: '0', bottom: '20', left: '0', isLinked: false },
                      __globals__: { title_color: 'globals/colors?id=text', primary_color: 'globals/colors?id=primary' },
                    },
                    elements: [],
                  },
                  {
                    id: '3a4b09c',
                    elType: 'widget',
                    widgetType: 'icon-box',
                    settings: {
                      selected_icon: { value: 'fas fa-check', library: 'fa-solid' },
                      title_text: 'Mehr passende Termine',
                      description_text: 'Weil unpassende Anfragen vorher aussortiert werden.',
                      title_size: 'div',
                      position: 'left',
                      icon_space: { unit: 'px', size: 17, sizes: [] },
                      primary_color: '#2EA75D',
                      icon_size: { unit: 'px', size: 24, sizes: [] },
                      title_typography_typography: 'custom',
                      title_typography_font_family: 'Open Sans',
                      title_typography_font_size: { unit: 'px', size: 18, sizes: [] },
                      title_typography_font_weight: '600',
                      title_color: '#1F497D',
                      _margin: { unit: 'px', top: '0', right: '0', bottom: '20', left: '0', isLinked: false },
                      __globals__: { title_color: 'globals/colors?id=text', primary_color: 'globals/colors?id=primary' },
                    },
                    elements: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  },
];
