import { useEffect } from "react";

import { useState } from "react";

export default function SpreadingParagraph({ text, onComplete }: { text: string, onComplete: () => void }) {
    const [displayedText, setDisplayedText] = useState("");
    const [isComplete, setIsComplete] = useState(false);

    const completeTextImmediately = () => {
        setDisplayedText(text);
        setIsComplete(true);
    }

    useEffect(() => {
        if (isComplete) {
            onComplete();
        }
    }, [isComplete]);

    useEffect(() => {
        if (isComplete) {
            return;
        }

        const timeout = setTimeout(() => {
            setDisplayedText(text.slice(0, displayedText.length + 1));
            if (displayedText.length === text.length) {
                setIsComplete(true);
            }
        }, 50);
        return () => clearTimeout(timeout);
    }, [displayedText, isComplete]);


    return (
        <div onClick={completeTextImmediately}>
            <p className="px-4 py-2 text-3xl">{displayedText}</p>
        </div>
    )
}
