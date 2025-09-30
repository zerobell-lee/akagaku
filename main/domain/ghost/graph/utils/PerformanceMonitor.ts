/**
 * Performance Monitor
 * Tracks execution time for different stages of LLM processing
 */

export class PerformanceMonitor {
    private static timers: Map<string, number> = new Map();

    static start(label: string): void {
        this.timers.set(label, Date.now());
    }

    static end(label: string): number {
        const startTime = this.timers.get(label);
        if (!startTime) {
            console.warn(`[Performance] Timer "${label}" not found`);
            return 0;
        }

        const duration = Date.now() - startTime;
        this.timers.delete(label);
        console.log(`[Performance] ${label}: ${duration}ms`);
        return duration;
    }

    static measure(label: string, fn: () => Promise<any>): Promise<any> {
        return (async () => {
            this.start(label);
            try {
                const result = await fn();
                this.end(label);
                return result;
            } catch (error) {
                this.end(label);
                throw error;
            }
        })();
    }
}