import { useEffect, useRef } from 'react'
import type { UIMessage } from 'ai'
import { isTextUIPart, isReasoningUIPart, isToolUIPart } from 'ai'
import MessageBubble from './MessageBubble'
import ToolCallCard from './ToolCallCard'
import ReasoningBlock from './ReasoningBlock'

interface MessageThreadProps {
  messages: UIMessage[]
  isStreaming: boolean
}

export default function MessageThread({ messages, isStreaming }: MessageThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div className="flex-1 overflow-y-auto p-2 space-y-1">
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <div className="text-center" style={{ color: 'var(--hud-text-dim)' }}>
            <div className="text-[14px] mb-1">No messages yet</div>
            <div className="text-[12px]">Start a conversation below</div>
          </div>
        </div>
      ) : (
        messages.map((message, msgIndex) => {
          const isLastMessage = msgIndex === messages.length - 1
          const isStreamingThis = isStreaming && isLastMessage && message.role === 'assistant'

          return (
            <div key={message.id}>
              {message.parts.map((part, partIndex) => {
                if (isReasoningUIPart(part)) {
                  return <ReasoningBlock key={partIndex} content={part.text} />
                }
                if (isToolUIPart(part)) {
                  return <ToolCallCard key={partIndex} part={part} />
                }
                if (isTextUIPart(part) && part.text) {
                  return (
                    <MessageBubble
                      key={partIndex}
                      role={message.role as 'user' | 'assistant'}
                      content={part.text}
                      isStreaming={isStreamingThis && part.state === 'streaming'}
                    />
                  )
                }
                return null
              })}
            </div>
          )
        })
      )}
      <div ref={bottomRef} />
    </div>
  )
}
