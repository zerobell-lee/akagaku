import { RunnableLambda } from "@langchain/core/runnables";
import { GhostState } from "../states";
import { updateCharacterRelationships } from "main/infrastructure/user/RelationshipRepository";
import { updateChatHistory } from "main/infrastructure/chat/ChatHistoryRepository";

export const UpdateNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        const { update_payload, character_setting } = state;
        if (!update_payload) {
            return {};
        }
        const { relationship, history } = update_payload;
        await updateCharacterRelationships(relationship.character, relationship.affection_to_user, relationship.attitude_to_user);
        await updateChatHistory(character_setting.character_id, history);
        return {
            update_payload: null
        }
    }
})