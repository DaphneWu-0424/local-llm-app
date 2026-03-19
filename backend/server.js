const express = require('express')
const cors = require('cors')

const app = express()
// 创建一个Express应用实例，赋值给app
const PORT = 3000

app.use(cors()) // 启用CORS中间件，这样前端就可以安全的调用这个API
app.use(express.json())
// 内置中间件，用于解析HTTP请求中的JSON格式的请求体，让数据可以直接以JS对象的形式访问

app.get('/', (req, res) => {
    // 定义一个GET路由，路径为根路径
    // 当用户访问 http://localhost:3000/ 时，服务器会返回字符串 'Backend is running'
  res.send('Backend is running')
})

app.post('/api/chat', async (req, res) => {
    try {
      const { message } = req.body
  
      if (!message || !message.trim()) {
        return res.status(400).json({
          error: 'message is required',
        })
      }
  
      const ollamaRes = await fetch('http://localhost:11434/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'llama3.1:8b',
          messages: [
            {
              role: 'user',
              content: message,
            },
          ],
          stream: false,
        }),
      })
  
      if (!ollamaRes.ok) {
        const errorText = await ollamaRes.text()
        return res.status(500).json({
          error: `Ollama request failed: ${errorText}`,
        })
      }
  
      const data = await ollamaRes.json()
  
      return res.json({
        reply: data.message?.content || '没有收到模型回复',
      })
    } catch (error) {
      console.error('Server error:', error)
      return res.status(500).json({
        error: 'Internal server error',
      })
    }
  })

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`)
})