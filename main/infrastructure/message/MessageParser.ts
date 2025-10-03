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

    /**
     * Try to parse Markdown format first, then fallback to JSON
     */
    parseGhostResponse(response: ChainValues): GhostResponse {
        console.log('[AIResponseParser] Parsing response');
        let target = response.content;

        // Try Markdown format first
        try {
            const markdownResult = this.tryParseMarkdown(target);
            if (markdownResult) {
                console.log('[AIResponseParser] Successfully parsed as Markdown');
                return markdownResult;
            }
        } catch (e) {
            console.log('[AIResponseParser] Markdown parse failed, trying JSON fallback:', e.message);
        }

        // Fallback to JSON parsing
        const regex = /{[^]*?}/g;
        const matchedJson = target.match(regex);
        if (!matchedJson) {
            throw new AIResponseParseError('Failed to parse response', target);
        }
        const extractedJson = matchedJson[0];
        if (!extractedJson) {
            throw new AIResponseParseError('Failed to parse response', target);
        }
        console.log('[AIResponseParser] Successfully parsed as JSON (fallback)');
        return JSON.parse(extractedJson) as GhostResponse;
    }

    /**
     * Try to parse Markdown format response
     * Format:
     * EMOTICON: neutral
     * ADD_AFFECTION: 0
     * MESSAGE:
     * Your response text
     */
    private tryParseMarkdown(content: string): GhostResponse | null {
        const emoticonMatch = content.match(/EMOTICON:\s*(\w+)/i);
        // Support both ADD_AFFECTION (new) and AFFECTION (legacy) for backward compatibility
        const affectionMatch = content.match(/ADD_AFFECTION:\s*([+-]?\d+)/i) || content.match(/AFFECTION:\s*([+-]?\d+)/i);
        const messageMatch = content.match(/MESSAGE:\s*\n?([\s\S]+)/i);

        if (!emoticonMatch || !affectionMatch || !messageMatch) {
            return null;
        }

        return {
            emoticon: emoticonMatch[1],
            add_affection: parseInt(affectionMatch[1]),
            message: messageMatch[1].trim()
        };
    }
}
