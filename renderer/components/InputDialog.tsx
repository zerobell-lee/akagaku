import React, { useState } from 'react';

const InputDialog = () => {
    const [inputValue, setInputValue] = useState('');

    const handleSubmit = () => {
        window.ipc.send('user-message', inputValue);
    }

    const handleClose = () => {
        window.ipc.send('user-action', 'CHAT_CLOSED');
    }

    return (
        <div style={{ width: '600px', height: '600px' }}>
            <div className="dialog" style={{ width: '100%', padding: '20px' }}>
                <h2 style={{ fontSize: '24px' }}>Input Dialog</h2>
                <textarea
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    style={{ width: '100%', padding: '10px', margin: '10px 0', fontSize: '20px' }}
                />
                <button onClick={handleSubmit} style={{ padding: '10px 20px', margin: '10px', fontSize: '16px' }}>Submit</button>
                <button onClick={handleClose} style={{ padding: '10px 20px', margin: '10px', fontSize: '16px' }}>Close</button>
            </div>
        </div>
    );
};

export default InputDialog;
