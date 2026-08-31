const axios = require('axios');

// Proxy sources (free & reliable)
const PROXY_SOURCES = [
  'https://api.proxyscrape.com/v2/?request=displayproxies&protocol=http&timeout=10000&country=all&ssl=all&anonymity=all',
  'https://www.proxy-list.download/api/v1/get?type=http',
  'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
  'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
  'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt'
];

let proxyList = [];
let currentIndex = 0;
let lastFetch = 0;

// Fetch fresh proxies
async function fetchProxies() {
  console.log('[PROXY] Fetching fresh proxies...');
  const allProxies = [];
  
  for (const source of PROXY_SOURCES) {
    try {
      const response = await axios.get(source, { timeout: 5000 });
      const proxies = response.data.split('\n')
        .filter(line => line.trim())
        .map(line => {
          const parts = line.trim().split(':');
          if (parts.length >= 2) {
            return `http://${parts[0]}:${parts[1]}`;
          }
          return null;
        })
        .filter(p => p);
      allProxies.push(...proxies);
    } catch (e) {
      console.log('[PROXY] Source failed:', e.message);
    }
  }

  // Unique filter
  proxyList = [...new Set(allProxies)].filter(p => p);
  console.log(`[PROXY] Loaded ${proxyList.length} proxies`);
  lastFetch = Date.now();
  return proxyList;
}

// Get random proxy
function getRandomProxy() {
  if (proxyList.length === 0) return null;
  const proxy = proxyList[Math.floor(Math.random() * proxyList.length)];
  return proxy;
}

// Rotate proxy (round-robin)
function rotateProxy() {
  if (proxyList.length === 0) return null;
  currentIndex = (currentIndex + 1) % proxyList.length;
  return proxyList[currentIndex];
}

// Test proxy validity
async function testProxy(proxyUrl) {
  try {
    const response = await axios.get('https://api.ipify.org?format=json', {
      proxy: { host: proxyUrl.split('://')[1].split(':')[0], port: parseInt(proxyUrl.split(':')[2]) },
      timeout: 3000
    });
    return true;
  } catch (e) {
    return false;
  }
}

// Auto refresh proxies every 30 minutes
async function autoRefresh() {
  if (Date.now() - lastFetch > 1800000) { // 30 minutes
    await fetchProxies();
  }
}

module.exports = {
  fetchProxies,
  getRandomProxy,
  rotateProxy,
  testProxy,
  autoRefresh,
  proxyList
};