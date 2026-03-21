import { useEffect, useMemo, useState } from 'react'
import './App.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

const MODEL_OPTIONS = [
  'llama3.1:8b',
  'qwen2.5:7b',
  'deepseek-r1:7b',
]

function createNewConversation() {
  const id = Date.now().toString()
  return {
    id,
    title: 'New Chat',
    model: MODEL_OPTIONS[0],
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }
}

function MessageItem({ role, content }) {
  return (
    <div className={`message ${role}`}>
      <div className="bubble">
        <strong>{role === 'user' ? 'You' : 'Model'}</strong>
        {role === 'assistant' ? (
          <div className="markdown-body">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {content}
            </ReactMarkdown>
          </div>
        ) : (
          <p>{content}</p>
        )}
      </div>
    </div>
  )
}

function MessageList({ messages }) {
  return (
    <div className="message-list">
      {messages.length === 0 && (
        <div className="empty">Start a new conversation!</div>
      )}

      {messages.map((msg, index) => (
        <MessageItem
          key={index}
          role={msg.role}
          content={msg.content}
        />
      ))}
    </div>
  )
}

function ChatInput({ input, setInput, onSend, loading }) {
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      onSend()
    }
  }

  return (
    <div className="input-area">
      <textarea
        placeholder="Enter your question..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        disabled={loading}
      />
      <button onClick={onSend} disabled={loading}>
        {loading ? 'Sending...' : 'Send'}
      </button>
    </div>
  )
}

function Sidebar({
  conversations,
  currentConversationId,
  onSelectConversation,
  onNewConversation,
  onDeleteConversation,
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h2>Chats</h2>
        <button className="new-chat-btn" onClick={onNewConversation}>
          + New Chat
        </button>
      </div>

      <div className="conversation-list">
        {conversations.map((chat) => (
          <div
            key={chat.id}
            className={`conversation-item ${
              chat.id === currentConversationId ? 'active' : ''
            }`}
            onClick={() => onSelectConversation(chat.id)}
          >
            <div className="conversation-main">
              <div className="conversation-title">{chat.title}</div>
              <div className="conversation-meta">{chat.model}</div>
            </div>
            <button
              className="delete-btn"
              onClick={(e) => {
                e.stopPropagation()
                onDeleteConversation(chat.id)
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </aside>
  )
}

export default function App() {
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [conversations, setConversations] = useState(() => {
    const saved = localStorage.getItem('chat_conversations')
    if (saved) {
      try {
        return JSON.parse(saved)
      } catch {
        return [createNewConversation()]
      }
    }
    return [createNewConversation()]
  })

  const [currentConversationId, setCurrentConversationId] = useState(() => {
    const saved = localStorage.getItem('current_conversation_id')
    return saved || null
  })

  useEffect(() => {
    if (!currentConversationId && conversations.length > 0) {
      setCurrentConversationId(conversations[0].id)
    }
  }, [currentConversationId, conversations])

  useEffect(() => {
    localStorage.setItem('chat_conversations', JSON.stringify(conversations))
  }, [conversations])

  useEffect(() => {
    if (currentConversationId) {
      localStorage.setItem('current_conversation_id', currentConversationId)
    }
  }, [currentConversationId])

  const currentConversation = useMemo(() => {
    return conversations.find((item) => item.id === currentConversationId) || conversations[0]
  }, [conversations, currentConversationId])

  const selectedModel = currentConversation?.model || MODEL_OPTIONS[0]
  const messages = currentConversation?.messages || []

  function updateCurrentConversation(updater) {
    setConversations((prev) =>
      prev.map((chat) =>
        chat.id === currentConversationId ? updater(chat) : chat
      )
    )
  }

  function handleNewConversation() {
    const newChat = createNewConversation()
    setConversations((prev) => [newChat, ...prev])
    setCurrentConversationId(newChat.id)
    setInput('')
    setError('')
  }

  function handleDeleteConversation(id) {
    const next = conversations.filter((chat) => chat.id !== id)

    if (next.length === 0) {
      const newChat = createNewConversation()
      setConversations([newChat])
      setCurrentConversationId(newChat.id)
      return
    }

    setConversations(next)

    if (id === currentConversationId) {
      setCurrentConversationId(next[0].id)
    }
  }

  function handleModelChange(e) {
    const nextModel = e.target.value
    updateCurrentConversation((chat) => ({
      ...chat,
      model: nextModel,
      updatedAt: Date.now(),
    }))
  }

  async function handleSend() {
    const text = input.trim()
    if (!text || loading || !currentConversation) return

    const userMessage = { role: 'user', content: text }
    const assistantMessage = { role: 'assistant', content: '' }

    const nextMessages = [...currentConversation.messages, userMessage, assistantMessage]

    updateCurrentConversation((chat) => ({
      ...chat,
      title:
        chat.messages.length === 0
          ? text.slice(0, 24) || 'New Chat'
          : chat.title,
      messages: nextMessages,
      updatedAt: Date.now(),
    }))

    setInput('')
    setError('')
    setLoading(true)

    try {
      const res = await fetch('http://localhost:3000/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: currentConversation.model,
          messages: [...currentConversation.messages, userMessage],
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || '后端请求失败')
      }

      if (!res.body) {
        throw new Error('当前浏览器不支持流式读取')
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        fullText += chunk

        updateCurrentConversation((chat) => {
          const updatedMessages = [...chat.messages]
          updatedMessages[updatedMessages.length - 1] = {
            ...updatedMessages[updatedMessages.length - 1],
            content: fullText,
          }

          return {
            ...chat,
            messages: updatedMessages,
            updatedAt: Date.now(),
          }
        })
      }
    } catch (err) {
      setError(err.message || '请求出错')

      updateCurrentConversation((chat) => {
        const updatedMessages = [...chat.messages]
        const last = updatedMessages[updatedMessages.length - 1]

        if (last?.role === 'assistant' && last.content === '') {
          updatedMessages.pop()
        }

        return {
          ...chat,
          messages: updatedMessages,
          updatedAt: Date.now(),
        }
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <Sidebar
        conversations={[...conversations].sort((a, b) => b.updatedAt - a.updatedAt)}
        currentConversationId={currentConversationId}
        onSelectConversation={setCurrentConversationId}
        onNewConversation={handleNewConversation}
        onDeleteConversation={handleDeleteConversation}
      />

      <div className="chat-panel">
        <header className="header">
          <div>
            <h1>Yueying's Chat Model</h1>
            <p>React + Your Backend + Local Model</p>
          </div>

          <div className="model-switcher">
            <label htmlFor="model-select">Model</label>
            <select
              id="model-select"
              value={selectedModel}
              onChange={handleModelChange}
              disabled={loading}
            >
              {MODEL_OPTIONS.map((model) => (
                <option key={model} value={model}>
                  {model}
                </option>
              ))}
            </select>
          </div>
        </header>

        {error && <div className="error">{error}</div>}

        <MessageList messages={messages} />

        <ChatInput
          input={input}
          setInput={setInput}
          onSend={handleSend}
          loading={loading}
        />
      </div>
    </div>
  )
}