import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ElementeerClient } from '../client.js';

const formFieldSchema = z.object({
  type: z.enum(['text', 'email', 'textarea', 'select', 'checkbox', 'radio', 'date', 'number', 'tel', 'url'])
    .describe('Field type'),
  label: z.string().describe('Field label shown to users'),
  required: z.boolean().default(false).describe('Whether field is required'),
});

export function registerCreateFormTools(
  server: McpServer,
  getClient: (siteId?: string) => ElementeerClient,
): void {

  server.tool(
    'create_form',
    'Create a new Elementor form and save it as a reusable widget template. Accepts form name, field definitions, optional email recipient, and success message. Returns the created template ID.',
    {
      site_id: z.string().optional(),
      form_name: z.string().min(1).describe('Name for the form (used as template title)'),
      fields: z.array(formFieldSchema).min(1).max(20)
        .describe('Form field definitions: type, label, and required flag'),
      email_to: z.string().email().optional()
        .describe('Email address to send submissions to (optional)'),
      success_message: z.string().optional()
        .describe('Custom success message shown after submission (optional)'),
    },
    async ({ site_id, form_name, fields, email_to, success_message }) => {
      const client = getClient(site_id);

      const formFields = fields.map((field, index) => {
        const fieldId = `field_${index + 1}`;
        const base = {
          id: fieldId,
          type: field.type,
          field_label: field.label,
          placeholder: '',
          required: field.required,
          width: '100',
        };

        if (['select', 'radio', 'checkbox'].includes(field.type)) {
          return { ...base, field_options: '', allow_multiple: field.type === 'checkbox' ? true : undefined };
        }

        return base;
      });

      const widgetId = `elementor-form-${Date.now()}`;

      const formWidget = {
        id: widgetId,
        elType: 'widget',
        settings: {
          form_name: form_name,
          form_fields: formFields,
          submit_actions: email_to ? ['email'] : ['email'],
          email_to: email_to || '',
          email_subject: `New submission from ${form_name}`,
          email_from: '{site_admin_email}',
          email_from_name: '{site_name}',
          email_reply_to: '{email}',
          email_content: formFields.map(f => `[${f.field_label}]: {${f.id}}`).join('\n'),
          success_message: success_message || 'Thank you! Your message has been sent.',
        },
        elements: [],
      };

      const created = await client.createTemplate({
        title: form_name,
        type: 'widget',
        status: 'draft',
        elementor_data: JSON.stringify([formWidget]),
      });

      const lines = [
        `Form template created`,
        `   Template ID: ${created.id}`,
        `   Form name: ${form_name}`,
        `   Fields: ${fields.length} field(s)`,
        `   Email: ${email_to || 'not configured'}`,
        '',
        'Next steps:',
        '  1. Use update_page_data to insert this form widget into a page',
        '  2. The form will use global colors/typography automatically',
      ];

      return { content: [{ type: 'text', text: lines.join('\n') }] };
    },
  );
}
