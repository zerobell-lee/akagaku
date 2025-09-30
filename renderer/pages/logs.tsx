import { useState } from "react";
import { useEffect } from "react";

interface ChatLog {
    timestamp: string;
    role: string;
    content: string;
}

interface Archive {
    key: string;
    timestamp: string;
}

export default function Logs() {
    const [logs, setLogs] = useState<ChatLog[]>([])
    const [archives, setArchives] = useState<Archive[]>([])
    const [currentView, setCurrentView] = useState<string>('current')

    useEffect(() => {
        window.ipc.on('receive_chatlogs', (data: ChatLog[] | { current: ChatLog[], archives: Archive[] }) => {
            // Handle both old format (array) and new format (object with current/archives)
            if (Array.isArray(data)) {
                // Old format: just an array of logs
                setLogs(data)
                setArchives([])
            } else {
                // New format: object with current and archives
                setLogs(data.current || [])
                setArchives(data.archives || [])
            }
            console.log('Received chatlogs:', data)
        })

        window.ipc.on('receive_archive_logs', (archiveLogs: ChatLog[]) => {
            setLogs(archiveLogs || [])
            console.log('Received archive logs:', archiveLogs)
        })

        window.ipc.send('user-action', 'LOG_OPENED')
    }, [])

    const clearLogs = () => {
        const reply = confirm('Are you sure you want to clear the chat history?')
        if (reply) {
            window.ipc.send('user-action', 'RESET_CHAT_HISTORY')
        }
    }

    const loadArchive = (archiveKey: string) => {
        if (archiveKey === 'current') {
            // Reload current logs
            window.ipc.send('user-action', 'LOG_OPENED')
            setCurrentView('current')
        } else {
            window.ipc.send('load-archive', archiveKey)
            setCurrentView(archiveKey)
        }
    }

    const formatTimestamp = (timestamp: string) => {
        const date = new Date(parseInt(timestamp))
        return date.toLocaleString('ko-KR', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="flex flex-col gap-2 bg-gray-900 text-white h-screen w-screen" >
            <div className="flex flex-row items-center justify-between px-4 py-2 border-b border-gray-700">
                <h1 className="text-2xl font-bold">Chat Logs</h1>

                {/* Archive selector */}
                <div className="flex items-center gap-2">
                    <span className="text-sm text-gray-400">View:</span>
                    <select
                        className="bg-gray-800 text-white px-3 py-1 rounded-md border border-gray-700"
                        value={currentView}
                        onChange={(e) => loadArchive(e.target.value)}
                    >
                        <option value="current">Current (Recent)</option>
                        {archives.map((archive) => (
                            <option key={archive.key} value={archive.key}>
                                Archive - {formatTimestamp(archive.timestamp)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto px-4 flex-1">
                {logs.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No messages</div>
                ) : (
                    logs.map((log, index) => (
                        <div className="flex flex-row gap-2 py-2 bg-gray-900 border-b border-gray-800 hover:bg-gray-800 hover:text-white" key={index}>
                            <div className="text-lg text-gray-500 w-[20%] text-center">{log.timestamp}</div>
                            <div className="text-lg text-gray-500 w-[15%] text-center">{log.role}</div>
                            <div className="text-lg text-gray-300 w-[65%] overflow-hidden text-ellipsis whitespace-normal">{log.content}</div>
                        </div>
                    ))
                )}
            </div>

            {currentView === 'current' && (
                <button
                    className="text-white mx-4 my-4 font-bold rounded-md"
                    style={{backgroundColor: 'red', color: 'white', padding: '10px', borderRadius: '5px'}}
                    onClick={clearLogs}
                >
                    RESET CHAT HISTORY
                </button>
            )}
        </div>
    )
}
