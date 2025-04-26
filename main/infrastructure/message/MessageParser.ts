import { ChainValues } from "@langchain/core/utils/types"
import { GhostResponse } from "@shared/types"

export class AIResponseParser {
    private llmService: string

    constructor(llmService: string) {
        this.llmService = llmService
    }
    
    parse(response: ChainValues): GhostResponse {
        let target = response.output
        if (this.llmService === 'anthropic') {
            target = target[0].text
        }
        const regex = /{[^]*?}/g;
        const extractedJson = target.match(regex)[0];
        return JSON.parse(extractedJson) as GhostResponse;
    }
}
