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
  // .post是express应用的一个方法，用于监听HTT POST请求
  // 语法：app.post(path, callback)
    try {
      const { model, messages } = req.body

      if (!model || !model.trim()) {
        return res.status(400).json({
          error: 'model is required',
        })
      }
  
      if (!Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({
          error: 'messages must be a non-empty array',
        })
      }
  
      const ollamaRes = await fetch('http://localhost:11434/api/chat', {
        method: 'POST', // 用于定制HTTP请求，如果省略，默认发起一个GET
        headers: { // 用于设置请求头，这里告诉服务器请求体的格式是JSON
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ // BODY是请求的实际数据
          model,
          messages,
          stream: true,
        }),
      })
  
      if (!ollamaRes.ok) {
        const errorText = await ollamaRes.text()
        return res.status(500).json({
          error: `Ollama request failed: ${errorText}`,
        })
      }

      if (!ollamaRes.body) {
        return res.status(500).json({
          error: 'Ollama response body is empty',
        })
      }

      res.setHeader('Content-Type', 'text/plain; charset=utf-8')
      res.setHeader('Transfer-Encoding', 'chunked')


      const reader = ollamaRes.body.getReader() // ollamaRes.body 是一个 ReadableStream，通过 getReader() 获得一个读取器，可以逐块读取数据。
      const decoder = new TextDecoder()
      let buffer = ''
  
      while (true) {
        const { done, value } = await reader.read()
  
        if (done) break
  
        buffer += decoder.decode(value, { stream: true })
  
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''
  
        for (const line of lines) {
          if (!line.trim()) continue
  
          try {
            const json = JSON.parse(line)
            const chunk = json.message?.content || ''
  
            if (chunk) {
              res.write(chunk)
            }
          } catch (err) {
            console.error('JSON parse error:', err)
          }
        }
      }
  
      if (buffer.trim()) {
        try {
          const json = JSON.parse(buffer)
          const chunk = json.message?.content || ''
          if (chunk) {
            res.write(chunk)
          }
        } catch (err) {
          console.error('Final buffer parse error:', err)
        }
      }
  
      res.end()
    } catch (error) {
      console.error('Server error:', error)
      if (!res.headersSent) {
        res.status(500).json({
          error: 'Internal server error',
        })
      } else {
        res.end()
      }
    }
  })

app.listen(PORT, () => {
  console.log(`Server is running at http://localhost:${PORT}`)
})