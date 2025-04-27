import { RunnableLambda } from "@langchain/core/runnables";
import { GhostState } from "../states";

export const InputNode = new RunnableLambda<GhostState, Partial<GhostState>>({
    func: async (state: GhostState) => {
        return {};
    }
});