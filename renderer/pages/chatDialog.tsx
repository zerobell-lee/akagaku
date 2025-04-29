import React, { useState, useEffect, useRef } from 'react';
import { UserInput } from '../../shared/types';
export default function ChatDialog() {
    const [inputValue, setInputValue] = useState<UserInput>({ input: '', isSystemMessage: false });
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (inputRef.current) {
            inputRef.current.focus();
        }
    }, []);

    const handleSubmit = () => {
        console.log('Submitted:', inputValue);
        // 추가적인 제출 로직을 여기에 작성
        setInputValue({ input: '', isSystemMessage: false }); // 입력 필드 초기화
        window.ipc.send('user-message', inputValue);
        window.ipc.send('user-action', 'CHAT_CLOSED');
    };

    const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Enter') {
            handleSubmit(); // Enter 키가 눌리면 제출
        }
        if (event.key === 'Escape') {
            handleClose();
        }
    };

    const handleClose = () => {
        window.ipc.send('user-action', 'CHAT_CLOSED');
    }

    return (
        <div style={{ width: '600px', height: '600px' }}>
            <div className="dialog rounded-md" style={{ width: '100%', padding: '20px', backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
                <h2 style={{ fontSize: '24px', color: 'white' }}>Input Dialog</h2>
                <span style={{ color: 'white' }}>System Message</span><input type="checkbox" checked={inputValue.isSystemMessage} onChange={(e) => setInputValue({ input: inputValue.input, isSystemMessage: e.target.checked })} />
                <input
                    ref={inputRef}
                    value={inputValue.input}
                    onChange={(e) => setInputValue({ input: e.target.value, isSystemMessage: inputValue.isSystemMessage })}
                    onKeyDown={handleKeyDown}
                    style={{ width: '100%', padding: '10px', margin: '10px 0', fontSize: '20px' }}
                />
                <button onClick={handleSubmit} className="p-2 px-4 m-2 text-base bg-blue-500 text-white rounded-md">Submit</button>
                <button onClick={handleClose} className="p-2 px-4 m-2 text-base bg-red-500 text-white rounded-md">Close</button>
            </div>
        </div>
    );
}
