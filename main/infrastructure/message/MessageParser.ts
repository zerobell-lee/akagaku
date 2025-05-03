import { ChainValues } from "@langchain/core/utils/types"
import { GhostResponse } from "@shared/types"

export class AIResponseParseError extends Error {
    AImsg: string
    constructor(message: string, AImsg: string) {
        super(message)
        this.AImsg = AImsg
    }
}

export class AIResponseParser {
    private llmService: string

    constructor(llmService: string) {
        this.llmService = llmService
    }

    parseGhostResponse(response: ChainValues): GhostResponse {
        console.log('response', response)
        let target = response.content
        const regex = /{[^]*?}/g;
        const matchedJson = target.match(regex)
        if (!matchedJson) {
            throw new AIResponseParseError('Failed to parse response', target)
        }
        const extractedJson = matchedJson[0];
        if (!extractedJson) {
            throw new AIResponseParseError('Failed to parse response', target)
        }
        return JSON.parse(extractedJson) as GhostResponse;
    }
}
