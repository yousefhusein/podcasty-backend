import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

export default class VideoProcessor {
  constructor() {
    this.ffmpeg = new FFmpeg()
    this.abortController = new AbortController()
  }

  abort() {
    console.log('Aborting video processor')
    this.abortController.abort()
    if (this.ffmpeg) {
      this.ffmpeg.terminate()
      this.ffmpeg = null
    }
  }

  async *chunkFile(file, chunkSize = 10 * 1024 * 1024) {
    let offset = 0
    let index = 0

    while (offset < file.size) {
      if (this.abortController.signal.aborted) {
        console.log('Chunk generation aborted')
        break
      }

      const chunk = file.slice(offset, offset + chunkSize)
      yield {
        chunk,
        index: index++,
      }
      offset += chunkSize
    }
  }

  async *getUploadChunks(file) {
    try {
      for await (const { chunk, index } of this.chunkFile(file)) {
        if (this.abortController.signal.aborted) {
          console.log('Upload chunks generation aborted')
          break
        }
        yield {
          chunk,
          index,
        }
      }
    } catch (error) {
      console.error('Error in getUploadChunks:', error)
      throw error
    }
  }

  async *processVideo(file) {
    try {
      if (!this.ffmpeg) {
        console.log('Initializing FFmpeg')
        this.ffmpeg = new FFmpeg()
      }

      console.log('Loading FFmpeg')
      await this.ffmpeg.load({
        coreURL: await toBlobURL('/ffmpeg-core.js', 'text/javascript'),
        wasmURL: await toBlobURL('/ffmpeg-core.wasm', 'application/wasm'),
      })

      const inputFileName = 'input.mp4'
      const outputFileName = 'output.mp4'

      console.log('Writing file to FFmpeg')
      await this.ffmpeg.writeFile(inputFileName, await fetchFile(file))

      if (this.abortController.signal.aborted) {
        console.log('Processing aborted before conversion')
        return
      }

      console.log('Converting video')
      await this.ffmpeg.exec([
        '-i',
        inputFileName,
        '-vf',
        'scale=-1:480',
        '-c:v',
        'libx264',
        '-crf',
        '23',
        '-preset',
        'fast',
        '-c:a',
        'aac',
        outputFileName,
      ])

      if (this.abortController.signal.aborted) {
        console.log('Processing aborted after conversion')
        return
      }

      console.log('Reading converted file')
      const data = await this.ffmpeg.readFile(outputFileName)
      const processedVideoBlob = new Blob([data], { type: 'video/mp4' })

      yield {
        chunk: processedVideoBlob,
        index: 0,
      }
    } catch (error) {
      console.error('Error in video processing:', error)
      throw error
    } finally {
      if (this.ffmpeg) {
        console.log('Terminating FFmpeg')
        this.ffmpeg.terminate()
        this.ffmpeg = null
      }
    }
  }
}
