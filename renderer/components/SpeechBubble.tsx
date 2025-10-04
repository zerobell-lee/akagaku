import { useState } from "react";
import SpreadingParagraph from "./SpreadingParagraph";
import { LoadingSpinner } from "./LoadingSpinner";
import { FaReply } from "react-icons/fa6";
import { FaWindowClose } from 'react-icons/fa';

interface SpeechBubbleProps {
    text: string
    onReply: () => void
    onClose: () => void
    isLoading: boolean
    isComplete: boolean
    displayScale?: number
}

export default function SpeechBubble({ text, onReply, onClose, isLoading = true, isComplete = false, displayScale = 1.0 }: SpeechBubbleProps) {
    return (
        <div className="speech-bubble" style={{ userSelect: 'none', zoom: displayScale }}>
            <div className="flex justify-end mx-2">
                <div className="flex gap-2 cursor-pointer" onClick={onClose}>
                    <FaWindowClose style={{ width: '30px', height: '30px', fill: 'rgb(112, 112, 112)' }} />
                </div>
            </div>
            {isLoading ? (
                <LoadingSpinner />
            ) : (
                <SpreadingParagraph text={text} />
            )}
            {isComplete && (
                <div className="reply-button-container mx-4 flex flex-col py-4 rounded-lg" style={{ backgroundColor: 'rgb(112, 112, 112)' }}> 
                    <div className="flex gap-2 justify-center cursor-pointer" onClick={onReply}>
                        <FaReply style={{ width: '30px', height: '30px', fill: 'white' }} />
                    </div>
                </div>
            )}
        </div>
    )
}
