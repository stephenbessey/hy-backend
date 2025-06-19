const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://hysimulator.vercel.app',
    'https://www.hysimulator.com',
    'https://hysimulator.com',
    /\.vercel\.app$/,
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type', 
    'Authorization', 
    'Accept',
    'Cache-Control',
    'Pragma',
    'Expires',
    'X-Requested-With'
  ],
  credentials: true
}));

app.options('*', cors());
app.use(express.json());

let athletes = [];

const SCRAPING_CONFIG = {
  baseUrls: [
    'https://results.hyrox.com/season-8/?pidp=ranking_nav&pid=list_overall',
    'https://results.hyrox.com/season-8/?pidp=ranking_nav&pid=list_overall&search%5Bsex%5D=M',
    'https://results.hyrox.com/season-8/?pidp=ranking_nav&pid=list_overall&search%5Bsex%5D=W'
  ],
  maxAthletes: process.env.SCRAPING_MAX_ATHLETES || 20,
  delayMs: process.env.SCRAPING_DELAY_MS || 4000,
  enabled: process.env.SCRAPING_ENABLED !== 'false',
  timeout: 45000
};

const HYROX_EVENT_MAPPING = {
  'Running 1': { name: '1km Run', order: 1 },
  'Running 2': { name: '1km Run', order: 3 },
  'Running 3': { name: '1km Run', order: 5 },
  'Running 4': { name: '1km Run', order: 7 },
  'Running 5': { name: '1km Run', order: 9 },
  'Running 6': { name: '1km Run', order: 11 },
  'Running 7': { name: '1km Run', order: 13 },
  'Running 8': { name: '1km Run', order: 15 },
  '1000m SkiErg': { name: '1000m SkiErg', order: 2 },
  '50m Sled Push': { name: '50m Sled Push', order: 4 },
  '50m Sled Pull': { name: '50m Sled Pull', order: 6 },
  '80m Burpee Broad Jump': { name: '80m Burpee Broad Jumps', order: 8 },
  '1000m Row': { name: '1000m Rowing', order: 10 },
  '200m Farmers Carry': { name: '200m Farmers Carry', order: 12 },
  '100m Sandbag Lunges': { name: '100m Sandbag Lunges', order: 14 },
  'Wall Balls': { name: '100 Wall Balls', order: 16 }
};

const STANDARD_HYROX_EVENTS = [
  { name: '1km Run', order: 1, defaultDuration: 240 },
  { name: '1000m SkiErg', order: 2, defaultDuration: 240 },
  { name: '1km Run', order: 3, defaultDuration: 240 },
  { name: '50m Sled Push', order: 4, defaultDuration: 120 },
  { name: '1km Run', order: 5, defaultDuration: 240 },
  { name: '50m Sled Pull', order: 6, defaultDuration: 120 },
  { name: '1km Run', order: 7, defaultDuration: 240 },
  { name: '80m Burpee Broad Jumps', order: 8, defaultDuration: 300 },
  { name: '1km Run', order: 9, defaultDuration: 240 },
  { name: '1000m Rowing', order: 10, defaultDuration: 240 },
  { name: '1km Run', order: 11, defaultDuration: 240 },
  { name: '200m Farmers Carry', order: 12, defaultDuration: 150 },
  { name: '1km Run', order: 13, defaultDuration: 240 },
  { name: '100m Sandbag Lunges', order: 14, defaultDuration: 300 },
  { name: '1km Run', order: 15, defaultDuration: 240 },
  { name: '100 Wall Balls', order: 16, defaultDuration: 360 }
];

function findEventMapping(scrapedEventName) {
  if (HYROX_EVENT_MAPPING[scrapedEventName]) {
    return HYROX_EVENT_MAPPING[scrapedEventName];
  }
  
  const cleanName = scrapedEventName.toLowerCase().trim();
  for (const [mappedName, mapping] of Object.entries(HYROX_EVENT_MAPPING)) {
    const cleanMappedName = mappedName.toLowerCase();
    if (cleanName.includes(cleanMappedName) || cleanMappedName.includes(cleanName)) {
      return mapping;
    }
  }
  return null;
}

function transformScrapedData(scrapedData) {
  return scrapedData.map((scraped, athleteIndex) => {
    console.log(`🔄 Transforming data for: ${scraped.name}`);
    console.log(`   Raw scraped data keys: ${Object.keys(scraped.data).join(', ')}`);
    
    const eventsByOrder = new Map();
    let totalTime = 0;
    
    Object.entries(scraped.data).forEach(([scrapedEventName, eventData]) => {
      console.log(`   Processing: "${scrapedEventName}" with data:`, eventData);
      
      const mapping = findEventMapping(scrapedEventName);
      
      if (mapping) {
        let duration = eventData.seconds || 0;
        if (duration === 0 && eventData.time) {
          duration = convertTimeToSeconds(eventData.time);
          console.log(`   🔧 Converted time "${eventData.time}" to ${duration}s`);
        }
        
        console.log(`   Duration for ${scrapedEventName}: ${duration}s (from eventData.seconds: ${eventData.seconds})`);
        
        eventsByOrder.set(mapping.order, {
          name: mapping.name,
          duration: duration,
          color: '#feed00',
          order_index: mapping.order
        });
        totalTime += duration;
        console.log(`  ✅ Mapped: "${scrapedEventName}" -> "${mapping.name}" (${duration}s) - Total now: ${totalTime}s`);
      } else {
        console.log(`  ⚠️ No mapping found for: "${scrapedEventName}"`);
      }
    });
    
    STANDARD_HYROX_EVENTS.forEach(standardEvent => {
      if (!eventsByOrder.has(standardEvent.order)) {
        eventsByOrder.set(standardEvent.order, {
          name: standardEvent.name,
          duration: standardEvent.defaultDuration,
          color: '#feed00',
          order_index: standardEvent.order
        });
        totalTime += standardEvent.defaultDuration;
        console.log(`  📝 Added default: "${standardEvent.name}" (${standardEvent.defaultDuration}s) - Total now: ${totalTime}s`);
      }
    });
    
    const orderedEvents = Array.from(eventsByOrder.keys())
      .sort((a, b) => a - b)
      .map(order => eventsByOrder.get(order));
    
    let splitTime = 0;
    const finalEvents = orderedEvents.map((event, index) => {
      splitTime += event.duration;
      return {
        ...event,
        order_index: index + 1,
        split_time: splitTime
      };
    });
    
    console.log(`🎯 Transformed ${scraped.name}: ${finalEvents.length} events, ${totalTime}s total`);
    
    return {
      id: athletes.length + athleteIndex + 1,
      name: scraped.name,
      category: 'Live Data',
      total_time: totalTime,
      ranking: athleteIndex + 1,
      year: new Date().getFullYear(),
      location: 'Live Data',
      lastUpdated: scraped.lastUpdated,
      events: finalEvents
    };
  });
}

function convertTimeToSeconds(timeStr) {
  if (!timeStr || typeof timeStr !== 'string') return 0;
  
  const cleanTime = timeStr.replace(/[^\d:]/g, '');
  const parts = cleanTime.split(':');
  
  console.log(`    🕐 Converting time: "${timeStr}" -> parts: [${parts.join(', ')}]`);
  
  if (parts.length === 2) {
    const minutes = parseInt(parts[0]) || 0;
    const seconds = parseInt(parts[1]) || 0;
    const totalSeconds = minutes * 60 + seconds;
    console.log(`    ✅ MM:SS format: ${minutes}m ${seconds}s = ${totalSeconds}s`);
    return totalSeconds;
  } else if (parts.length === 3) {
    const hours = parseInt(parts[0]) || 0;
    const minutes = parseInt(parts[1]) || 0;
    const seconds = parseInt(parts[2]) || 0;
    const totalSeconds = hours * 3600 + minutes * 60 + seconds;
    console.log(`    ✅ HH:MM:SS format: ${hours}h ${minutes}m ${seconds}s = ${totalSeconds}s`);
    return totalSeconds;
  }
  
  console.log(`    ❌ Invalid time format: "${timeStr}"`);
  return 0;
}

class HyroxScraper {
  constructor() {
    this.axiosConfig = {
      timeout: SCRAPING_CONFIG.timeout,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
      }
    };
    
    this.baseUrls = {
      allAthletes: 'https://results.hyrox.com/season-8/?pidp=ranking_nav&pid=list_overall',
      menAthletes: 'https://results.hyrox.com/season-8/?pidp=ranking_nav&pid=list_overall&search%5Bsex%5D=M',
      womenAthletes: 'https://results.hyrox.com/season-8/?pidp=ranking_nav&pid=list_overall&search%5Bsex%5D=W'
    };
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchWithRetry(url, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`   🔍 Attempt ${attempt}/${maxRetries}`);
        const response = await axios.get(url, this.axiosConfig);
        if (response.status === 200 && response.data) {
          console.log(`   ✅ Success - ${response.data.length} characters`);
          return response.data;
        }
        throw new Error(`HTTP ${response.status}`);
      } catch (error) {
        console.log(`   ❌ Attempt ${attempt} failed: ${error.message}`);
        if (attempt === maxRetries) {
          throw error;
        }
        await this.sleep(1000 * attempt);
      }
    }
  }

  parseAthletes(html) {
    const $ = cheerio.load(html);
    const athletes = [];
    
    const athleteLinks = $('a[href*="content=detail"][href*="idp="]');
    console.log(`   Found ${athleteLinks.length} potential athlete links`);
    
    athleteLinks.each((index, link) => {
      const $link = $(link);
      const href = $link.attr('href');
      const name = $link.text().trim();
      
      if (href && name) {
        const idMatch = href.match(/idp=([^&]+)/);
        if (idMatch && name.length > 0) {
          const skipItems = ['Race Results', 'Start List', 'Qualifying Slots'];
          if (!skipItems.includes(name)) {
            const fullUrl = href.startsWith('http') ? href : `https://results.hyrox.com/season-8/${href}`;
            athletes.push({
              name: name,
              id: idMatch[1],
              url: fullUrl
            });
            console.log(`   ✅ Found athlete: "${name}"`);
          }
        }
      }
    });
    
    return athletes;
  }

  parseAthleteResults(html, name) {
    const $ = cheerio.load(html);
    const athlete = { 
      name: name, 
      data: {},
      lastUpdated: new Date().toISOString()
    };

    console.log(`   📊 Parsing results for: ${name}`);
    
    const workoutTables = $('table.table.table-condensed');
    console.log(`   Found ${workoutTables.length} tables`);
    
    workoutTables.each((tableIndex, table) => {
      const $table = $(table);
      const headers = $table.find('thead tr th').map((i, th) => $(th).text().trim()).get();
      console.log(`     Table ${tableIndex + 1} headers: ${headers.join(', ')}`);
      
      if (headers.includes('Split') && headers.includes('Time')) {
        console.log(`     ✅ Found workout results table`);
        
        const rows = $table.find('tbody tr');
        console.log(`     Found ${rows.length} data rows`);
        
        rows.each((rowIndex, row) => {
          const $row = $(row);
          const eventCell = $row.find('th.desc');
          
          const timeCells = $row.find('td[class*="f-time_"]');
          const placeCell = $row.find('td').last();
          
          if (eventCell.length) {
            const event = eventCell.text().trim();
            const placeText = placeCell.length ? placeCell.text().trim() : '';
            
            console.log(`       Row ${rowIndex + 1}: Event="${event}"`);
            console.log(`       Found ${timeCells.length} time cells with f-time_ classes`);
            
            let timeText = '';
            let timeCell = null;
            
            if (timeCells.length > 0) {
              timeCell = timeCells.first();
              timeText = timeCell.text().trim();
              console.log(`       Using f-time_ cell: "${timeText}"`);
            } else {
              timeCell = $row.find('td').first();
              timeText = timeCell ? timeCell.text().trim() : '';
              console.log(`       Fallback to first td: "${timeText}"`);
            }
            
            console.log(`       Final: Event="${event}", Time="${timeText}", Place="${placeText}"`);
            
            if (event && timeText && timeText.includes(':') && !timeText.includes('–')) {
              const place = placeText.includes('–') ? '' : placeText;
              
              console.log(`       🔢 About to convert time: "${timeText}"`);
              const seconds = this.timeToSeconds(timeText);
              console.log(`       🔢 Conversion result: ${seconds}s`);
              
              athlete.data[event] = {
                time: timeText,
                place: place,
                seconds: seconds
              };
              console.log(`       ✅ SAVED: ${event} = ${timeText} (${seconds}s, place: ${place || 'N/A'})`);
            } else {
              console.log(`       ❌ SKIPPED: Invalid data - Event="${event}", Time="${timeText}"`);
              
              const allCells = $row.find('td');
              console.log(`       DEBUG: Row has ${allCells.length} total cells:`);
              allCells.each((cellIndex, cell) => {
                const cellClass = $(cell).attr('class') || 'no-class';
                const cellText = $(cell).text().trim();
                console.log(`         Cell ${cellIndex + 1}: class="${cellClass}", text="${cellText}"`);
              });
            }
          } else {
            console.log(`       ⚠️ Row ${rowIndex + 1}: No event cell found`);
          }
        });
        return false;
      } else {
        console.log(`     ❌ Table ${tableIndex + 1}: Wrong headers, skipping`);
      }
    });
    
    console.log(`   🎯 Final result for ${name}: ${Object.keys(athlete.data).length} events parsed`);
    if (Object.keys(athlete.data).length > 0) {
      console.log(`   📋 Events found: ${Object.keys(athlete.data).join(', ')}`);
    }
    
    return athlete;
  }

  timeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') return 0;
    const cleanTime = timeStr.replace(/[^\d:]/g, '');
    const parts = cleanTime.split(':');
    if (parts.length === 2) {
      return parseInt(parts[0]) * 60 + parseInt(parts[1]);
    }
    return 0;
  }

  async scrapeAthletes(baseUrl, maxAthletes = 10) {
    console.log(`🕷️ Starting HYROX scrape from: ${baseUrl}`);
    
    try {
      const mainHtml = await this.fetchWithRetry(baseUrl);
      const athleteList = this.parseAthletes(mainHtml);
      
      if (athleteList.length === 0) {
        throw new Error('No athletes found');
      }
      
      console.log(`   🎯 Found ${athleteList.length} athletes, will scrape ${Math.min(maxAthletes, athleteList.length)}`);
      
      const toScrape = athleteList.slice(0, maxAthletes);
      const scrapedData = [];
      
      for (let i = 0; i < toScrape.length; i++) {
        const athlete = toScrape[i];
        console.log(`   🏃 Processing: ${athlete.name} (${i + 1}/${toScrape.length})`);
        
        try {
          const athleteHtml = await this.fetchWithRetry(athlete.url);
          const athleteData = this.parseAthleteResults(athleteHtml, athlete.name);
          
          if (Object.keys(athleteData.data).length > 0) {
            scrapedData.push(athleteData);
            console.log(`   ✅ Success: ${athlete.name}`);
          }
        } catch (error) {
          console.log(`   ❌ Failed: ${athlete.name} - ${error.message}`);
        }
        
        if (i < toScrape.length - 1) {
          await this.sleep(SCRAPING_CONFIG.delayMs);
        }
      }
      
      console.log(`🎯 Scraping completed: ${scrapedData.length} athletes`);
      return scrapedData;
    } catch (error) {
      console.error(`❌ Scraping failed: ${error.message}`);
      return [];
    }
  }

  async scrapeByCategory(category = 'all', maxAthletes = 10) {
    let url;
    switch (category.toLowerCase()) {
      case 'men': url = this.baseUrls.menAthletes; break;
      case 'women': url = this.baseUrls.womenAthletes; break;
      default: url = this.baseUrls.allAthletes;
    }
    return await this.scrapeAthletes(url, maxAthletes);
  }
}

async function performPeriodicScrape() {
  if (!SCRAPING_CONFIG.enabled) {
    console.log('⏸️ Scraping is disabled');
    return;
  }

  console.log('🚀 Starting periodic HYROX scrape...');
  const scraper = new HyroxScraper();
  
  try {
    const scrapedData = await scraper.scrapeAthletes(SCRAPING_CONFIG.baseUrls[0], SCRAPING_CONFIG.maxAthletes);
    
    if (scrapedData.length > 0) {
      const newAthletes = transformScrapedData(scrapedData);
      
      let updated = 0, added = 0;
      newAthletes.forEach(newAthlete => {
        const existingIndex = athletes.findIndex(a => a.name === newAthlete.name);
        if (existingIndex >= 0) {
          athletes[existingIndex] = { ...athletes[existingIndex], ...newAthlete };
          updated++;
        } else {
          athletes.push(newAthlete);
          added++;
        }
      });
      
      console.log(`✅ Updated: ${updated}, Added: ${added}, Total: ${athletes.length}`);
    }
  } catch (error) {
    console.error(`❌ Scraping failed: ${error.message}`);
  }
}

if (SCRAPING_CONFIG.enabled) {
  cron.schedule('0 */6 * * *', performPeriodicScrape);
  console.log('⏰ Scheduled scraping every 6 hours');
}

app.get('/', (req, res) => {
  res.json({
    message: 'HYROX Simulator Backend API',
    version: '2.0.0',
    features: ['Live Data Scraping', 'Athlete Management'],
    status: 'running',
    scraping: { enabled: SCRAPING_CONFIG.enabled }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    athletes_count: athletes.length,
    scraping_enabled: SCRAPING_CONFIG.enabled
  });
});

app.get('/api/athletes', (req, res) => {
  try {
    const { category, year, limit } = req.query;
    let filteredAthletes = [...athletes];
    
    if (category && category !== 'all') {
      filteredAthletes = filteredAthletes.filter(a => 
        a.category.toLowerCase().includes(category.toLowerCase())
      );
    }
    
    if (limit) {
      filteredAthletes = filteredAthletes.slice(0, parseInt(limit));
    }
    
    res.json(filteredAthletes);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/scrape', async (req, res) => {
  try {
    const { category = 'all', maxAthletes } = req.body;
    const limit = maxAthletes || SCRAPING_CONFIG.maxAthletes;
    
    console.log(`🎯 Manual scrape triggered: ${category}, limit: ${limit}`);
    
    const scraper = new HyroxScraper();
    const scrapedData = await scraper.scrapeByCategory(category, limit);
    
    if (scrapedData.length > 0) {
      const newAthletes = transformScrapedData(scrapedData);
      
      let updated = 0, added = 0;
      newAthletes.forEach(newAthlete => {
        const existingIndex = athletes.findIndex(a => a.name === newAthlete.name);
        if (existingIndex >= 0) {
          athletes[existingIndex] = { ...athletes[existingIndex], ...newAthlete };
          updated++;
        } else {
          athletes.push(newAthlete);
          added++;
        }
      });
      
      res.json({ 
        success: true, 
        message: `Scraping completed for ${category}`,
        scraped: scrapedData.length,
        updated, added,
        total_athletes: athletes.length
      });
    } else {
      res.json({ 
        success: false, 
        message: 'No data scraped',
        total_athletes: athletes.length
      });
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/scrape/status', (req, res) => {
  res.json({
    enabled: SCRAPING_CONFIG.enabled,
    config: SCRAPING_CONFIG,
    last_update: athletes[0]?.lastUpdated || 'Never',
    total_athletes: athletes.length
  });
});

app.get('/api/athletes/:id', (req, res) => {
  try {
    const { id } = req.params;
    const athlete = athletes.find(a => a.id === parseInt(id));
    if (!athlete) {
      return res.status(404).json({ error: 'Athlete not found' });
    }
    res.json(athlete);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Enhanced Hyrox Simulator Backend running on port ${PORT}`);
  console.log(`📊 Serving ${athletes.length} athletes`);
  console.log(`🕷️ Scraping: ${SCRAPING_CONFIG.enabled ? 'ENABLED' : 'DISABLED'}`);
  
  if (SCRAPING_CONFIG.enabled) {
    setTimeout(performPeriodicScrape, 5000);
  }
});

module.exports = app;