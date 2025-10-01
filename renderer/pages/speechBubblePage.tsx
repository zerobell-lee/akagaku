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

    useEffect(() => {
        window.ipc.on('ghost-message-loading', (isLoading: boolean) => {
            setIsMessageLoading(isLoading)
            setIsComplete(false)
            setDisplayText('')
            setIsStreaming(false)
        })

        // New: Start streaming
        window.ipc.on('ghost-message-start-stream', () => {
            console.log('[Frontend] Streaming started');
            setIsStreaming(true);
            setCharacterText('');
            setDisplayText('');
            setIsMessageLoading(false); // Show UI immediately
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

            // If not streaming, use traditional approach
            if (!isStreaming) {
                setIsMessageLoading(false)
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
                // Streaming mode: just ensure final message is set
                setIsStreaming(false);
                setCharacterText(message.message);
                setDisplayText(message.message);
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
        // Skip typing effect for streaming mode (already displayed in real-time)
        if (isStreaming) {
            if (displayText.length > 0 && displayText.length === characterText.length) {
                setIsComplete(true);
                window.ipc.send('user-action', 'DISPLAY_TEXT_COMPLETE');
                closeSpeechBubbleWithTimeout();
            }
            return;
        }

        // Traditional typing effect for non-streaming mode
        if (isMessageLoading) {
            return
        }

        if (displayText.length === characterText.length) {
            setIsComplete(true)
            window.ipc.send('user-action', 'DISPLAY_TEXT_COMPLETE')
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
        timeoutRef.current = setTimeout(() => {
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
