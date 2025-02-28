import axios from 'axios'

async function getRedirectedURL(url) {
  try {
    const response = await axios.get(url, { maxRedirects: 0 }) // Prevent automatic redirects
    return response.headers.location // Get the redirected URL
  } catch (error) {
    if (
      error.response &&
      error.response.status >= 300 &&
      error.response.status < 400
    ) {
      return error.response.headers.location // Handle redirect manually
    }
    throw error // Handle other errors
  }
}

export { getRedirectedURL }
