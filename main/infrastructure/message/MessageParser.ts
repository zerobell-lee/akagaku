import { ChainValues } from "@langchain/core/utils/types"
import { GhostResponse } from "@shared/types"
import { ToolCallResult } from "main/domain/ghost/graph/states"

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
        let target = response.output
        if (this.llmService === 'anthropic') {
            try {
                target = target[0].text
            } catch (e) {
                console.error(e)
                throw new AIResponseParseError('Failed to parse response', target)
            }
        }
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

    parseToolResponse(response: ChainValues): ToolCallResult {
        console.log('response', response)
        let target = response.output
        if (this.llmService === 'anthropic') {
            try {
                target = target[0].text
                const regex = /{[^]*?}/g;
                const matchedJson = target.match(regex)
                if (!matchedJson) {
                    throw new AIResponseParseError('Failed to parse response', target)
                }
                const extractedJson = matchedJson[0];
                if (!extractedJson) {
                    throw new AIResponseParseError('Failed to parse response', target)
                }
                return JSON.parse(extractedJson) as ToolCallResult;
            } catch (e) {
                console.error(e)
                throw new AIResponseParseError('Failed to parse response', target)
            }
        } else {
            return JSON.parse(target) as ToolCallResult;
        }   
    }
}
