import { useState } from 'react'
import './App.css'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

// 渲染单条消息
// React 组件是一个独立、可复用的 UI 片段，它接收输入（称为 props），并返回描述界面的 React 元素。
// ({ role, content })：函数的参数部分。这里使用了对象解构，直接从传入的 props 对象中提取 role 和 content 两个属性
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

// 渲染消息列表
function MessageList({ messages }) {
  return (
    <div className="message-list">
      {/* {}代表在JSX中嵌入JS表达式 */}
      {messages.length === 0 && (
        <div className="empty">Try send a message!</div>
        // 如果 messages.length === 0 为真，则计算并返回右侧的 JSX 片段（即空状态提示）。
      )}

      {messages.map((msg, index) => (
        // 回调函数返回一个React元素，这里返回一个<MessageItem>组件，用于渲染每条消息
        <MessageItem
        // key是特殊属性，不会作为prop传递给MessageItem组件，而后面的role和content才是
          key={index} 
          role={msg.role}
          content={msg.content}
        />
      ))}

    </div>
  )
}


// 提供文本输入和发送按钮
function ChatInput({ input, setInput, onSend, loading }) {
  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // 阻止默认换行并触发onsend
      onSend()
    }
  }

  return (
    <div className="input-area">
      <textarea
      // JSX允许user像写HTML一样书写界面，但这些标签最终会被编译成React元素
      // JSX里小写字母开头的标签会被视为原生HTML元素，它们会直接对应到浏览器中的真实 DOM 元素。
      // 大写字母开头的标签则被视为自定义 React 组件，比如<MessageItem>，必须已经在当前作用域中定义（或导入），并且会渲染成这些组件返回的 JSX。
        placeholder="Enter your question..."
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        rows={3}
        disabled={loading}
      />
      <button onClick={onSend} disabled={loading}>
        {loading ? 'Sending...' : 'Sent'}
      </button>
    </div>
  )
}

export default function App() {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSend() {
    const text = input.trim()
    if (!text || loading) return
  
    const userMessage = { role: 'user', content: text }
    const assistantMessage = { role: 'assistant', content: '' }
  
    setMessages((prev) => [...prev, userMessage, assistantMessage])
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
          message: text,
        }),
      })
  
      if (!res.ok) {
        throw new Error('后端请求失败')
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
  
        setMessages((prev) => {
          const next = [...prev]
          next[next.length - 1] = {
            ...next[next.length - 1],
            content: fullText,
          }
          return next
        })
      }
    } catch (err) {
      setError(err.message || '请求出错')
      setMessages((prev) => {
        const next = [...prev]
        const last = next[next.length - 1]
  
        if (last?.role === 'assistant' && last.content === '') {
          next.pop()
        }
  
        return next
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <div className="chat-panel">
        <header className="header">
          <h1>Yueying's Chat Model</h1>
          <p>React + Your Backend + Local Model</p>
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