const { YTMusic } = require('ytmusic-api');
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const AnonymizeUA = require('puppeteer-extra-plugin-anonymize-ua');
const { getRandomProxy } = require('../proxy/rotator');
const selectors = require('../config/selectors');

puppeteer.use(StealthPlugin());
puppeteer.use(AnonymizeUA());

class YTMusicScraper {
  constructor() {
    this.client = new YTMusic();
    this.initialized = false;
  }

  async init() {
    if (!this.initialized) {
      await this.client.initialize();
      this.initialized = true;
      console.log('[SCRAPER] ytmusic-api initialized');
    }
  }

  // === SEARCH ===
  async search(query, type = 'SONG', limit = 20) {
    await this.init();
    
    try {
      let results = [];
      switch (type.toUpperCase()) {
        case 'SONG':
          results = await this.client.searchSongs(query);
          break;
        case 'ARTIST':
          results = await this.client.searchArtists(query);
          break;
        case 'ALBUM':
          results = await this.client.searchAlbums(query);
          break;
        case 'PLAYLIST':
          results = await this.client.searchPlaylists(query);
          break;
        default:
          results = await this.client.searchSongs(query);
      }

      return results.slice(0, limit).map(item => ({
        id: item.videoId || item.id || item.playlistId || item.albumId,
        title: item.name || item.title || 'Unknown',
        artist: item.artist?.name || item.artists?.[0]?.name || 'Unknown',
        artistId: item.artist?.id || item.artists?.[0]?.id || null,
        album: item.album?.name || null,
        albumId: item.album?.id || null,
        duration: item.duration?.seconds || 0,
        thumbnail: item.thumbnail?.[item.thumbnail.length - 1]?.url || null,
        year: item.year || null,
        explicit: item.explicit || false,
        type: type.toLowerCase()
      }));
    } catch (error) {
      console.log('[SCRAPER] API failed, using puppeteer fallback');
      return await this.searchManual(query, type, limit);
    }
  }

  // === MANUAL SEARCH (puppeteer fallback) ===
  async searchManual(query, type, limit) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const page = await browser.newPage();
      await page.goto(`https://music.youtube.com/search?q=${encodeURIComponent(query)}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const results = await page.evaluate((sel, limit) => {
        const items = document.querySelectorAll(sel.search.item);
        return Array.from(items).slice(0, limit).map(item => {
          const titleEl = item.querySelector(sel.search.title);
          const artistEl = item.querySelector(sel.search.artist);
          const thumbEl = item.querySelector(sel.search.thumbnail);
          const durationEl = item.querySelector(sel.search.duration);
          
          return {
            id: item.getAttribute('videoId') || '',
            title: titleEl?.innerText || 'Unknown',
            artist: artistEl?.innerText || 'Unknown',
            thumbnail: thumbEl?.getAttribute('src') || null,
            duration: durationEl?.innerText || '0:00'
          };
        });
      }, selectors, limit);

      await browser.close();
      return results;
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  // === SONG DETAIL ===
  async getSong(videoId) {
    await this.init();

    try {
      const song = await this.client.getSong(videoId);
      const lyrics = await this.client.getLyrics(videoId);
      const related = await this.client.getSongSuggestions(videoId);

      return {
        id: videoId,
        title: song.name || song.title || 'Unknown',
        artist: song.artist?.name || song.artists?.[0]?.name || 'Unknown',
        artistId: song.artist?.id || song.artists?.[0]?.id || null,
        album: song.album?.name || null,
        albumId: song.album?.id || null,
        duration: song.duration?.seconds || 0,
        thumbnail: song.thumbnail?.[song.thumbnail.length - 1]?.url || null,
        year: song.year || null,
        explicit: song.explicit || false,
        views: song.views || 0,
        likeCount: song.likeCount || 0,
        lyrics: lyrics || 'Lirik tidak tersedia',
        related: related.slice(0, 15).map(r => ({
          id: r.videoId,
          title: r.name || r.title || 'Unknown',
          artist: r.artist?.name || 'Unknown',
          thumbnail: r.thumbnail?.[r.thumbnail.length - 1]?.url || null,
          duration: r.duration?.seconds || 0
        }))
      };
    } catch (error) {
      console.log('[SCRAPER] API failed, using puppeteer fallback');
      return await this.getSongManual(videoId);
    }
  }

  // === MANUAL SONG DETAIL (puppeteer fallback) ===
  async getSongManual(videoId) {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });

    try {
      const proxy = getRandomProxy();
      const page = await browser.newPage();
      
      if (proxy) {
        await page.authenticate({
          username: '',
          password: '',
          proxy: proxy.split('://')[1]
        });
      }

      await page.goto(`https://music.youtube.com/watch?v=${videoId}`, {
        waitUntil: 'networkidle2',
        timeout: 30000
      });

      const data = await page.evaluate((sel) => {
        const titleEl = document.querySelector(sel.song.title);
        const artistEl = document.querySelector(sel.song.artist);
        const albumEl = document.querySelector(sel.song.album);
        const thumbEl = document.querySelector(sel.song.thumbnail);
        const durationEl = document.querySelector(sel.song.duration);
        const lyricsEl = document.querySelector(sel.song.lyrics);
        
        return {
          id: window.location.pathname.split('=')[1] || '',
          title: titleEl?.getAttribute('title') || titleEl?.innerText || 'Unknown',
          artist: artistEl?.innerText || 'Unknown',
          album: albumEl?.innerText || null,
          thumbnail: thumbEl?.getAttribute('src') || null,
          duration: durationEl?.innerText || '0:00',
          lyrics: lyricsEl?.innerText || 'Lirik tidak tersedia'
        };
      }, selectors);

      await browser.close();
      return data;
    } catch (error) {
      await browser.close();
      throw error;
    }
  }

  // === PLAYLIST ===
  async getPlaylist(playlistId) {
    await this.init();
    try {
      const playlist = await this.client.getPlaylist(playlistId);
      return {
        id: playlistId,
        title: playlist.name || playlist.title || 'Unknown',
        description: playlist.description || null,
        owner: playlist.owner?.name || null,
        ownerId: playlist.owner?.id || null,
        trackCount: playlist.trackCount || playlist.itemCount || 0,
        duration: playlist.duration?.seconds || 0,
        thumbnail: playlist.thumbnail?.[playlist.thumbnail.length - 1]?.url || null,
        year: playlist.year || null,
        tracks: playlist.tracks?.slice(0, 100).map(t => ({
          id: t.videoId,
          title: t.name || t.title || 'Unknown',
          artist: t.artist?.name || 'Unknown',
          duration: t.duration?.seconds || 0,
          thumbnail: t.thumbnail?.[t.thumbnail.length - 1]?.url || null
        })) || []
      };
    } catch (error) {
      throw error;
    }
  }

  // === ALBUM ===
  async getAlbum(albumId) {
    await this.init();
    try {
      const album = await this.client.getAlbum(albumId);
      return {
        id: albumId,
        title: album.name || album.title || 'Unknown',
        artist: album.artist?.name || null,
        artistId: album.artist?.id || null,
        year: album.year || null,
        trackCount: album.trackCount || 0,
        duration: album.duration?.seconds || 0,
        thumbnail: album.thumbnail?.[album.thumbnail.length - 1]?.url || null,
        description: album.description || null,
        tracks: album.tracks?.map(t => ({
          id: t.videoId,
          title: t.name || t.title || 'Unknown',
          artist: t.artist?.name || album.artist?.name || 'Unknown',
          duration: t.duration?.seconds || 0,
          trackNumber: t.trackNumber || null
        })) || []
      };
    } catch (error) {
      throw error;
    }
  }

  // === ARTIST ===
  async getArtist(artistId) {
    await this.init();
    try {
      const artist = await this.client.getArtist(artistId);
      return {
        id: artistId,
        name: artist.name || 'Unknown',
        thumbnail: artist.thumbnail?.[artist.thumbnail.length - 1]?.url || null,
        subscribers: artist.subscribers || 0,
        biography: artist.biography || null,
        songs: artist.songs?.slice(0, 20).map(s => ({
          id: s.videoId,
          title: s.name || s.title || 'Unknown',
          duration: s.duration?.seconds || 0,
          thumbnail: s.thumbnail?.[s.thumbnail.length - 1]?.url || null
        })) || [],
        albums: artist.albums?.slice(0, 10).map(a => ({
          id: a.albumId || a.id,
          title: a.name || a.title || 'Unknown',
          year: a.year || null,
          thumbnail: a.thumbnail?.[a.thumbnail.length - 1]?.url || null
        })) || []
      };
    } catch (error) {
      throw error;
    }
  }

  // === TRENDING ===
  async getTrending(limit = 50) {
    await this.init();
    try {
      const homepage = await this.client.getHomepage();
      return homepage.slice(0, limit).map(item => ({
        id: item.videoId || item.id,
        title: item.name || item.title || 'Unknown',
        artist: item.artist?.name || 'Unknown',
        duration: item.duration?.seconds || 0,
        thumbnail: item.thumbnail?.[item.thumbnail.length - 1]?.url || null,
        views: item.views || 0
      }));
    } catch (error) {
      throw error;
    }
  }
}

module.exports = new YTMusicScraper();