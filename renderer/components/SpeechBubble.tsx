import { useState } from "react";
import SpreadingParagraph from "./SpreadingParagraph";

interface SpeechBubbleProps {
    text: string
    onReply: () => void
    onClose: () => void
    isLoading: boolean
    onComplete: () => void
}

export default function SpeechBubble({ text, onReply, onClose, isLoading = true, onComplete }: SpeechBubbleProps) {
    const [isComplete, setIsComplete] = useState(!isLoading);
    const handleOnComplete = () => {
        setIsComplete(true)
        onComplete()
    }
    return (
        <div className="speech-bubble" style={{ userSelect: 'none' }}>
            <div className="flex justify-end mx-2">
                <button className="text-3xl font-bold px-2 py-1 my-2 text-white rounded-md" onClick={onClose} style={{ backgroundColor: 'red' }}>X</button>
            </div>
            {isLoading ? (
                <div className="loading-container">
                    <p className="px-4 py-2 text-3xl">Loading...</p>
                </div>
            ) : (
                <SpreadingParagraph onComplete={handleOnComplete} text={text} />
            )}
            {isComplete && (
                <div className="reply-button-container px-4 flex flex-col">
                    <button className="text-3xl font-bold w-full bg-blue-500 py-2 my-2 text-white rounded-md" onClick={onReply}>reply</button>                
                </div>
            )}
        </div>
    )
}
