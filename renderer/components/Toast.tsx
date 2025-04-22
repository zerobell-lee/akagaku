import { useEffect } from "react";

import { useRef } from "react";

export type ToastProps = {
    message: string;
    onClose: () => void;
}

export const Toast = ({ message, onClose }: ToastProps) => {
    const delay = 3000;
    const timer = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        timer.current = setTimeout(() => {
            onClose();
        }, delay);
    }, [onClose]);

    return (
        <div className="toast-container absolute bottom-0 left-0 w-full h-full flex justify-center items-center">
            <div className="toast">
                <p className="toast-text text-3xl">{message}</p>
            </div>
        </div>
    )
}
