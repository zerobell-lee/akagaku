/**
 * Tool Call Detector
 * Pre-filters messages to determine if tool calls are needed
 * Reduces LLM calls for simple conversational messages
 */

export class ToolCallDetector {
    // Keywords that suggest tool usage is needed
    private static readonly TOOL_KEYWORDS = [
        // Time/Date related
        'time', 'date', 'when', 'schedule', 'calendar', '시간', '날짜', '언제', '일정',

        // Weather related
        'weather', 'temperature', 'forecast', 'rain', 'snow', '날씨', '기온', '비', '눈',

        // Location related
        'location', 'where', 'place', 'address', 'map', '위치', '어디', '장소', '주소',

        // Crypto/Finance related
        'price', 'bitcoin', 'crypto', 'stock', 'coin', '가격', '비트코인', '코인', '주식',

        // Search/Information related
        'search', 'find', 'look up', 'google', '검색', '찾아', '알아봐',

        // File/System operations
        'file', 'open', 'save', 'download', '파일', '열어', '저장',

        // Calculation
        'calculate', 'compute', 'math', '계산', '더하기', '빼기', '곱하기', '나누기'
    ];

    // Patterns that indicate simple conversation (no tools needed)
    private static readonly SIMPLE_PATTERNS = [
        // Greetings
        /^(hi|hello|hey|안녕|ㅎㅇ)/i,

        // Simple questions about character
        /^(how are you|what('s| is) your name|who are you)/i,
        /^(기분|어때|이름|누구)/,

        // Thanks/Acknowledgments
        /^(thank|thanks|thx|고마|감사)/i,

        // Simple affirmations
        /^(yes|no|ok|okay|sure|yeah|응|ㅇㅇ|그래|알겠)/i,

        // Emotional expressions
        /^(좋아|싫어|재밌|웃|ㅋㅋ|ㅎㅎ)/,

        // Very short messages (likely casual)
        /^.{1,3}$/
    ];

    /**
     * Determine if a message likely needs tool calls
     * Returns true if tools might be needed, false if definitely not needed
     */
    static needsToolCall(message: string): boolean {
        const lowerMessage = message.toLowerCase().trim();

        // 1. Check simple patterns first (fast path)
        for (const pattern of this.SIMPLE_PATTERNS) {
            if (pattern.test(lowerMessage)) {
                return false;
            }
        }

        // 2. Check for tool keywords
        const hasToolKeyword = this.TOOL_KEYWORDS.some(keyword =>
            lowerMessage.includes(keyword.toLowerCase())
        );

        if (hasToolKeyword) {
            return true;
        }

        // 3. If message is very short and no keywords, likely casual chat
        if (lowerMessage.length < 10) {
            return false;
        }

        // 4. Default: allow tool calls for medium/long messages
        // (Let LLM decide, but most casual conversation will be filtered above)
        return true;
    }

    /**
     * Get skip reason for logging/debugging
     */
    static getSkipReason(message: string): string | null {
        const lowerMessage = message.toLowerCase().trim();

        for (const pattern of this.SIMPLE_PATTERNS) {
            if (pattern.test(lowerMessage)) {
                return `Simple pattern match: ${pattern.source}`;
            }
        }

        if (lowerMessage.length < 10) {
            return 'Message too short (< 10 chars)';
        }

        return null;
    }
}
