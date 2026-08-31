// CSS Selectors for manual scraping (fallback)
// Ini hasil inspect gue dari YT Music
module.exports = {
  search: {
    item: 'ytmusic-responsive-list-item-renderer',
    title: 'yt-formatted-string.ytmusic-responsive-list-item-renderer',
    artist: 'yt-formatted-string.ytmusic-responsive-list-item-renderer[aria-label]',
    thumbnail: 'img',
    duration: 'span.ytmusic-thumbnail-overlay-time'
  },
  song: {
    title: 'yt-formatted-string.ytmusic-player-bar[title]',
    artist: 'yt-formatted-string.ytmusic-player-bar a.yt-simple-endpoint',
    album: 'yt-formatted-string.ytmusic-player-bar span.yt-formatted-string[title]',
    thumbnail: 'img.ytmusic-player-bar[src]',
    duration: 'span.ytmusic-player-bar.time-info',
    lyrics: 'ytmusic-description-shelf-renderer yt-formatted-string'
  },
  playlist: {
    title: 'h1.ytmusic-detail-header-renderer',
    owner: 'yt-formatted-string.ytmusic-detail-header-renderer[aria-label]',
    tracks: 'ytmusic-playlist-shelf-renderer ytmusic-responsive-list-item-renderer'
  },
  artist: {
    name: 'h1.ytmusic-detail-header-renderer',
    subscriber: 'yt-formatted-string.ytmusic-detail-header-renderer[aria-label]'
  }
};