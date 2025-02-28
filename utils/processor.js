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
  try {
    const file = new File([blob], fileName, { type: fileType })
    const apiKey = await getGeminiApiKey()
    const genAI = new GoogleGenerativeAI(apiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' })

    await validateGeminiApi(apiKey, model)

    const timestamp = Date.now()
    const filePath = `${user.id}/${timestamp}_${fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`

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
      throw new Error('Failed to create video processing record')
    }

    const videoId = record.id
    const validTargets = ['host', 'guest']
    const targetType = validTargets.includes(analysisTarget)
      ? `${analysisTarget}_analysis`
      : 'general_analysis'

    const { data: promptData, error: promptError } = await supabase.rpc(
      'get_analysis_prompt',
      { target_type: targetType },
    )
    if (promptError) throw new Error('Error fetching prompt')

    const promptText =
      promptData ||
      'Analyze the non-verbal communication and body language in this video segment.'

    // رفع الفيديو
    const { error: uploadError } = await supabase.storage
      .from('videos')
      .upload(filePath, file, { contentType: 'video/mp4' })
    if (uploadError) throw new Error('Upload error')

    // تحديث حالة الفيديو بعد الرفع
    const { error: uploadStatusError } = await supabase
      .from('video_processing')
      .update({ status: 'uploaded' })
      .eq('id', videoId)
    if (uploadStatusError) throw new Error('Failed to update upload status')

    // معالجة الفيديو باستخدام Gemini AI
    const fileData = await file.arrayBuffer()
    const base64Data = Buffer.from(new Uint8Array(fileData)).toString('base64')

    const result = await model.generateContent([
      promptText,
      { inlineData: { mimeType: 'video/mp4', data: base64Data } },
    ])

    const finalAnalysis = result.response.text
    return {
      videoId,
      finalAnalysis,
    }
  } catch (error) {
    console.error('Processing error:', error)
    return null
  }
}
