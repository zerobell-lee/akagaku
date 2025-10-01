import { DynamicStructuredTool } from "langchain/tools";
import { z } from "zod";
import { updateUserInfo } from "../../../infrastructure/user/UserRepository";
import { ToolMetadata, ToolConfig } from "../../entities/Tool";

export const UserToolMetadata: ToolMetadata = {
  id: 'update_user_setting',
  name: 'Update User Information',
  description: 'Update user profile information when learning new details',
  category: 'user',
  configFields: []
};

export const createUserTool = (config: ToolConfig): DynamicStructuredTool => {
  return new DynamicStructuredTool({
    name: "update_user_setting",
    description: `Use this tool when you got new important information about user (such as user's name, age, etc.)`,
    schema: z.object({
      keyValues: z.array(z.object({
        key: z.string(),
        value: z.string(),
      })).describe("key-value pairs of user info to update"),
    }),
    func: async ({ keyValues }) => {
      for (const { key, value } of keyValues) {
        await updateUserInfo(key, value);
      }
      return "User info updated successfully. updated keys: " + keyValues.map(kv => kv.key).join(", ");
    },
  });
};
