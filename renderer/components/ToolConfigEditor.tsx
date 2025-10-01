import React from 'react';
import { SecretInput } from './SecretInput';
import { ArrayEditor } from './ArrayEditor';

interface ToolConfigField {
  key: string;
  label: string;
  type: string;
  required: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: any;
  itemSchema?: any;
}

interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: string;
  configFields: ToolConfigField[];
}

interface ToolConfig {
  enabled: boolean;
  settings: Record<string, any>;
}

interface ToolConfigEditorProps {
  metadata: ToolMetadata;
  config: ToolConfig;
  onChange: (config: ToolConfig) => void;
}

export const ToolConfigEditor: React.FC<ToolConfigEditorProps> = ({ metadata, config, onChange }) => {
  const handleFieldChange = (key: string, value: any) => {
    onChange({
      ...config,
      settings: {
        ...config.settings,
        [key]: value
      }
    });
  };

  const renderField = (field: ToolConfigField) => {
    const value = config.settings[field.key] ?? field.defaultValue ?? '';

    switch (field.type) {
      case 'api_key':
        return (
          <SecretInput
            value={value}
            onChange={(val) => handleFieldChange(field.key, val)}
          />
        );

      case 'text':
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldChange(field.key, e.target.value)}
            placeholder={field.placeholder}
            className="bg-gray-700 text-white px-4 py-2 rounded-md w-full"
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.key, Number(e.target.value))}
            placeholder={field.placeholder}
            className="bg-gray-700 text-white px-4 py-2 rounded-md w-full"
          />
        );

      case 'boolean':
        return (
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => handleFieldChange(field.key, e.target.checked)}
            className="w-5 h-5"
          />
        );

      case 'array':
        return (
          <ArrayEditor
            items={value || field.defaultValue || []}
            itemSchema={field.itemSchema}
            onChange={(items) => handleFieldChange(field.key, items)}
          />
        );

      case 'json':
        return (
          <textarea
            value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
            onChange={(e) => {
              try {
                const parsed = JSON.parse(e.target.value);
                handleFieldChange(field.key, parsed);
              } catch {
                handleFieldChange(field.key, e.target.value);
              }
            }}
            placeholder={field.placeholder}
            className="bg-gray-700 text-white px-4 py-2 rounded-md w-full font-mono text-sm"
            rows={4}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-3 pl-8 border-l-2 border-gray-600 mt-2">
      {metadata.configFields.map(field => (
        <div key={field.key} className="flex flex-col gap-2">
          <label className="text-md">
            {field.label}
            {field.required && <span className="text-red-400 ml-1">*</span>}
          </label>
          {renderField(field)}
          {field.description && (
            <span className="text-sm text-gray-400">{field.description}</span>
          )}
        </div>
      ))}
    </div>
  );
};
