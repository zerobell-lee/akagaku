/**
 * EmoticonMatcher - Finds closest matching emoticon from available list
 * Handles LLM typos like 'embarass' -> 'embarrassed'
 */

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const matrix: number[][] = [];

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= len2; j++) {
        matrix[0][j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
        for (let j = 1; j <= len2; j++) {
            const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // deletion
                matrix[i][j - 1] + 1,      // insertion
                matrix[i - 1][j - 1] + cost // substitution
            );
        }
    }

    return matrix[len1][len2];
}

/**
 * Calculate similarity score (0-1) based on Levenshtein distance
 */
function similarityScore(str1: string, str2: string): number {
    const distance = levenshteinDistance(str1.toLowerCase(), str2.toLowerCase());
    const maxLen = Math.max(str1.length, str2.length);
    return 1 - (distance / maxLen);
}

/**
 * Find closest matching emoticon from available list
 * @param input - LLM-provided emoticon (potentially misspelled)
 * @param availableEmoticons - List of valid emoticons
 * @param threshold - Minimum similarity score (0-1) to consider a match
 * @returns Matched emoticon or null if no good match found
 */
export function findClosestEmoticon(
    input: string,
    availableEmoticons: string[],
    threshold: number = 0.6
): string | null {
    if (!input || availableEmoticons.length === 0) {
        return null;
    }

    // Exact match (case insensitive)
    const exactMatch = availableEmoticons.find(
        emoticon => emoticon.toLowerCase() === input.toLowerCase()
    );
    if (exactMatch) {
        return exactMatch;
    }

    // Find best fuzzy match
    let bestMatch: string | null = null;
    let bestScore = 0;

    for (const emoticon of availableEmoticons) {
        const score = similarityScore(input, emoticon);
        if (score > bestScore && score >= threshold) {
            bestScore = score;
            bestMatch = emoticon;
        }
    }

    if (bestMatch) {
        console.log(`[EmoticonMatcher] Matched '${input}' to '${bestMatch}' (score: ${bestScore.toFixed(2)})`);
    } else {
        console.warn(`[EmoticonMatcher] No match found for '${input}' (threshold: ${threshold})`);
    }

    return bestMatch;
}

/**
 * Find closest emoticon with fallback to 'neutral'
 */
export function findEmoticonWithFallback(
    input: string,
    availableEmoticons: string[],
    threshold: number = 0.6
): string {
    const matched = findClosestEmoticon(input, availableEmoticons, threshold);

    if (matched) {
        return matched;
    }

    // Fallback to 'neutral' if available
    const neutral = availableEmoticons.find(e => e.toLowerCase() === 'neutral');
    if (neutral) {
        console.log(`[EmoticonMatcher] Using fallback 'neutral' for '${input}'`);
        return neutral;
    }

    // Last resort: return first available emoticon
    console.warn(`[EmoticonMatcher] Using first available emoticon for '${input}'`);
    return availableEmoticons[0] || 'neutral';
}
