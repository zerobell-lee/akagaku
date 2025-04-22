import React  from 'react';
import { FaGear } from "react-icons/fa6";
import { IoChatbubbleEllipses } from "react-icons/io5";
import { ImExit } from "react-icons/im";

export const OverlayMenu = () => {
    const openChatInput = () => {
        window.ipc.send('user-action', 'CHAT_OPENED')
    }
    const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        window.ipc.send('drag-start', null)

        const handleMouseMove = (moveEvent: MouseEvent) => {
            window.ipc.send('move-window', null);

        };

        const handleMouseUp = () => {
            // mousemove와 mouseup 이벤트 리스너 제거
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };

        // mousemove와 mouseup 이벤트 리스너 추가
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
    };

    return (
        <div
            className="absolute top-0 left-0 w-full bg-black flex justify-between items-center z-10 rounded-lg py-2"
            onMouseDown={handleMouseDown}
            style={{ userSelect: 'none', backgroundColor: 'rgba(0, 0, 0, 0.3)' }}
        >
            <p className="text-white text-sm"></p>
            <div className="flex gap-2">
                <div className="flex gap-2 w-full cursor-pointer" onClick={openChatInput}>
                    <IoChatbubbleEllipses style={{ width: '30px', height: '30px', fill: 'white' }} />
                </div>
                <div className="flex gap-2 w-full cursor-pointer" onClick={() => window.ipc.send('user-action', 'OPEN_CONFIG')}>
                    <FaGear style={{ width: '30px', height: '30px', fill: 'white' }} />
                </div>
                <div className="flex gap-2 w-full cursor-pointer" onClick={() => window.ipc.send('user-action', 'APP_QUIT')}>
                    <ImExit style={{ width: '30px', height: '30px', fill: 'white' }} />
                </div>
            </div>
        </div>
    );
};
