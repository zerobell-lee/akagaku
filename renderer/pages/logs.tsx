import { useState } from "react";

import { useEffect } from "react";

interface ChatLog {
    timestamp: string;
    role: string;
    content: string;
}

export default function Logs() {
    const [logs, setLogs] = useState<ChatLog[]>([])

    useEffect(() => {
        window.ipc.on('receive_chatlogs', (logs: ChatLog[]) => {
            setLogs(logs)
            console.log(logs)
        })
        window.ipc.send('user-action', 'LOG_OPENED')
    }, [])

    const clearLogs = () => {
        const reply = confirm('Are you sure you want to clear the chat history?')
        if (reply) {
            window.ipc.send('user-action', 'RESET_CHAT_HISTORY')
        }
    }
    
    return (
        <div className="flex flex-col gap-2 bg-gray-900 text-white h-screen w-screen" >
            <h1 className="text-2xl px-2 font-bold">Logs</h1>
            <div className="flex flex-col gap-2 overflow-y-auto px-4">
            {logs.map((log, index) => (
                <div className="flex flex-row gap-2 py-2 bg-gray-900 border-b border-gray-800 hover:bg-gray-800 hover:text-white" key={index}>
                    <div className="text-2xl text-gray-500 w-[20%] text-center">{log.timestamp}</div>
                    <div className="text-2xl text-gray-500 w-[20%] text-center">{log.role}</div>
                    <div className="text-2xl text-gray-500 w-[60%] overflow-hidden text-ellipsis whitespace-normal">{log.content}</div>
                </div>
            ))}
            </div>
            <button className="text-white mx-4 my-4 font-bold rounded-md" style={{backgroundColor: 'red', color: 'white', padding: '10px', borderRadius: '5px'}} onClick={clearLogs}>RESET CHAT HISTORY</button>
        </div>
    )
}
