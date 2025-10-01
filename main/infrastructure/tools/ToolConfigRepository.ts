import Store from 'electron-store';
import { ToolConfig } from '../../domain/entities/Tool';

let toolConfigStore: Store | null = null;

const getToolConfigStore = (): Store => {
  if (!toolConfigStore) {
    toolConfigStore = new Store({ name: 'tool_config' });
  }
  return toolConfigStore;
};

export class ToolConfigRepository {
  getAllToolConfigs(): Record<string, ToolConfig> {
    return getToolConfigStore().get('tools') as Record<string, ToolConfig> || {};
  }

  getToolConfig(toolId: string): ToolConfig {
    const allConfigs = this.getAllToolConfigs();
    return allConfigs[toolId] || { enabled: false, settings: {} };
  }

  saveToolConfig(toolId: string, config: ToolConfig): void {
    const allConfigs = this.getAllToolConfigs();
    allConfigs[toolId] = config;
    getToolConfigStore().set('tools', allConfigs);
  }

  saveAllToolConfigs(configs: Record<string, ToolConfig>): void {
    getToolConfigStore().set('tools', configs);
  }
}

export const toolConfigRepository = new ToolConfigRepository();
