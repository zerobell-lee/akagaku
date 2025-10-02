import { useState, useEffect, useRef } from "react";

interface ChatLog {
    createdAt: Date | string;
    role: string;
    content: string;
}

interface Archive {
    key: string;
    timestamp: string;
}

interface MessageStats {
    total: number;
    conversation: number;
    summary: number;
}

export default function Logs() {
    const [logs, setLogs] = useState<ChatLog[]>([])
    const [archives, setArchives] = useState<Archive[]>([])
    const [currentView, setCurrentView] = useState<string>('current')
    const [stats, setStats] = useState<MessageStats | null>(null)
    const logsEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom when logs change
    useEffect(() => {
        logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [logs])

    useEffect(() => {
        const unsubscribe1 = window.ipc.on('receive_chatlogs', (data: ChatLog[] | { current: ChatLog[], archives: Archive[], stats?: MessageStats }) => {
            // Handle both old format (array) and new format (object with current/archives)
            if (Array.isArray(data)) {
                // Old format: just an array of logs
                setLogs(data)
                setArchives([])
                setStats(null)
            } else {
                // New format: object with current, archives, and stats
                setLogs(data.current || [])
                setArchives(data.archives || [])
                setStats(data.stats || null)
            }
            console.log('Received chatlogs:', data)
        })

        const unsubscribe2 = window.ipc.on('receive_archive_logs', (archiveLogs: ChatLog[]) => {
            setLogs(archiveLogs || [])
            console.log('Received archive logs:', archiveLogs)
        })

        window.ipc.send('user-action', 'LOG_OPENED')

        return () => {
            unsubscribe1()
            unsubscribe2()
        }
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

    const formatTimestamp = (timestamp: Date | string) => {
        const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
        return date.toLocaleString('ko-KR', {
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        })
    }

    return (
        <div className="flex flex-col gap-2 bg-gray-900 text-white h-screen w-screen" >
            <div className="flex flex-row items-center justify-between px-4 py-2 border-b border-gray-700">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">Chat Logs</h1>
                    {currentView === 'current' && stats ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400 bg-gray-800 px-2 py-1 rounded">
                                Total: {stats.total}
                            </span>
                            <span className="text-sm text-green-400 bg-gray-800 px-2 py-1 rounded">
                                Conversation: {stats.conversation}
                            </span>
                            <span className="text-sm text-blue-400 bg-gray-800 px-2 py-1 rounded">
                                Summary: {stats.summary}
                            </span>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-400 bg-gray-800 px-2 py-1 rounded">
                            {logs.length} messages
                        </span>
                    )}
                </div>

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
                    <>
                        {logs.map((log, index) => (
                            <div className="flex flex-row gap-4 py-4 bg-gray-900 border-b border-gray-800 hover:bg-gray-800 hover:text-white" key={index}>
                                <div className="shrink-0 min-w-[120px] flex flex-col items-center justify-center gap-1">
                                    <div className="text-2xl text-gray-300 font-semibold">{log.role}</div>
                                    <div className="text-xs text-gray-500">{formatTimestamp(log.createdAt)}</div>
                                </div>
                                <div className="w-px bg-gray-700 shrink-0"></div>
                                <div className="text-3xl text-gray-100 flex-1 whitespace-pre-wrap break-words leading-relaxed">{log.content}</div>
                            </div>
                        ))}
                        <div ref={logsEndRef} />
                    </>
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
