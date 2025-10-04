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

const MESSAGES_PER_PAGE = 50;

export default function Logs() {
    const [logs, setLogs] = useState<ChatLog[]>([])
    const [archives, setArchives] = useState<Archive[]>([])
    const [stats, setStats] = useState<MessageStats | null>(null)
    const [currentPage, setCurrentPage] = useState(1)
    const logsEndRef = useRef<HTMLDivElement>(null)

    // Calculate total pages
    const totalPages = Math.ceil(logs.length / MESSAGES_PER_PAGE)

    // Get current page messages
    const currentMessages = logs.slice(
        (currentPage - 1) * MESSAGES_PER_PAGE,
        currentPage * MESSAGES_PER_PAGE
    )

    // Auto-scroll to bottom when on last page
    useEffect(() => {
        if (currentPage === totalPages) {
            logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
        }
    }, [logs, currentPage, totalPages])

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
            // Jump to last page when new logs arrive
            const logsArray = Array.isArray(data) ? data : (data.current || [])
            const newTotalPages = Math.ceil(logsArray.length / MESSAGES_PER_PAGE)
            setCurrentPage(newTotalPages || 1)
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
        const reply = confirm('⚠️ WARNING: All chat history will be permanently deleted.\n\nAre you sure you want to continue?\n\nThis action cannot be undone.')
        if (reply) {
            window.ipc.send('user-action', 'RESET_CHAT_HISTORY')
        }
    }

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page)
            window.scrollTo({ top: 0, behavior: 'smooth' })
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
        <div className="flex flex-col gap-2 bg-gray-900 text-white h-screen w-screen">
            <div className="flex flex-row items-center justify-between px-4 py-2 border-b border-gray-700">
                <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold">Chat Logs</h1>
                    {stats ? (
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-gray-400 bg-gray-800 px-2 py-1 rounded">
                                Total: {stats.total}
                            </span>
                            <span className="text-sm text-green-400 bg-gray-800 px-2 py-1 rounded">
                                Messages: {stats.conversation}
                            </span>
                        </div>
                    ) : (
                        <span className="text-sm text-gray-400 bg-gray-800 px-2 py-1 rounded">
                            {logs.length} messages
                        </span>
                    )}
                </div>

                {/* Pagination controls */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => goToPage(1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                    >
                        ««
                    </button>
                    <button
                        onClick={() => goToPage(currentPage - 1)}
                        disabled={currentPage === 1}
                        className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                    >
                        ‹
                    </button>
                    <span className="text-sm text-gray-400">
                        Page {currentPage} / {totalPages}
                    </span>
                    <button
                        onClick={() => goToPage(currentPage + 1)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                    >
                        ›
                    </button>
                    <button
                        onClick={() => goToPage(totalPages)}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1 bg-gray-800 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-700"
                    >
                        »»
                    </button>
                </div>
            </div>

            <div className="flex flex-col gap-2 overflow-y-auto px-4 flex-1">
                {logs.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">No messages</div>
                ) : (
                    <>
                        {currentMessages.map((log, index) => {
                            const globalIndex = (currentPage - 1) * MESSAGES_PER_PAGE + index;
                            return (
                                <div className="flex flex-row gap-4 py-4 bg-gray-900 border-b border-gray-800 hover:bg-gray-800 hover:text-white" key={globalIndex}>
                                    <div className="shrink-0 min-w-[120px] flex flex-col items-center justify-center gap-1">
                                        <div className="text-2xl text-gray-300 font-semibold">{log.role}</div>
                                        <div className="text-xs text-gray-500">{formatTimestamp(log.createdAt)}</div>
                                        <div className="text-xs text-gray-600">#{globalIndex + 1}</div>
                                    </div>
                                    <div className="w-px bg-gray-700 shrink-0"></div>
                                    <div className="text-3xl text-gray-100 flex-1 whitespace-pre-wrap break-words leading-relaxed">{log.content}</div>
                                </div>
                            );
                        })}
                        <div ref={logsEndRef} />
                    </>
                )}
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700 bg-gray-800">
                <button
                    className="text-white font-bold rounded-md bg-red-700 hover:bg-red-800 px-6 py-3 border-2 border-red-500 shadow-lg transition-all hover:shadow-red-500/50"
                    onClick={clearLogs}
                >
                    ⚠️ RESET CHAT HISTORY
                </button>

                <div className="text-sm text-gray-400">
                    Showing {(currentPage - 1) * MESSAGES_PER_PAGE + 1} - {Math.min(currentPage * MESSAGES_PER_PAGE, logs.length)} of {logs.length}
                </div>
            </div>
        </div>
    )
}
