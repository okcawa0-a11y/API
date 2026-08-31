const ytdl = require('ytdl-core');
const axios = require('axios');
const { getRandomProxy } = require('../proxy/rotator');

class AudioStream {
  // === DIRECT AUDIO STREAM ===
  async getStream(videoId, quality = 'highestaudio') {
    try {
      // Try to get direct stream via ytdl-core
      const info = await ytdl.getInfo(`https://youtube.com/watch?v=${videoId}`);
      
      // Get best audio format
      const format = ytdl.chooseFormat(info.formats, { 
        quality: quality,
        filter: 'audioonly'
      });

      if (!format) {
        throw new Error('No audio format available');
      }

      return {
        url: format.url,
        contentLength: format.contentLength || 0,
        bitrate: format.bitrate || 0,
        audioQuality: quality,
        mimeType: format.mimeType || 'audio/webm'
      };
    } catch (error) {
      console.log('[STREAM] ytdl failed, trying proxy fallback');
      return await this.getStreamWithProxy(videoId);
    }
  }

  // === STREAM WITH PROXY ===
  async getStreamWithProxy(videoId) {
    const proxy = getRandomProxy();
    if (!proxy) {
      throw new Error('No proxy available');
    }

    try {
      const response = await axios.get(
        `https://music.youtube.com/watch?v=${videoId}`,
        {
          proxy: { host: proxy.split('://')[1].split(':')[0], port: parseInt(proxy.split(':')[2]) },
          timeout: 10000,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        }
      );

      // Extract audio URL from page
      const match = response.data.match(/"url":"(https:[^"]+\.m4a[^"]+)"/);
      if (match) {
        return {
          url: match[1].replace(/\\/g, ''),
          contentLength: 0,
          bitrate: 0,
          audioQuality: 'medium'
        };
      }
    } catch (error) {
      console.log('[STREAM] Proxy fallback failed:', error.message);
      throw error;
    }
  }

  // === STREAM TO RESPONSE ===
  async streamToResponse(videoId, res, quality = 'highestaudio') {
    try {
      const stream = ytdl(`https://youtube.com/watch?v=${videoId}`, {
        quality: quality,
        filter: 'audioonly'
      });

      res.setHeader('Content-Type', 'audio/webm');
      res.setHeader('Accept-Ranges', 'bytes');
      
      stream.pipe(res);
      
      stream.on('error', (error) => {
        console.log('[STREAM] Error:', error);
        res.status(500).json({ error: 'Stream failed' });
      });

    } catch (error) {
      console.log('[STREAM] Failed:', error);
      res.status(500).json({ error: error.message });
    }
  }

  // === DOWNLOAD AUDIO (IndexedDB compatible) ===
  async getAudioBuffer(videoId, quality = 'highestaudio') {
    try {
      const stream = ytdl(`https://youtube.com/watch?v=${videoId}`, {
        quality: quality,
        filter: 'audioonly'
      });

      const chunks = [];
      return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            buffer: buffer,
            size: buffer.length,
            mimeType: 'audio/webm'
          });
        });
        stream.on('error', reject);
      });
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new AudioStream();