import { GoogleGenerativeAI } from '@google/generative-ai'
import { supabase } from './supabase.js'

export async function mergeAnalyses(analyses) {
  try {
    // Get the merge prompt from Supabase
    const { data: mergePromptData, error: promptError } = await supabase
      .from('analysis_prompts')
      .select('prompt')
      .eq('target_type', 'merge_analysis')
      .maybeSingle()

    if (promptError) {
      console.error('Error fetching merge prompt:', promptError)
      throw promptError
    }

    const mergePrompt =
      mergePromptData?.prompt || 'Merge these analyses chronologically:'
    console.log('Using merge prompt:', mergePrompt)

    // Get Gemini API key
    console.log('Fetching Gemini API key...')
    const { data: geminiKey, error: keyError } = await supabase.rpc(
      'get_secret',
      { secret_name: 'GEMINI_API_KEY' },
    )

    if (keyError || !geminiKey) {
      throw new Error('Failed to fetch Gemini API key')
    }

    // Initialize Gemini
    const genAI = new GoogleGenerativeAI(geminiKey)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })

    // Split analyses into chunks (aiming for roughly 80k tokens)
    const CHUNK_SIZE = 80000
    const chunks = []
    let currentChunk = []
    let currentSize = 0

    for (const analysis of analyses) {
      const analysisSize = analysis.length
      if (currentSize + analysisSize > CHUNK_SIZE) {
        chunks.push(currentChunk)
        currentChunk = []
        currentSize = 0
      }
      currentChunk.push(analysis)
      currentSize += analysisSize
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
    }

    // Process each chunk with Gemini
    const chunkResults = []
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i]
      console.log(`Processing merge chunk ${i + 1}/${chunks.length}`)

      const result = await model.generateContent(
        `${mergePrompt}\n\nChunk ${i + 1}/${chunks.length}:\n\n${chunk.join('\n\n')}`,
      )
      const response = await result.response
      const text = response.text()
      chunkResults.push(text)
    }

    // If we have multiple chunks, merge them in a final pass
    if (chunkResults.length > 1) {
      const finalResult = await model.generateContent(
        `${mergePrompt}\n\nFinal merge of all chunks:\n\n${chunkResults.join('\n\n')}`,
      )
      const finalResponse = await finalResult.response
      return finalResponse.text()
    }

    return chunkResults[0]
  } catch (error) {
    console.error('Error in mergeAnalyses:', error)
    throw error
  }
}
