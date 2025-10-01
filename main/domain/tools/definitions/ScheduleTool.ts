import { DynamicTool } from "langchain/tools";
import { ToolMetadata, ToolConfig } from "../../entities/Tool";

export const ScheduleToolMetadata: ToolMetadata = {
  id: 'get_schedule',
  name: 'Schedule & Tasks',
  description: 'Access user schedule and task list',
  category: 'schedule',
  configFields: [
    {
      key: 'tasks',
      label: 'Task List',
      type: 'array',
      required: false,
      description: 'Add your tasks and schedules',
      itemSchema: {
        type: 'text',
        fields: [
          { key: 'task', label: 'Task', placeholder: 'Meeting with team' }
        ]
      },
      defaultValue: []
    }
  ]
};

export const createScheduleTool = (config: ToolConfig): DynamicTool => {
  return new DynamicTool({
    name: "get_schedule",
    description: "Get schedule of the user",
    func: async () => {
      const tasks = config.settings.tasks || [];
      if (tasks.length === 0) {
        return `Upcoming tasks:\nNone`;
      }
      return `Upcoming tasks:\n` + tasks.map((t: any) => `- ${t.task}`).join('\n');
    },
  });
};
