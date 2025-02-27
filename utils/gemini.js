import { supabase } from './supabase.js'

const getGeminiApiKey = async () => {
  try {
    const { data, error } = await supabase.rpc('get_secret', {
      secret_name: 'GEMINI_API_KEY',
    })

    if (error || !data) {
      throw new Error('Failed to fetch Gemini API key')
    }

    return data
  } catch (error) {
    console.error('Error fetching Gemini API key:', error)
    throw error
  }
}

const validateGeminiApi = async (apiKey, model) => {
  try {
    const result = await model.generateContent([
      { text: "Test connection with a simple response: say 'ok'" },
    ])
    await result.response
    return true
  } catch (error) {
    console.error('Gemini API validation failed:', error)
    throw new Error(
      'Invalid or expired Gemini API key. Please update your API key in project settings.',
    )
  }
}

export { getGeminiApiKey, validateGeminiApi }
