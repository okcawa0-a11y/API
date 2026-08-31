const express = require('express');
const cors = require('cors');
const compression = require('compression');
const { YTMusic } = require('ytmusic-api');

const app = express();
const port = process.env.PORT || 3000;
const ytmusic = new YTMusic();

app.use(cors({ origin: '*' }));
app.use(compression());
app.use(express.json());

let clientReady = false;

async function initClient() {
  if (!clientReady) {
    await ytmusic.initialize();
    clientReady = true;
    console.log('[DRAGON] YTMusic ready');
  }
}

// HEALTH CHECK
app.get('/', (req, res) => {
  res.json({
    status: '🐉 Dragon Music API',
    version: '1.0.0',
    client: clientReady ? 'ready' : 'initializing'
  });
});

// SEARCH
app.get('/api/search', async (req, res) => {
  try {
    await initClient();
    const { q, type = 'SONG', limit = 20 } = req.query;
    if (!q) return res.status(400).json({ error: 'Query kosong' });

    let results = [];
    switch (type.toUpperCase()) {
      case 'SONG': results = await ytmusic.searchSongs(q); break;
      case 'ARTIST': results = await ytmusic.searchArtists(q); break;
      case 'ALBUM': results = await ytmusic.searchAlbums(q); break;
      case 'PLAYLIST': results = await ytmusic.searchPlaylists(q); break;
      default: results = await ytmusic.searchSongs(q);
    }

    const formatted = results.slice(0, parseInt(limit)).map(item => ({
      id: item.videoId || item.id || 'unknown',
      title: item.name || item.title || 'Unknown',
      artist: item.artist?.name || item.artists?.[0]?.name || 'Unknown',
      duration: item.duration?.seconds || 0,
      thumbnail: item.thumbnail?.[item.thumbnail.length - 1]?.url || null,
      year: item.year || null
    }));

    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// SONG DETAIL
app.get('/api/song/:videoId', async (req, res) => {
  try {
    await initClient();
    const { videoId } = req.params;
    const song = await ytmusic.getSong(videoId);
    const lyrics = await ytmusic.getLyrics(videoId);
    const related = await ytmusic.getSongSuggestions(videoId);

    res.json({
      id: videoId,
      title: song.name || song.title || 'Unknown',
      artist: song.artist?.name || song.artists?.[0]?.name || 'Unknown',
      album: song.album?.name || null,
      duration: song.duration?.seconds || 0,
      thumbnail: song.thumbnail?.[song.thumbnail.length - 1]?.url || null,
      year: song.year || null,
      views: song.views || 0,
      lyrics: lyrics || 'Lirik tidak tersedia',
      related: related.slice(0, 10).map(r => ({
        id: r.videoId,
        title: r.name || r.title || 'Unknown',
        artist: r.artist?.name || 'Unknown',
        thumbnail: r.thumbnail?.[r.thumbnail.length - 1]?.url || null,
        duration: r.duration?.seconds || 0
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PLAYLIST
app.get('/api/playlist/:playlistId', async (req, res) => {
  try {
    await initClient();
    const { playlistId } = req.params;
    const playlist = await ytmusic.getPlaylist(playlistId);
    res.json({
      id: playlistId,
      title: playlist.name || playlist.title || 'Unknown',
      owner: playlist.owner?.name || null,
      trackCount: playlist.trackCount || 0,
      thumbnail: playlist.thumbnail?.[playlist.thumbnail.length - 1]?.url || null,
      tracks: playlist.tracks?.slice(0, 50).map(t => ({
        id: t.videoId,
        title: t.name || t.title || 'Unknown',
        artist: t.artist?.name || 'Unknown',
        duration: t.duration?.seconds || 0,
        thumbnail: t.thumbnail?.[t.thumbnail.length - 1]?.url || null
      })) || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ALBUM
app.get('/api/album/:albumId', async (req, res) => {
  try {
    await initClient();
    const { albumId } = req.params;
    const album = await ytmusic.getAlbum(albumId);
    res.json({
      id: albumId,
      title: album.name || album.title || 'Unknown',
      artist: album.artist?.name || null,
      year: album.year || null,
      trackCount: album.trackCount || 0,
      thumbnail: album.thumbnail?.[album.thumbnail.length - 1]?.url || null,
      tracks: album.tracks?.map(t => ({
        id: t.videoId,
        title: t.name || t.title || 'Unknown',
        artist: t.artist?.name || album.artist?.name || 'Unknown',
        duration: t.duration?.seconds || 0
      })) || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ARTIST
app.get('/api/artist/:artistId', async (req, res) => {
  try {
    await initClient();
    const { artistId } = req.params;
    const artist = await ytmusic.getArtist(artistId);
    res.json({
      id: artistId,
      name: artist.name || 'Unknown',
      thumbnail: artist.thumbnail?.[artist.thumbnail.length - 1]?.url || null,
      subscribers: artist.subscribers || 0,
      songs: artist.songs?.slice(0, 15).map(s => ({
        id: s.videoId,
        title: s.name || s.title || 'Unknown',
        duration: s.duration?.seconds || 0,
        thumbnail: s.thumbnail?.[s.thumbnail.length - 1]?.url || null
      })) || []
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// TRENDING
app.get('/api/trending', async (req, res) => {
  try {
    await initClient();
    const homepage = await ytmusic.getHomepage();
    const formatted = homepage.slice(0, 30).map(item => ({
      id: item.videoId || item.id,
      title: item.name || item.title || 'Unknown',
      artist: item.artist?.name || 'Unknown',
      duration: item.duration?.seconds || 0,
      thumbnail: item.thumbnail?.[item.thumbnail.length - 1]?.url || null
    }));
    res.json(formatted);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// STREAM (pakai ytdl-core)
app.get('/api/stream/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const ytdl = require('ytdl-core');
    const info = await ytdl.getInfo(`https://youtube.com/watch?v=${videoId}`);
    const format = ytdl.chooseFormat(info.formats, { 
      quality: 'highestaudio', 
      filter: 'audioonly' 
    });
    res.json({ url: format.url });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DOWNLOAD
app.get('/api/download/:videoId', async (req, res) => {
  try {
    const { videoId } = req.params;
    const ytdl = require('ytdl-core');
    const stream = ytdl(`https://youtube.com/watch?v=${videoId}`, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });
    res.setHeader('Content-Type', 'audio/webm');
    res.setHeader('Content-Disposition', `attachment; filename="${videoId}.webm"`);
    stream.pipe(res);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// START
if (require.main === module) {
  app.listen(port, async () => {
    await initClient();
    console.log(`🐉 Dragon API running on http://localhost:${port}`);
  });
}

module.exports = app;
