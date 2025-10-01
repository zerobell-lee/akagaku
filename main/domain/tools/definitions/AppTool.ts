import { DynamicTool } from "langchain/tools";
import { ToolMetadata, ToolConfig } from "../../entities/Tool";

export const InstalledAppsToolMetadata: ToolMetadata = {
  id: 'get_installed_apps',
  name: 'Installed Applications',
  description: 'Get list of installed applications',
  category: 'app',
  configFields: [
    {
      key: 'apps',
      label: 'Application List',
      type: 'array',
      required: false,
      description: 'Add applications with their paths',
      itemSchema: {
        type: 'path',
        fields: [
          { key: 'name', label: 'App Name', placeholder: 'Photoshop' },
          { key: 'path', label: 'Executable Path', placeholder: 'C:\\Program Files\\...' }
        ]
      },
      defaultValue: [
        { name: 'Photoshop', path: 'C:\\Program Files\\Adobe\\Adobe Photoshop 2025\\Photoshop.exe' },
        { name: 'Blender', path: 'C:\\Program Files\\Blender Foundation\\Blender 3.2\\blender.exe' }
      ]
    }
  ]
};

export const createInstalledAppsTool = (config: ToolConfig): DynamicTool => {
  return new DynamicTool({
    name: "get_installed_apps",
    description: "Get installed apps and path of the apps on user's device",
    func: async () => {
      const apps = config.settings.apps || [];
      if (apps.length === 0) {
        return "No applications configured.";
      }
      return apps.map((app: any) => `${app.name} : ${app.path}`).join('\n');
    },
  });
};

export const OpenAppToolMetadata: ToolMetadata = {
  id: 'open_app',
  name: 'Open Application',
  description: 'Open applications by path',
  category: 'app',
  configFields: []
};

export const createOpenAppTool = (config: ToolConfig): DynamicTool => {
  return new DynamicTool({
    name: "open_app",
    description: "Open the app with the given path",
    func: async (arg) => {
      const { exec } = require('child_process');
      exec(`start "" "${arg.replace(/\\/g, '\\\\')}"`, (err: any) => {
        if (err) {
          console.error(err);
          return "Failed to open the app. error: " + err;
        }
        console.log(`Opening ${arg}`);
      });
      return `Opening ${arg}`;
    },
  });
};
