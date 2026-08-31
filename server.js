const express = require('express');
const cors = require('cors');
const compression = require('compression');
const helmet = require('helmet');
const scraper = require('./src/scrapers/ytmusic');
const stream = require('./src/scrapers/stream');
const cache = require('./src/cache/manager');
const { fetchProxies, proxyList, autoRefresh } = require('./src/proxy/rotator');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors({ origin: '*', methods: ['GET', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Range'] }));
app.use(compression());
app.use(express.json());

// Init
let initialized = false;

async function init() {
  if (!initialized) {
    await scraper.init();
    await fetchProxies();
    initialized = true;
    console.log('[DRAGON] API ready');
    console.log(`[DRAGON] ${proxyList.length} proxies loaded`);
    console.log(`[DRAGON] Cache: ${cache.keys().length} items`);
  }
}

// Health check
app.get('/', (req, res) => {
  res.json({
    status: '🐉 Dragon Music API',
    version: '1.0.0',
    proxy: proxyList.length + ' proxies',
    cache: cache.keys().length + ' items',
    endpoints: [
      '/api/search?q=query&type=SONG&limit=20',
      '/api/song/:videoId',
      '/api/playlist/:playlistId',
      '/api/album/:albumId',
      '/api/artist/:artistId',
      '/api/trending',
      '/api/stream/:videoId',
      '/api/download/:videoId',
      '/api/proxies',
      '/api/clear-cache'
    ]
  });
});

// Search
app.get('/api/search', async (req, res) => {
  try {
    const { q, type = 'SONG', limit = 20 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query kosong, tolol!' });

    const cacheKey = `search_${q}_${type}_${limit}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    await autoRefresh();
    const results = await scraper.search(q, type, limit);
    cache.set(cacheKey, results);
    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Song detail
app.get('/api/song/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const cacheKey = `song_${videoId}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    await autoRefresh();
    const song = await scraper.getSong(videoId);
    cache.set(cacheKey, song);
    res.json(song);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Playlist
app.get('/api/playlist/:playlistId', async (req, res) => {
  try {
    const { playlistId } = req.params;
    const cacheKey = `playlist_${playlistId}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    await autoRefresh();
    const playlist = await scraper.getPlaylist(playlistId);
    cache.set(cacheKey, playlist);
    res.json(playlist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Album
app.get('/api/album/:albumId', async (req, res) => {
  try {
    const { albumId } = req.params;
    const cacheKey = `album_${albumId}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    await autoRefresh();
    const album = await scraper.getAlbum(albumId);
    cache.set(cacheKey, album);
    res.json(album);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Artist
app.get('/api/artist/:artistId', async (req, res) => {
  try {
    const { artistId } = req.params;
    const cacheKey = `artist_${artistId}`;
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    await autoRefresh();
    const artist = await scraper.getArtist(artistId);
    cache.set(cacheKey, artist);
    res.json(artist);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Trending
app.get('/api/trending', async (req, res) => {
  try {
    const cacheKey = 'trending';
    const cached = cache.get(cacheKey);
    if (cached) return res.json(cached);

    await autoRefresh();
    const trending = await scraper.getTrending();
    cache.set(cacheKey, trending);
    res.json(trending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Stream audio
app.get('/api/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const quality = req.query.quality || 'highestaudio';
    
    const streamData = await stream.getStream(videoId, quality);
    res.json(streamData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Download audio (buffer for IndexedDB)
app.get('/api/download/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const quality = req.query.quality || 'highestaudio';
    
    const audioBuffer = await stream.getAudioBuffer(videoId, quality);
    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}.webm"`);
    res.send(audioBuffer.buffer);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Proxy list
app.get('/api/proxies', (req, res) => {
  res.json({
    total: proxyList.length,
    proxies: proxyList.slice(0, 20)
  });
});

// Refresh proxy
app.get('/api/refresh-proxies', async (req, res) => {
  await fetchProxies();
  res.json({ message: 'Proxies refreshed', total: proxyList.length });
});

// Clear cache
app.get('/api/clear-cache', (req, res) => {
  cache.flush();
  res.json({ message: 'Cache cleared' });
});

// Start
if (require.main === module) {
  app.listen(port, async () => {
    await init();
    console.log(`🐉 Dragon API running on http://localhost:${port}`);
  });
}

module.exports = app;