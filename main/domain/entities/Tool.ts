import { DynamicStructuredTool, DynamicTool } from "langchain/tools";

export type ToolConfigFieldType = 'api_key' | 'text' | 'number' | 'boolean' | 'array' | 'json';

export interface ToolConfigField {
  key: string;
  label: string;
  type: ToolConfigFieldType;
  required: boolean;
  placeholder?: string;
  description?: string;
  defaultValue?: any;
  itemSchema?: {
    type: 'text' | 'url' | 'path';
    fields?: { key: string; label: string; placeholder?: string }[];
  };
}

export interface ToolMetadata {
  id: string;
  name: string;
  description: string;
  category: 'weather' | 'crypto' | 'app' | 'browser' | 'user' | 'schedule';
  configFields: ToolConfigField[];
}

export interface ToolConfig {
  enabled: boolean;
  settings: Record<string, any>;
}

export type ToolFactory = (config: ToolConfig) => DynamicStructuredTool | DynamicTool;

export class Tool {
  constructor(
    public metadata: ToolMetadata,
    public config: ToolConfig,
    public factory: ToolFactory
  ) {}

  validate(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.config.enabled) {
      return { valid: true, errors: [] };
    }

    for (const field of this.metadata.configFields) {
      if (field.required && !this.config.settings[field.key]) {
        errors.push(`${field.label} is required`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  createLangChainTool(): DynamicStructuredTool | DynamicTool {
    return this.factory(this.config);
  }
}
