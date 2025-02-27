# Podcasty API

Podcasty API allows you to fetch YouTube videos and process them as needed using a pipeline system. This project utilizes `@distube/ytdl-core` (a fork of `ytdl-core`) to bypass YouTube's security checks by using cookies or proxies.

---

## 🚀 How It Works

1. **Fetching Videos**
   - The app relies on `@distube/ytdl-core`, which supports injecting cookies and proxies into request agents.
   - To bypass YouTube's "I am not a bot" security, you must provide your YouTube cookies in the `cookies.json` file.
   - Alternatively, proxies can be used for bypassing, but in this version, we are utilizing cookies.
2. **Processing the Videos**
   - Once the video is fetched, a pipeline is created to send it to the client.
   - The client can then process the video as needed.

---

## 🛠️ Setup & Installation

1. **Install dependencies**

   ```sh
   npm install
   ```

2. **Start the app**
   ```sh
   npm start
   ```

Now, you're all set! 🎉

---

## 🌐 Hosting

Currently, Podcasty API is hosted on [Render](https://render.com).

### Live API Endpoint:

🔗 [https://podcasty-r-d.onrender.com](https://podcasty-r-d.onrender.com)

---

## 📌 Notes

- Ensure you update `cookies.json` with your YouTube cookies for seamless functionality.
- Using proxies as an alternative bypass method is possible but not implemented in this version.

Happy coding! 🚀
