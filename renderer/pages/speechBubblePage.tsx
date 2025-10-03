import { useEffect, useState, useRef } from "react"
import SpeechBubble from "../components/SpeechBubble";
import { GhostResponse } from "@shared/types";

export default function SpeechBubblePage() {
    const [characterText, setCharacterText] = useState('Hello, world!!')
    const [isMessageLoading, setIsMessageLoading] = useState(true)
    const [displayText, setDisplayText] = useState('')
    const [isComplete, setIsComplete] = useState(false)
    const [isStreaming, setIsStreaming] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)
    const isStreamingRef = useRef<boolean>(false)

    useEffect(() => {
        window.ipc.on('ghost-message-loading', (isLoading: boolean) => {
            if (isLoading) {
                // Clear any existing timeout when new message starts loading
                if (timeoutRef.current) {
                    console.log('[SpeechBubble] Clearing previous timeout on new message loading');
                    clearTimeout(timeoutRef.current);
                    timeoutRef.current = null;
                }
                // Only reset when starting a new message
                isStreamingRef.current = false;
                setIsMessageLoading(isLoading)
                setIsComplete(false)
                setDisplayText('')
                setIsStreaming(false)
            }
            // When isLoading is false, don't reset anything - message is complete
        })

        // New: Start streaming
        window.ipc.on('ghost-message-start-stream', () => {
            console.log('[Frontend] Streaming started');
            // Clear any existing timeout when streaming starts
            if (timeoutRef.current) {
                console.log('[SpeechBubble] Clearing previous timeout on streaming start');
                clearTimeout(timeoutRef.current);
                timeoutRef.current = null;
            }
            isStreamingRef.current = true;
            setIsStreaming(true);
            setCharacterText('');
            setDisplayText('');
            setIsMessageLoading(false); // Show UI immediately
            setIsComplete(false); // Reset completion state
        });

        // New: Receive streaming chunks
        window.ipc.on('ghost-message-chunk', (chunk: string) => {
            setCharacterText(prev => prev + chunk);
            setDisplayText(prev => prev + chunk); // Real-time display
        });

        window.ipc.on('ghost-message', (message: GhostResponse) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }

            // Check ref instead of state to avoid closure issue
            if (!isStreamingRef.current) {
                setIsMessageLoading(false)
                setDisplayText('')  // Reset for typing animation
                if (message.error) {
                    if (message.error.name === 'ApiKeyNotDefinedError') {
                        setCharacterText("API Key가 없네요. 설정에서 API 키를 설정해주세요.")
                    } else {
                        setCharacterText(message.error.message)
                    }
                } else {
                    setCharacterText(message.message)
                }
            } else {
                // Streaming mode: finalize and trigger timeout
                console.log('[SpeechBubble] Streaming finished');
                isStreamingRef.current = false;
                setCharacterText(message.message);
                setDisplayText(message.message);
                setIsComplete(true);
                setIsStreaming(false);
                // Send streaming complete event to main process
                window.ipc.send('streaming-complete', {});
                closeSpeechBubbleWithTimeout();
            }
        })

        // Listen for speech bubble style updates
        window.ipc.on('update-speech-bubble-style', (styleConfig: {
            fontFamily?: string;
            fontSize?: number;
            customCSS?: string;
        }) => {
            // Apply styles with retry to ensure DOM is ready
            const applyStyles = () => {
                const speechBubbleElement = document.querySelector('.speech-bubble') as HTMLElement;
                if (!speechBubbleElement) {
                    setTimeout(applyStyles, 100);
                    return;
                }

                // Apply font family
                if (styleConfig.fontFamily !== undefined) {
                    if (styleConfig.fontFamily === '') {
                        speechBubbleElement.style.fontFamily = '';
                    } else {
                        speechBubbleElement.style.fontFamily = styleConfig.fontFamily;
                    }
                }

                // Apply font size
                if (styleConfig.fontSize !== undefined) {
                    speechBubbleElement.style.fontSize = `${styleConfig.fontSize}px`;
                }

                // Apply custom CSS
                if (styleConfig.customCSS !== undefined) {
                    let customStyleElement = document.getElementById('custom-speech-bubble-style');
                    if (!customStyleElement) {
                        customStyleElement = document.createElement('style');
                        customStyleElement.id = 'custom-speech-bubble-style';
                        document.head.appendChild(customStyleElement);
                    }
                    customStyleElement.textContent = styleConfig.customCSS;
                }
            };

            applyStyles();
        })
    }, [])

    useEffect(() => {
        console.log('[SpeechBubble] useEffect triggered:', {
            isStreaming,
            isMessageLoading,
            displayTextLen: displayText.length,
            characterTextLen: characterText.length
        });

        // Skip typing effect for streaming mode (already displayed in real-time)
        if (isStreaming) {
            // Streaming completion is handled in ghost-message event
            return;
        }

        // Traditional typing effect for non-streaming mode
        if (isMessageLoading) {
            return
        }

        if (displayText.length === characterText.length) {
            console.log('[SpeechBubble] Text display complete (non-streaming)');
            setIsComplete(true)
            closeSpeechBubbleWithTimeout()
            return
        }
        const timeout = setTimeout(() => {
            setDisplayText(characterText.slice(0, displayText.length + 1))
        }, 50)
        return () => clearTimeout(timeout)
    }, [displayText, isMessageLoading, isStreaming, characterText])

    const handleOpenDialog = () => {
        window.ipc.send('user-action', 'CHAT_OPENED')
    }

    const completeSpeechBubble = () => {
        setDisplayText(characterText)
    }

    const closeSpeechBubble = () => {
        window.ipc.send('user-action', 'BUBBLE_CLOSED')
    }

    const handleCloseSpeechBubble = () => {
        closeSpeechBubble()
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }
    }

    const closeSpeechBubbleWithTimeout = () => {
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current)
        }
        console.log('[SpeechBubble] Setting 10s auto-close timeout');
        timeoutRef.current = setTimeout(() => {
            console.log('[SpeechBubble] Auto-close timeout triggered');
            closeSpeechBubble()
        }, 10000)
    }

    return (
        <>
            {!isComplete && <div className="absolute top-0 left-0 w-full h-full bg-transparent z-10" onClick={completeSpeechBubble}></div>}
            <SpeechBubble text={displayText} onReply={handleOpenDialog} onClose={handleCloseSpeechBubble} isLoading={isMessageLoading} isComplete={isComplete} />
        </>
    )
}
