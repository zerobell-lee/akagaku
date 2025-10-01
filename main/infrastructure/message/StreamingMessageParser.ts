import { GhostResponse } from "@shared/types";

export interface StreamingParseResult {
    type: 'metadata' | 'message_chunk' | 'complete';
    emoticon?: string;
    affection?: number;
    messageChunk?: string;
    fullResponse?: GhostResponse;
}

/**
 * StreamingMessageParser - Parses LLM streaming responses in Markdown format
 *
 * Expected format:
 * EMOTICON: neutral
 * AFFECTION: 0
 * MESSAGE:
 * Your response text here
 */
export class StreamingMessageParser {
    private buffer = '';
    private emoticon: string | null = null;
    private affection: number | null = null;
    private messageStarted = false;
    private messageBuffer = '';

    /**
     * Process a chunk of streaming data
     * @param chunk - New chunk from LLM stream
     * @returns Parse result or null if waiting for more data
     */
    onChunk(chunk: string): StreamingParseResult | null {
        this.buffer += chunk;

        // Step 1: Parse EMOTICON (highest priority)
        if (!this.emoticon) {
            const match = this.buffer.match(/EMOTICON:\s*(\w+)/i);
            if (match) {
                this.emoticon = match[1];
                console.log('[StreamingParser] Parsed emoticon:', this.emoticon);
                return { type: 'metadata', emoticon: this.emoticon };
            }
            return null; // Wait for EMOTICON first
        }

        // Step 2: Parse AFFECTION
        if (this.affection === null && this.emoticon) {
            const match = this.buffer.match(/AFFECTION:\s*(-?\d+)/i);
            if (match) {
                this.affection = parseInt(match[1]);
                console.log('[StreamingParser] Parsed affection:', this.affection);
                return { type: 'metadata', affection: this.affection };
            }
            return null; // Wait for AFFECTION
        }

        // Step 3: Start streaming MESSAGE
        if (this.emoticon && this.affection !== null && !this.messageStarted) {
            const messageStart = this.buffer.indexOf('MESSAGE:');
            if (messageStart !== -1) {
                this.messageStarted = true;
                // Extract content after "MESSAGE:\n"
                const afterMessage = this.buffer.substring(messageStart + 8);
                const firstContent = afterMessage.trimStart();

                if (firstContent) {
                    this.messageBuffer = firstContent;
                    console.log('[StreamingParser] MESSAGE started, first content:', firstContent.substring(0, 50));
                    return {
                        type: 'message_chunk',
                        messageChunk: firstContent
                    };
                }
            }
            return null;
        }

        // Step 4: Continue streaming message chunks
        if (this.messageStarted && chunk) {
            this.messageBuffer += chunk;
            return {
                type: 'message_chunk',
                messageChunk: chunk
            };
        }

        return null;
    }

    /**
     * Finalize parsing and return complete GhostResponse
     * @throws Error if parsing is incomplete
     */
    finalize(): GhostResponse {
        if (!this.emoticon) {
            throw new Error('[StreamingParser] Incomplete parse: missing EMOTICON');
        }

        if (this.affection === null) {
            throw new Error('[StreamingParser] Incomplete parse: missing AFFECTION');
        }

        if (!this.messageBuffer.trim()) {
            throw new Error('[StreamingParser] Incomplete parse: missing MESSAGE content');
        }

        const response: GhostResponse = {
            emoticon: this.emoticon,
            add_affection: this.affection,
            message: this.messageBuffer.trim()
        };

        console.log('[StreamingParser] Finalized response:', {
            emoticon: response.emoticon,
            affection: response.add_affection,
            messageLength: response.message.length
        });

        return response;
    }

    /**
     * Reset parser state for new message
     */
    reset() {
        this.buffer = '';
        this.emoticon = null;
        this.affection = null;
        this.messageStarted = false;
        this.messageBuffer = '';
        console.log('[StreamingParser] Reset');
    }

    /**
     * Get current parsing state (for debugging)
     */
    getState() {
        return {
            hasEmoticon: !!this.emoticon,
            hasAffection: this.affection !== null,
            messageStarted: this.messageStarted,
            messageLength: this.messageBuffer.length,
            bufferLength: this.buffer.length
        };
    }
}
