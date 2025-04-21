import { useEffect, useState, useRef } from "react"
import SpeechBubble from "../components/SpeechBubble";

interface GhostResponse {
    message: string;
    emoticon: string;
    add_affection: number;
    error?: string;
}

export default function SpeechBubblePage() {
    const [characterText, setCharacterText] = useState('Hello, world!!')
    const [isMessageLoading, setIsMessageLoading] = useState(true)
    const timeoutRef = useRef<NodeJS.Timeout | null>(null)

    useEffect(() => {
        window.ipc.on('ghost-message-loading', (isLoading: boolean) => {
            setIsMessageLoading(isLoading)
        })

        window.ipc.on('ghost-message', (message: GhostResponse) => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current)
            }
            setIsMessageLoading(false)
            if (message.error) {
                setCharacterText(message.error)
            } else {
                displayCharacterText(message)
            }
        })
    }, [])

    const handleOpenDialog = () => {
        window.ipc.send('user-action', 'CHAT_OPENED')
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

    const displayCharacterText = (message: GhostResponse) => {
        setCharacterText(message.message)
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
            <SpeechBubble text={characterText} onReply={handleOpenDialog} onClose={handleCloseSpeechBubble} isLoading={isMessageLoading} onComplete={closeSpeechBubbleWithTimeout} />
        </>
    )
}
