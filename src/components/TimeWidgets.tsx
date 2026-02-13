import { useEffect, useState } from 'react'

export function ClientClock() {
    const [time, setTime] = useState<string>('')

    useEffect(() => {
        const updateTime = () => {
            const now = new Date()
            setTime(
                now.toLocaleTimeString('en-US', {
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                }),
            )
        }
        updateTime()
        const interval = setInterval(updateTime, 1000)
        return () => clearInterval(interval)
    }, [])

    if (!time) return <span className="text-2xl font-mono text-text">--:--:--</span>

    return <span className="text-2xl font-mono text-text tracking-widest">{time}</span>
}

export function ClientDate() {
    const [date, setDate] = useState<string>('')

    useEffect(() => {
        // Format: "Nov 21, 2024" or similar
        setDate(
            new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'short',
                day: 'numeric',
            }),
        )
    }, [])

    if (!date) return <span className="text-sm font-mono text-text-secondary">Loading...</span>

    return <span className="text-sm font-mono text-text-secondary">{date}</span>
}
