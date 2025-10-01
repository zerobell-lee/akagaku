import { EventEmitter } from 'events';

/**
 * Global event emitter for streaming responses
 * Used to communicate between ResponseNode and background.ts
 */
export class StreamingEventEmitter extends EventEmitter {
    private static instance: StreamingEventEmitter | null = null;

    private constructor() {
        super();
    }

    static getInstance(): StreamingEventEmitter {
        if (!StreamingEventEmitter.instance) {
            StreamingEventEmitter.instance = new StreamingEventEmitter();
        }
        return StreamingEventEmitter.instance;
    }

    /**
     * Emit streaming chunk
     */
    emitChunk(characterId: string, chunk: string) {
        this.emit('stream-chunk', { characterId, chunk });
    }

    /**
     * Emit stream start
     */
    emitStreamStart(characterId: string) {
        this.emit('stream-start', { characterId });
    }

    /**
     * Emit stream complete
     */
    emitStreamComplete(characterId: string) {
        this.emit('stream-complete', { characterId });
    }

    /**
     * Emit stream error
     */
    emitStreamError(characterId: string, error: Error) {
        this.emit('stream-error', { characterId, error });
    }
}

// Export singleton instance
export const streamingEvents = StreamingEventEmitter.getInstance();
