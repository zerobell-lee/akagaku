import { DynamicStructuredTool, DynamicTool } from "langchain/tools";
import { Tool, ToolMetadata, ToolConfig, ToolFactory } from "../entities/Tool";

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  registerTool(metadata: ToolMetadata, config: ToolConfig, factory: ToolFactory): void {
    if (!metadata) {
      console.error('[ToolRegistry] registerTool called with undefined metadata');
      return;
    }
    if (!metadata.id) {
      console.error('[ToolRegistry] metadata missing id:', metadata);
      return;
    }
    const tool = new Tool(metadata, config, factory);
    this.tools.set(metadata.id, tool);
    console.log(`[ToolRegistry] Registered tool: ${metadata.id}`);
  }

  getActiveLangChainTools(): (DynamicStructuredTool | DynamicTool)[] {
    return Array.from(this.tools.values())
      .filter(tool => {
        const validation = tool.validate();
        if (!validation.valid) {
          console.warn(`[ToolRegistry] Tool ${tool.metadata.id} validation failed:`, validation.errors);
          return false;
        }
        return tool.config.enabled;
      })
      .map(tool => tool.createLangChainTool());
  }

  getAllToolsMetadata(): ToolMetadata[] {
    return Array.from(this.tools.values()).map(t => t.metadata);
  }

  getToolConfig(toolId: string): ToolConfig | null {
    return this.tools.get(toolId)?.config || null;
  }

  updateToolConfig(toolId: string, config: ToolConfig): void {
    const tool = this.tools.get(toolId);
    if (tool) {
      tool.config = config;
    }
  }

  getEnabledToolIds(): string[] {
    return Array.from(this.tools.values())
      .filter(tool => tool.config.enabled && tool.validate().valid)
      .map(tool => tool.metadata.id);
  }
}
