import { Router } from 'express'
const router = Router()
import { ApifyClient } from 'apify-client'
import { rateLimit } from 'express-rate-limit'
import processor from '../utils/processor.js'
import { supabase } from '../utils/supabase.js'
// import fetch from 'node-fetch'
import { downloadVideoAsBlob } from '../download.js'
import { getRedirectedURL } from '../getRedirectedURL.js'
import { Readable } from 'stream'

const apifyClient = new ApifyClient({
  token: process.env.APIFY_CLIENT_API_KEY,
})

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 2,
  legacyHeaders: false,
})

async function checkAuth(req, res, next) {
  const [access_token, refresh_token] = req.headers.authorization?.split(/\s+/)
  const session = await supabase.auth.setSession({
    access_token,
    refresh_token,
  })

  if (session?.error || !session?.data?.user?.id) {
    return res.status(401).json({
      error: session?.error || 'Unauthenticated',
    })
  }

  req.session = session.data.session
  req.user = session.data.user

  return next()
}

const actor = apifyClient.actor('easyapi/youtube-video-and-mp3-downloader')

router.get('/', checkAuth, limiter, async (req, res) => {
  const videoURL = req.query.url
  const call = await actor.call({ links: [videoURL] })
  const { items } = await apifyClient.dataset(call.defaultDatasetId).listItems()
  const medias = items?.[0]?.result?.medias || []
  console.log(`Extract video: ${videoURL}`)
  const media =
    medias.find((e) => (e?.download_url || e?.url) && e.is_audio) || medias[0]
  const download_url = media.download_url || media.url
  // console.log(`Not prepared`, not_prepared_d_url)
  // const download_url = await getRedirectedURL(not_prepared_d_url)
  // console.log(`Download URL: ${download_url}`)
  /**
   * @type {import('@supabase/supabase-js').User}
   */
  const user = req.user

  if (!items?.[0] || items[0]?.error || items?.[0]?.result?.error) {
    return res
      .status(items?.[0].status || items?.[0]?.result?.status || 400)
      .json({
        error:
          items?.[0]?.error || items?.[0]?.result?.error || 'Unknown error',
      })
  }

  if (!download_url) {
    return res
      .status(items?.[0].status || items?.[0]?.result?.status || 400)
      .json({
        error:
          items?.[0]?.error ||
          items?.[0]?.result?.error ||
          "Download URL isn't found",
      })
  }
  try {
    const output = {
      title: items?.[0]?.result?.title,
      duration: items?.[0]?.result?.duration,
      download_url,
      success: true,
      url: download_url,
    }

    return res.status(200).json(output)
    let isRedirected = false
    let timeoutExceeds = false
    // const videoResponse = await fetch(output.download_url)
    const blob = await downloadVideoAsBlob(output.download_url)

    if (!blob) {
      return res.status(500).json({ error: 'video unavailable' })
    }

    setTimeout(() => {
      !isRedirected && res.status(408).json({ error: 'Timeout exceeds 300000' })
      timeoutExceeds = true
    }, 300000)

    console.log(`Processing...`)
    try {
      const result = await processor(
        user,
        `${output.title}.mp4`,
        'video/mp4',
        blob,
        req.query.target || 'host',
      )

      if (!result) {
        return res.status(400).json({
          error: 'Could not process the video please try again later',
        })
      }

      if (!timeoutExceeds && typeof result.videoId === 'string') {
        isRedirected = true
        return res.status(200).json({
          id: result.videoId,
          ...result,
          success: true,
        })
      } else if (!timeoutExceeds) {
        return res.status(400).json({
          error: 'Could not process the video please try again later',
        })
      }
    } catch (error) {
      console.error(error)
    } finally {
      if (!isRedirected) {
        return res.status(400).json({
          error: 'Could not process the video please try again later',
        })
      }
    }
  } catch (error) {
    console.error(error)
    return res.status(500).json({ error: 'Unable to download the video' })
  }
})

router.get('/download', async (req, res) => {
  try {
    const url = req.query.url
    const redirectURL = (await getRedirectedURL(url)) || url
    const blob = await downloadVideoAsBlob(redirectURL)

    // Convert Blob to Stream
    const buffer = await blob.arrayBuffer() // Convert Blob to ArrayBuffer
    const readableStream = Readable.from(Buffer.from(buffer)) // Create a Readable stream

    // Set response headers
    res.setHeader('Content-Type', blob.type)
    res.setHeader('Content-Length', blob.size)
    res.setHeader('Content-Disposition', 'attachment; filename="file.txt"')

    // Pipe stream to response
    readableStream.pipe(res)
  } catch (error) {
    console.error('Error:', error)
    res.status(500).send('Internal Server Error')
  }
})

export default router
