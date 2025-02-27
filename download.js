import axios from 'axios'
import { Blob } from 'buffer' // Import Blob from buffer module

export async function downloadVideoAsBlob(url) {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer', // Get raw binary data
      headers: {
        'User-Agent': 'Mozilla/5.0',
        Accept: 'video/mp4',
      },
    })

    const videoBuffer = Buffer.from(response.data) // Convert to Buffer
    const videoBlob = new Blob([videoBuffer], { type: 'video/mp4' }) // Convert to Blob

    console.log('Blob created successfully!', videoBlob)
    return videoBlob
  } catch (error) {
    console.error('Error downloading video:', error)
  }
}
