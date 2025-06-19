const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const DatabaseManager = require('./database-integration');
const app = express();
const PORT = process.env.PORT || 10000;
const db = new DatabaseManager();

app.use(cors({
  origin: [
    'http://localhost:3000',
    'https://hysimulator.vercel.app',
    'https://www.hysimulator.com',
    'https://hysimulator.com',
    /\.vercel\.app$/,
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.options('*', cors());
app.use(express.json());

const SCRAPING_CONFIG = {
  enabled: true,
  timeout: 30000,
  delayMs: 2000,
  maxAthletes: 20,
  baseUrls: [
    'https://results.hyrox.com/season-8/?pidp=ranking_nav&pid=list_overall'
  ]
};

let athletes = [];

const workoutTemplates = [
  {
    id: 'beginner',
    name: 'Beginner Template',
    description: 'A beginner-friendly HYROX simulation',
    total_time: 5400, // 90 minutes
    events: [
      { name: '1km Run', duration: 360, color: '#feed00' },
      { name: '1km SkiErg', duration: 300, color: '#feed00' },
      { name: '1km Run', duration: 360, color: '#feed00' },
      { name: '50m Sled Push', duration: 180, color: '#feed00' },
      { name: '1km Run', duration: 360, color: '#feed00' },
      { name: '50m Sled Pull', duration: 150, color: '#feed00' },
      { name: '1km Run', duration: 360, color: '#feed00' },
      { name: '80m Burpee Broad Jumps', duration: 420, color: '#feed00' }
    ]
  }
];

function transformScrapedData(scrapedData) {
  return scrapedData.map((athlete, index) => {
    const events = [];
    let totalTime = 0;
    let splitTime = 0;
    
    const hyroxEventOrder = [
      { scraped: 'Running 1', standard: '1km Run' },
      { scraped: '1000m SkiErg', standard: '1km SkiErg' },
      { scraped: 'Running 2', standard: '1km Run' },
      { scraped: '50m Sled Push', standard: '50m Sled Push' },
      { scraped: 'Running 3', standard: '1km Run' },
      { scraped: '50m Sled Pull', standard: '50m Sled Pull' },
      { scraped: 'Running 4', standard: '1km Run' },
      { scraped: '80m Burpee Broad Jump', standard: '80m Burpee Broad Jumps' },
      { scraped: 'Running 5', standard: '1km Run' },
      { scraped: '1000m Row', standard: '100m Rowing' },
      { scraped: 'Running 6', standard: '1km Run' },
      { scraped: '200m Farmers Carry', standard: '200m Farmers Carry' },
      { scraped: 'Running 7', standard: '1km Run' },
      { scraped: '100m Sandbag Lunges', standard: '100m Sandbag Lunges' },
      { scraped: 'Running 8', standard: '1km Run' },
      { scraped: 'Wall Balls', standard: '100 Wall Balls' }
    ];
    
    hyroxEventOrder.forEach((eventMapping, eventIndex) => {
      const eventData = athlete.data[eventMapping.scraped];
      
      if (eventData && eventData.seconds > 0) {
        splitTime += eventData.seconds;
        events.push({
          name: eventMapping.standard,
          duration: eventData.seconds,
          color: '#feed00',
          order_index: eventIndex + 1,
          split_time: splitTime
        });
        totalTime += eventData.seconds;
      }
    });
    
    let category = 'Mixed';
    const athleteName = athlete.name.toLowerCase();
    
    if (athleteName.includes('women') || athleteName.includes('female') || athleteName.includes('(w)')) {
      category = 'Women Pro';
    } else if (athleteName.includes('men') || athleteName.includes('male') || athleteName.includes('(m)')) {
      category = 'Men Pro';
    } else {
      category = 'Mixed';
    }
    
    console.log(`🔄 Transformed ${athlete.name}: ${events.length} events in correct HYROX order, total: ${totalTime}s`);
    
    return {
      id: athletes.length + index + 1,
      name: athlete.name,
      category: category,
      total_time: totalTime,
      ranking: index + 1,
      year: 2024,
      location: 'HYROX Results',
      events: events
    };
  });
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
    
    if (parts.length === 3) {
      const hours = parseInt(parts[0]) || 0;
      const minutes = parseInt(parts[1]) || 0;
      const seconds = parseInt(parts[2]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      const minutes = parseInt(parts[0]) || 0;
      const seconds = parseInt(parts[1]) || 0;
      return minutes * 60 + seconds;
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

  console.log('🚀 Starting monthly HYROX scrape...');
  const scraper = new HyroxScraper();
  
  try {
    const scrapedData = await scraper.scrapeAthletes(SCRAPING_CONFIG.baseUrls[0], SCRAPING_CONFIG.maxAthletes);
    
    if (scrapedData.length > 0) {
      const newAthletes = transformScrapedData(scrapedData);
      
      await db.saveAthletes(newAthletes);
      
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
  cron.schedule('0 0 1 * *', performPeriodicScrape);
  console.log('⏰ Scheduled scraping monthly (1st day of each month)');
}

async function initializeFromDatabase() {
  try {
    console.log('🔄 Loading initial data from database...');

    await db.ready;
    
    const dbAthletes = await db.loadAthletes();
    
    if (dbAthletes.length > 0) {
      athletes.splice(0, athletes.length, ...dbAthletes);
      console.log(`✅ Loaded ${athletes.length} athletes from database`);
    } else {
      console.log('📝 No athletes in database, using hardcoded data');
    }
  } catch (error) {
    console.error('❌ Failed to load from database:', error);
    console.log('📝 Using hardcoded athlete data');
  }
}

app.get('/', (req, res) => {
  res.json({
    message: 'HYROX Simulator Backend API',
    version: '2.0.0',
    features: ['Live Data Scraping', 'Athlete Management', 'Database Storage'],
    status: 'running',
    scraping: { enabled: SCRAPING_CONFIG.enabled }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Hyrox Simulator Backend is running',
    version: '2.0.0',
    athletes_count: athletes.length,
    scraping_enabled: SCRAPING_CONFIG.enabled
  });
});

app.get('/api/athletes', async (req, res) => {
  try {
    const { category, year, limit } = req.query;
    
    if (athletes.length === 0) {
      console.log('🔄 Loading athletes from database...');
      const dbAthletes = await db.loadAthletes();
      athletes.splice(0, athletes.length, ...dbAthletes);
    }
    
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
    console.error('Error serving athletes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
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
    console.error('Error serving athlete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/leaderboard', (req, res) => {
  const { category = 'all', limit = 10 } = req.query;
  
  let leaderboard = athletes;
  
  if (category !== 'all') {
    leaderboard = leaderboard.filter(a => 
      a.category.toLowerCase().includes(category.toLowerCase())
    );
  }
  
  leaderboard = leaderboard
    .sort((a, b) => a.total_time - b.total_time)
    .slice(0, parseInt(limit))
    .map((athlete, index) => ({
      ...athlete,
      position: index + 1
    }));
  
  res.json(leaderboard);
});

app.get('/api/templates', (req, res) => {
  res.json(workoutTemplates);
});

app.get('/api/stats/events', (req, res) => {
  const eventStats = {};
  
  athletes.forEach(athlete => {
    athlete.events.forEach(event => {
      if (!eventStats[event.name]) {
        eventStats[event.name] = {
          name: event.name,
          times: [],
          count: 0
        };
      }
      eventStats[event.name].times.push(event.duration);
      eventStats[event.name].count++;
    });
  });

  Object.keys(eventStats).forEach(eventName => {
    const times = eventStats[eventName].times;
    eventStats[eventName].average = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
    eventStats[eventName].fastest = Math.min(...times);
    eventStats[eventName].slowest = Math.max(...times);
  });
  
  res.json(eventStats);
});

app.get('/api/stats/database', async (req, res) => {
  try {
    const stats = await db.getStats();
    res.json({
      database: stats,
      memory: {
        total_athletes: athletes.length,
        last_loaded: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
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
      
      const dbResult = await db.saveAthletes(newAthletes);
      
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
        database: dbResult,
        memory: { updated, added },
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
    console.error('Manual scrape error:', error);
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

let userSessions = [];

app.post('/api/sessions', (req, res) => {
  const { userId, athleteId, eventIndex, timeRemaining, totalElapsed } = req.body;
  
  const sessionIndex = userSessions.findIndex(s => s.userId === userId);
  const sessionData = {
    userId,
    athleteId,
    eventIndex,
    timeRemaining,
    totalElapsed,
    lastUpdated: new Date().toISOString()
  };
  
  if (sessionIndex >= 0) {
    userSessions[sessionIndex] = sessionData;
  } else {
    userSessions.push(sessionData);
  }
  
  res.json({ success: true, session: sessionData });
});

app.get('/api/sessions/:userId', (req, res) => {
  const { userId } = req.params;
  const session = userSessions.find(s => s.userId === userId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }
  
  res.json(session);
});

app.get('/api/docs', (req, res) => {
  res.json({
    title: 'HYROX Simulator API',
    version: '2.0.0',
    endpoints: {
      'GET /': 'API info',
      'GET /health': 'Health check',
      'GET /api/athletes': 'Get all athletes (supports ?category= and ?year= filters)',
      'GET /api/athletes/:id': 'Get specific athlete',
      'GET /api/leaderboard': 'Get leaderboard (supports ?category= and ?limit= params)',
      'GET /api/templates': 'Get workout templates',
      'GET /api/stats/events': 'Get event statistics',
      'GET /api/stats/database': 'Get database statistics',
      'POST /api/scrape': 'Manual scrape trigger',
      'GET /api/scrape/status': 'Get scraping status',
      'POST /api/sessions': 'Create/update user session',
      'GET /api/sessions/:userId': 'Get user session',
      'GET /api/docs': 'This documentation'
    }
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 Enhanced Hyrox Simulator Backend running on port ${PORT}`);
  console.log(`🕷️ Scraping: ${SCRAPING_CONFIG.enabled ? 'ENABLED' : 'DISABLED'}`);

  await initializeFromDatabase();
  console.log(`📊 Serving ${athletes.length} athletes`);
  
  if (SCRAPING_CONFIG.enabled) {
    setTimeout(performPeriodicScrape, 5000);
  }
});

module.exports = app;
