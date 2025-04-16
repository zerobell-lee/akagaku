import { useEffect, useState, useRef } from "react"
import SpeechBubble from "../components/SpeechBubble";
import { GhostResponse } from "@shared/types";

export default function SpeechBubblePage() {
    const [characterText, setCharacterText] = useState('Hello, world!!')
    const [isMessageLoading, setIsMessageLoading] = useState(true)
    const [displayText, setDisplayText] = useState('')
    const [isComplete, setIsComplete] = useState(false)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        window.ipc.on('ghost-message-loading', (isLoading: boolean) => {
            setIsMessageLoading(isLoading)
            setIsComplete(false)
            setDisplayText('')
        })

        window.ipc.on('ghost-message', (message: GhostResponse) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
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
        })
    }, [])

    useEffect(() => {
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
    }, [displayText, isMessageLoading])

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
