import { DynamicTool } from "langchain/tools";
import { shell } from "electron";
import { ToolMetadata, ToolConfig } from "../../entities/Tool";

export const OpenUrlToolMetadata: ToolMetadata = {
  id: 'open_url',
  name: 'Open URL',
  description: 'Open URLs in the default browser',
  category: 'browser',
  configFields: []
};

export const createOpenUrlTool = (config: ToolConfig): DynamicTool => {
  return new DynamicTool({
    name: "openUrl",
    description: "Open the url in the browser or shell command",
    func: async (url: string) => {
      shell.openExternal(url);
      return `Opened ${url}`;
    },
  });
};

export const BookmarksToolMetadata: ToolMetadata = {
  id: 'get_bookmarks',
  name: 'Bookmarks',
  description: 'Access user bookmarks',
  category: 'browser',
  configFields: [
    {
      key: 'bookmarks',
      label: 'Bookmark List',
      type: 'array',
      required: false,
      description: 'Add your frequently used websites',
      itemSchema: {
        type: 'url',
        fields: [
          { key: 'name', label: 'Name', placeholder: 'Website name' },
          { key: 'url', label: 'URL', placeholder: 'https://...' }
        ]
      },
      defaultValue: [
        { name: '네이버', url: 'https://naver.com' },
        { name: '구글', url: 'https://google.com' },
        { name: '유튜브', url: 'https://youtube.com' }
      ]
    }
  ]
};

export const createBookmarksTool = (config: ToolConfig): DynamicTool => {
  return new DynamicTool({
    name: "getBookmarks",
    description: "Get bookmarks of the user. If user say like '열어줘', you can use this tool to open the bookmark.",
    func: async () => {
      const bookmarks = config.settings.bookmarks || [];
      if (bookmarks.length === 0) {
        return "No bookmarks configured.";
      }
      return bookmarks.map((b: any) => `- ${b.name} : ${b.url}`).join('\n');
    },
  });
};
