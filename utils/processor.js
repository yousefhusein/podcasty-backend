import { GoogleGenerativeAI } from '@google/generative-ai'
import { getGeminiApiKey, validateGeminiApi } from './gemini.js'
import { supabase } from './supabase.js'

export default async function processVideo(
  user,
  fileName,
  fileType,
  blob,
  analysisTarget,
) {
  let file = new File([blob], fileName, { type: fileType })
  let videoId = null
  let filePath = null
  let finalAnalysis = ''

  try {
    const apiKey = await getGeminiApiKey()
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

    await validateGeminiApi(apiKey, model)

    const timestamp = Date.now()
    filePath = `${user.id}/${timestamp}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

    // Create video processing record
    const { data: record, error: createError } = await supabase
      .from('video_processing')
      .insert({
        filename: fileName,
        storage_path: filePath,
        status: 'uploading',
        user_id: user.id,
        is_chunked: false,
        deleted_at: null,
      })
      .select()
      .single()

    if (createError || !record?.id) {
      console.error('Failed to create video processing record')
      return null
    }

    console.log(record)
    videoId = record.id

    // Get analysis prompt using RPC call
    console.log('Fetching analysis prompt for target:', analysisTarget)

    const validTargets = ['host', 'guest']
    const targetType = validTargets.includes(analysisTarget)
      ? `${analysisTarget}_analysis`
      : 'general_analysis'

    const { data: promptData, error: promptError } = await supabase.rpc(
      'get_analysis_prompt',
      { target_type: targetType },
    )

    if (promptError) {
      console.error('Error fetching prompt:', promptError)
      return null
    }

    const promptText =
      promptData ||
      'Analyze the non-verbal communication and body language in this video segment, noting any significant patterns or moments.'

    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, blob, { contentType: fileType, cacheControl: '3600' })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return null
    }

    console.log('Small file uploaded successfully')

    const { error: uploadError2 } = await supabase
      .from('video_processing')
      .update({ status: 'uploaded' })
      .eq('id', videoId)

    if (uploadError2) {
      console.error(uploadError2)
      return null
    }

    try {
      const fileData = await file.arrayBuffer()
      const base64Data = Buffer.from(new Uint8Array(fileData)).toString(
        'base64',
      )

      const result = await model.generateContent([
        { text: promptText },
        {
          inlineData: {
            mimeType: fileType,
            data: base64Data,
          },
        },
      ])

      finalAnalysis = result.response?.candidates?.[0]?.text || ''
      console.log(finalAnalysis)
    } catch (error) {
      console.error('Error processing small file:', error)
      return null
    }
  } catch (error) {
    console.error('Processing error:', error)

    if (videoId) {
      await supabase
        .from('video_processing')
        .update({ status: 'failed' })
        .eq('id', videoId)
    }

    return null
  }

  return videoId
}
