import React, { useEffect } from 'react';

export const OverlayMenu = () => {
    const openChatInput = () => {
        window.ipc.send('user-action', 'CHAT_OPENED')
    }
    const handleMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
        const initialX = event.clientX; // 드래그 시작 시 x 좌표
        const initialY = event.clientY; // 드래그 시작 시 y 좌표

        const handleMouseMove = (moveEvent: MouseEvent) => {
            const deltaX = moveEvent.clientX - initialX; // x 좌표의 변화량
            const deltaY = moveEvent.clientY - initialY; // y 좌표의 변화량

            // Electron의 ipcRenderer를 사용하여 윈도우 이동
            window.ipc.send('move-window', { deltaX, deltaY });
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
            className="absolute top-0 left-0 w-full bg-black bg-opacity-70 flex justify-between items-center z-10"
            onMouseDown={handleMouseDown}
            style={{ userSelect: 'none' }}
        >
            <p className="text-white text-sm"></p>
            <div className="flex gap-2">
                <button className="bg-white text-black px-4 py-2 rounded-md" onClick={openChatInput}>chat</button>
                <button className="bg-white text-black px-4 py-2 rounded-md" onClick={() => window.ipc.send('user-action', 'OPEN_CONFIG')}>config</button>
                <button className="bg-white text-black px-4 py-2 rounded-md" onClick={() => window.ipc.send('user-action', 'APP_QUIT')}>exit</button>
            </div>
        </div>
    );
};
