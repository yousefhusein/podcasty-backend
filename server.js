import 'dotenv/config.js'

import express from 'express'
import cors from 'cors'
import youtubeRouter from './routes/youtube.js'

const app = express()

app.use(cors({ origin: process.env.PRODUCTION_URL || '*' }))
app.use('/youtube-download', youtubeRouter)

app.listen(3000, () => {
  console.log('App is successfully started')
})
