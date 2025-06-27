const express = require('express');
const cors = require('cors');
const cron = require('node-cron');
const axios = require('axios');
const cheerio = require('cheerio');
const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

class ImprovedTimingParser {
  static parseTimeToSeconds(timeStr) {
    if (!timeStr || typeof timeStr !== 'string') {
      console.warn('Invalid time string provided:', timeStr);
      return 0;
    }

    const cleanTime = timeStr.trim().replace(/\s+/g, ' ');
    
    const timePatterns = [
      /^(\d{1,2}):(\d{2}):(\d{2})\.(\d{1,3})$/,
      /^(\d{1,2}):(\d{2}):(\d{2})$/,
      /^(\d{1,2}):(\d{2})\.(\d{1,3})$/,
      /^(\d{1,2}):(\d{2})$/,
      /^(\d{1,3})\.(\d{1,3})$/,
      /^(\d{1,4})$/
    ];

    for (const pattern of timePatterns) {
      const match = cleanTime.match(pattern);
      if (match) {
        return this.convertMatchToSeconds(match, pattern);
      }
    }

    console.warn('Unrecognized time format, attempting fallback parsing:', timeStr);
    return this.fallbackTimeConversion(cleanTime);
  }

  static convertMatchToSeconds(match, pattern) {
    const groups = match.slice(1);
    
    if (groups.length >= 3 && groups[0] && groups[1] && groups[2]) {
      const hours = parseInt(groups[0]) || 0;
      const minutes = parseInt(groups[1]) || 0;
      const seconds = parseInt(groups[2]) || 0;
      const milliseconds = groups[3] ? this.normalizeMilliseconds(groups[3]) : 0;
      
      const totalSeconds = hours * 3600 + minutes * 60 + seconds;
      return totalSeconds + (milliseconds / 1000);
    }
    
    if (groups.length >= 2 && groups[0] && groups[1]) {
      const minutes = parseInt(groups[0]) || 0;
      const seconds = parseInt(groups[1]) || 0;
      const milliseconds = groups[2] ? this.normalizeMilliseconds(groups[2]) : 0;
      
      const totalSeconds = minutes * 60 + seconds;
      return totalSeconds + (milliseconds / 1000);
    }
    
    if (groups.length >= 1 && groups[0]) {
      const seconds = parseInt(groups[0]) || 0;
      const milliseconds = groups[1] ? this.normalizeMilliseconds(groups[1]) : 0;
      
      return seconds + (milliseconds / 1000);
    }
    
    return 0;
  }

  static normalizeMilliseconds(msStr) {
    if (!msStr) return 0;
    
    if (msStr.length === 1) return parseInt(msStr) * 100;
    if (msStr.length === 2) return parseInt(msStr) * 10;
    if (msStr.length === 3) return parseInt(msStr);
    if (msStr.length > 3) return parseInt(msStr.substring(0, 3));
    
    return 0;
  }

  static fallbackTimeConversion(timeStr) {
    const numbers = timeStr.match(/\d+/g);
    if (!numbers || numbers.length === 0) return 0;
    
    if (numbers.length === 1) {
      const value = parseInt(numbers[0]);
      return value;
    }
    
    if (numbers.length === 2) {
      const minutes = parseInt(numbers[0]) || 0;
      const seconds = parseInt(numbers[1]) || 0;
      return minutes * 60 + seconds;
    }
    
    if (numbers.length >= 3) {
      const hours = parseInt(numbers[0]) || 0;
      const minutes = parseInt(numbers[1]) || 0;
      const seconds = parseInt(numbers[2]) || 0;
      return hours * 3600 + minutes * 60 + seconds;
    }
    
    return 0;
  }

  static cleanScrapedTimeData(timeStr, eventName) {
    if (!timeStr) return null;

    let cleaned = timeStr
      .replace(/^\s*[-–—]\s*/, '')
      .replace(/\s*[-–—]\s*$/, '')
      .replace(/[^\d:.,]/g, '')
      .replace(/,/g, '.')
      .trim();

    if (!cleaned || cleaned === '.' || cleaned === ':') {
      return null;
    }

    const seconds = this.parseTimeToSeconds(cleaned);
    
    if (seconds <= 0) {
      console.warn(`Invalid parsed time for ${eventName}: "${timeStr}" -> ${seconds}s`);
      return null;
    }

    return {
      originalText: timeStr,
      cleanedText: cleaned,
      seconds: Math.round(seconds * 100) / 100,
      isValid: true
    };
  }
}

class AthleteDataValidator {
  static validateAthleteStructure(athlete) {
    const errors = [];
    const warnings = [];
    
    if (!athlete.name || typeof athlete.name !== 'string') {
      errors.push('Missing or invalid athlete name');
    }
    
    if (!athlete.id) {
      errors.push('Missing athlete ID');
    }
    
    if (!athlete.category || typeof athlete.category !== 'string') {
      warnings.push('Missing or invalid category');
    }
    
    if (!athlete.total_time || typeof athlete.total_time !== 'number') {
      errors.push('Missing or invalid total_time');
    }
    
    if (!Array.isArray(athlete.events)) {
      errors.push('Events must be an array');
    } else {
      athlete.events.forEach((event, index) => {
        if (!event.name) {
          errors.push(`Event ${index + 1}: Missing event name`);
        }
        if (typeof event.duration !== 'number' || event.duration <= 0) {
          errors.push(`Event ${index + 1}: Invalid duration`);
        }
      });
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      score: this.calculateDataQualityScore(athlete, errors, warnings)
    };
  }

  static calculateDataQualityScore(athlete, errors = [], warnings = []) {
    let score = 100;
    
    score -= errors.length * 25;
    score -= warnings.length * 10;
    
    if (!athlete.events || !Array.isArray(athlete.events)) {
      return Math.max(0, score);
    }
    
    const expectedEventCount = 16;
    if (athlete.events.length < expectedEventCount) {
      const missingEvents = expectedEventCount - athlete.events.length;
      score -= missingEvents * 3;
    }
    
    let suspiciousEvents = 0;
    athlete.events.forEach(event => {
      if (event.duration < 30 || event.duration > 1800) {
        suspiciousEvents++;
      }
    });
    score -= suspiciousEvents * 5;
    
    const sumOfEvents = athlete.events.reduce((sum, event) => sum + event.duration, 0);
    const totalTimeDiff = Math.abs(sumOfEvents - athlete.total_time);
    if (totalTimeDiff > 60) {
      score -= 10;
    }
    
    return Math.max(0, Math.min(100, score));
  }

  static validateEventTiming(athlete) {
    if (!athlete.events || !Array.isArray(athlete.events)) {
      return { isValid: false, issues: ['No events to validate'] };
    }

    const issues = [];
    const eventNames = new Set();
    
    athlete.events.forEach(event => {
      if (eventNames.has(event.name)) {
        issues.push(`Duplicate event: ${event.name}`);
      }
      eventNames.add(event.name);
    });
    
    const hasSkiErg = athlete.events.some(e => e.name.toLowerCase().includes('skierg'));
    const hasSledPush = athlete.events.some(e => e.name.toLowerCase().includes('sled push'));
    const hasSledPull = athlete.events.some(e => e.name.toLowerCase().includes('sled pull'));
    const hasBurpees = athlete.events.some(e => e.name.toLowerCase().includes('burpee'));
    const hasWallBalls = athlete.events.some(e => e.name.toLowerCase().includes('wall ball'));
    
    const majorComponents = [hasSkiErg, hasSledPush, hasSledPull, hasBurpees, hasWallBalls];
    const missingComponents = majorComponents.filter(comp => !comp).length;
    
    if (missingComponents > 0) {
      issues.push(`Missing ${missingComponents} major HYROX components`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      completeness: {
        totalEvents: athlete.events.length,
        expectedEvents: 16,
        hasSkiErg,
        hasSledPush,
        hasSledPull,
        hasBurpees,
        hasWallBalls
      }
    };
  }

  static enhanceAthleteData(athlete, includeValidation = false) {
    if (!includeValidation) {
      return athlete;
    }

    const structureValidation = this.validateAthleteStructure(athlete);
    const timingValidation = this.validateEventTiming(athlete);

    return {
      ...athlete,
      validation: {
        structure: structureValidation,
        timing: timingValidation,
        dataQualityScore: structureValidation.score,
        lastValidated: new Date().toISOString()
      }
    };
  }
}

const validationMiddleware = {
  validateAthleteQuery: (req, res, next) => {
    const { category, year, limit } = req.query;
    const errors = [];

    if (category && !['all', 'men', 'women', 'mixed'].includes(category.toLowerCase())) {
      errors.push('Invalid category. Must be: all, men, women, or mixed');
    }

    if (year) {
      const yearNum = parseInt(year);
      if (isNaN(yearNum) || yearNum < 2020 || yearNum > new Date().getFullYear() + 1) {
        errors.push('Invalid year. Must be between 2020 and current year + 1');
      }
    }

    if (limit) {
      const limitNum = parseInt(limit);
      if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
        errors.push('Invalid limit. Must be between 1 and 100');
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    next();
  },

  validateAthleteId: (req, res, next) => {
    const { id } = req.params;
    
    if (!id) {
      return res.status(400).json({
        error: 'Athlete ID is required'
      });
    }

    const idNum = parseInt(id);
    if (isNaN(idNum) || idNum < 1) {
      return res.status(400).json({
        error: 'Invalid athlete ID. Must be a positive integer'
      });
    }

    next();
  },

  validateSessionData: (req, res, next) => {
    const { userId, athleteId, eventIndex, timeRemaining, totalElapsed } = req.body;
    const errors = [];

    if (!userId || typeof userId !== 'string') {
      errors.push('Invalid userId. Must be a non-empty string');
    }

    if (!athleteId || isNaN(parseInt(athleteId))) {
      errors.push('Invalid athleteId. Must be a valid number');
    }

    if (eventIndex !== undefined && (isNaN(parseInt(eventIndex)) || parseInt(eventIndex) < 0)) {
      errors.push('Invalid eventIndex. Must be a non-negative number');
    }

    if (timeRemaining !== undefined && (isNaN(parseInt(timeRemaining)) || parseInt(timeRemaining) < 0)) {
      errors.push('Invalid timeRemaining. Must be a non-negative number');
    }

    if (totalElapsed !== undefined && (isNaN(parseInt(totalElapsed)) || parseInt(totalElapsed) < 0)) {
      errors.push('Invalid totalElapsed. Must be a non-negative number');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Session validation failed',
        details: errors
      });
    }

    next();
  }
};

function enhanceResponse(data, options = {}) {
  const { includeValidation = false, includeMetadata = false } = options;

  if (Array.isArray(data)) {
    const enhancedData = data.map(athlete => 
      AthleteDataValidator.enhanceAthleteData(athlete, includeValidation)
    );

    if (includeMetadata) {
      return {
        data: enhancedData,
        metadata: {
          count: enhancedData.length,
          validationIncluded: includeValidation,
          generatedAt: new Date().toISOString()
        }
      };
    }

    return enhancedData;
  } else {
    const enhancedData = AthleteDataValidator.enhanceAthleteData(data, includeValidation);

    if (includeMetadata) {
      return {
        data: enhancedData,
        metadata: {
          validationIncluded: includeValidation,
          generatedAt: new Date().toISOString()
        }
      };
    }

    return enhancedData;
  }
}

function generateRecommendations(structureValidation, timingValidation) {
  const recommendations = [];

  if (!structureValidation.isValid) {
    recommendations.push({
      type: 'error',
      message: 'Fix data structure issues',
      details: structureValidation.errors
    });
  }

  if (structureValidation.warnings.length > 0) {
    recommendations.push({
      type: 'warning',
      message: 'Address data quality warnings',
      details: structureValidation.warnings
    });
  }

  if (!timingValidation.isValid) {
    recommendations.push({
      type: 'timing',
      message: 'Review event timing data',
      details: timingValidation.issues
    });
  }

  if (structureValidation.score < 70) {
    recommendations.push({
      type: 'improvement',
      message: 'Consider re-scraping this athlete data for better quality',
      details: [`Current quality score: ${structureValidation.score}/100`]
    });
  }

  return recommendations;
}

const SCRAPING_CONFIG = {
  enabled: process.env.SCRAPING_ENABLED !== 'false',
  maxAthletes: parseInt(process.env.MAX_ATHLETES) || 20,
  timeout: 30000,
  delayMs: 2000,
  retries: 3
};

let athletes = [
  {
    id: 1,
    name: 'Hunter McIntyre',
    category: 'Men Pro',
    total_time: 3720,
    ranking: 1,
    year: 2024,
    location: 'HYROX World Championships',
    events: [
      { name: '1km Run', duration: 240, color: '#feed00' },
      { name: '1km SkiErg', duration: 300, color: '#feed00' },
      { name: '1km Run', duration: 250, color: '#feed00' },
      { name: '50m Sled Push', duration: 120, color: '#feed00' },
      { name: '1km Run', duration: 260, color: '#feed00' },
      { name: '50m Sled Pull', duration: 110, color: '#feed00' },
      { name: '1km Run', duration: 270, color: '#feed00' },
      { name: '80m Burpee Broad Jumps', duration: 420, color: '#feed00' },
      { name: '1km Run', duration: 280, color: '#feed00' },
      { name: '100m Rowing', duration: 200, color: '#feed00' },
      { name: '1km Run', duration: 290, color: '#feed00' },
      { name: '200m Farmers Carry', duration: 150, color: '#feed00' },
      { name: '1km Run', duration: 300, color: '#feed00' },
      { name: '100m Sandbag Lunges', duration: 180, color: '#feed00' },
      { name: '1km Run', duration: 310, color: '#feed00' },
      { name: '100 Wall Balls', duration: 360, color: '#feed00' }
    ]
  },
  {
    id: 2,
    name: 'Lauren Weeks',
    category: 'Women Pro',
    total_time: 4200,
    ranking: 1,
    year: 2024,
    location: 'HYROX World Championships',
    events: [
      { name: '1km Run', duration: 280, color: '#feed00' },
      { name: '1km SkiErg', duration: 320, color: '#feed00' },
      { name: '1km Run', duration: 290, color: '#feed00' },
      { name: '50m Sled Push', duration: 140, color: '#feed00' },
      { name: '1km Run', duration: 300, color: '#feed00' },
      { name: '50m Sled Pull', duration: 130, color: '#feed00' },
      { name: '1km Run', duration: 310, color: '#feed00' },
      { name: '80m Burpee Broad Jumps', duration: 460, color: '#feed00' },
      { name: '1km Run', duration: 320, color: '#feed00' },
      { name: '100m Rowing', duration: 220, color: '#feed00' },
      { name: '1km Run', duration: 330, color: '#feed00' },
      { name: '200m Farmers Carry', duration: 170, color: '#feed00' },
      { name: '1km Run', duration: 340, color: '#feed00' },
      { name: '100m Sandbag Lunges', duration: 200, color: '#feed00' },
      { name: '1km Run', duration: 350, color: '#feed00' },
      { name: '100 Wall Balls', duration: 380, color: '#feed00' }
    ]
  }
];

const workoutTemplates = [
  {
    id: 'hyrox-standard',
    name: 'Standard HYROX',
    description: 'The official HYROX competition format',
    events: [
      { name: '1km Run', duration: 300, color: '#feed00' },
      { name: '1km SkiErg', duration: 300, color: '#feed00' },
      { name: '1km Run', duration: 300, color: '#feed00' },
      { name: '50m Sled Push', duration: 120, color: '#feed00' },
      { name: '1km Run', duration: 300, color: '#feed00' },
      { name: '50m Sled Pull', duration: 120, color: '#feed00' },
      { name: '1km Run', duration: 300, color: '#feed00' },
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
      womenAthletes: 'https://results.hyrox.com/season-8/?pidp=ranking_nav&pid=list_overall&search%5Bsex%5D=F'
    };
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async fetchWithRetry(url, retries = SCRAPING_CONFIG.retries) {
    for (let i = 0; i < retries; i++) {
      try {
        console.log(`   🌐 Fetching: ${url} (attempt ${i + 1}/${retries})`);
        const response = await axios.get(url, this.axiosConfig);
        return response.data;
      } catch (error) {
        console.log(`   ❌ Attempt ${i + 1} failed: ${error.message}`);
        if (i === retries - 1) throw error;
        await this.sleep(1000 * (i + 1));
      }
    }
  }

  parseAthletes(html) {
    const $ = cheerio.load(html);
    const athletes = [];
    
    console.log('   🔍 Looking for athlete links...');
    
    $('a[href*="pid=start"]').each((index, element) => {
      const href = $(element).attr('href');
      if (href) {
        const nameElement = $(element).find('.list-field.type-fullname');
        const name = nameElement.length ? nameElement.text().trim() : $(element).text().trim();
        
        if (name && name.length > 2) {
          const idMatch = href.match(/id_athlete=(\d+)/);
          if (idMatch) {
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
      lastUpdated: new Date().toISOString(),
      parsingErrors: [],
      parsingMethod: 'enhanced'
    };

    console.log(`   📊 Parsing results for: ${name} (Enhanced Parser)`);
    
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
            
            if (event && timeText && !timeText.includes('–')) {
              const place = placeText.includes('–') ? '' : placeText;
              
              console.log(`       🔢 About to convert time with enhanced parser: "${timeText}"`);
              
              const timeData = ImprovedTimingParser.cleanScrapedTimeData(timeText, event);
              
              if (timeData && timeData.seconds > 0) {
                athlete.data[event] = {
                  time: timeData.originalText,
                  cleanedTime: timeData.cleanedText,
                  place: place,
                  seconds: timeData.seconds,
                  isValid: timeData.isValid,
                  parsingMethod: 'enhanced'
                };
                console.log(`       ✅ SAVED (Enhanced): ${event} = ${timeData.originalText} -> ${timeData.seconds}s (place: ${place || 'N/A'})`);
              } else {
                athlete.parsingErrors.push({
                  event,
                  originalTime: timeText,
                  error: 'Failed enhanced parsing'
                });
                console.log(`       ❌ FAILED (Enhanced): Could not parse time "${timeText}" for ${event}`);
              }
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
    
    console.log(`   🎯 Enhanced parsing result for ${name}: ${Object.keys(athlete.data).length} events parsed`);
    if (athlete.parsingErrors.length > 0) {
      console.log(`   ⚠️ Parsing errors: ${athlete.parsingErrors.length}`);
    }
    
    return athlete;
  }

  timeToSeconds(timeStr) {
    const result = ImprovedTimingParser.cleanScrapedTimeData(timeStr, 'Unknown Event');
    return result ? result.seconds : 0;
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
    version: '2.1.0',
    features: ['Live Data Scraping', 'Athlete Management', 'Database Storage', 'Enhanced Timing Accuracy', 'Data Validation System'],
    status: 'running',
    scraping: { enabled: SCRAPING_CONFIG.enabled }
  });
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Hyrox Simulator Backend is running',
    version: '2.1.0',
    athletes_count: athletes.length,
    scraping_enabled: SCRAPING_CONFIG.enabled,
    validation_enabled: true
  });
});

app.get('/api/athletes', validationMiddleware.validateAthleteQuery, async (req, res) => {
  try {
    const { category, year, limit, includeValidation, includeMetadata } = req.query;
    
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
    
    const enhancedData = enhanceResponse(filteredAthletes, {
      includeValidation: includeValidation === 'true',
      includeMetadata: includeMetadata === 'true'
    });
    
    res.json(enhancedData);
  } catch (error) {
    console.error('Error serving athletes:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/athletes/:id', validationMiddleware.validateAthleteId, (req, res) => {
  try {
    const { id } = req.params;
    const { includeValidation, includeMetadata } = req.query;
    const athlete = athletes.find(a => a.id === parseInt(id));
    
    if (!athlete) {
      return res.status(404).json({ error: 'Athlete not found' });
    }
    
    const enhancedData = enhanceResponse(athlete, {
      includeValidation: includeValidation === 'true',
      includeMetadata: includeMetadata === 'true'
    });
    
    res.json(enhancedData);
  } catch (error) {
    console.error('Error serving athlete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/athletes/:id/validation', validationMiddleware.validateAthleteId, (req, res) => {
  try {
    const { id } = req.params;
    const athlete = athletes.find(a => a.id === parseInt(id));
    
    if (!athlete) {
      return res.status(404).json({ error: 'Athlete not found' });
    }

    const structureValidation = AthleteDataValidator.validateAthleteStructure(athlete);
    const timingValidation = AthleteDataValidator.validateEventTiming(athlete);

    res.json({
      athleteId: athlete.id,
      athleteName: athlete.name,
      validation: {
        structure: structureValidation,
        timing: timingValidation,
        dataQualityScore: structureValidation.score,
        lastValidated: new Date().toISOString()
      },
      recommendations: generateRecommendations(structureValidation, timingValidation)
    });
  } catch (error) {
    console.error('Error validating athlete:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/validation/batch', (req, res) => {
  try {
    const { athleteIds } = req.body;
    
    if (!Array.isArray(athleteIds)) {
      return res.status(400).json({
        error: 'athleteIds must be an array'
      });
    }

    if (athleteIds.length > 50) {
      return res.status(400).json({
        error: 'Maximum 50 athletes can be validated at once'
      });
    }

    const results = [];
    const notFound = [];

    athleteIds.forEach(id => {
      const athlete = athletes.find(a => a.id === parseInt(id));
      if (!athlete) {
        notFound.push(id);
        return;
      }

      const structureValidation = AthleteDataValidator.validateAthleteStructure(athlete);
      const timingValidation = AthleteDataValidator.validateEventTiming(athlete);

      results.push({
        athleteId: athlete.id,
        athleteName: athlete.name,
        dataQualityScore: structureValidation.score,
        isValid: structureValidation.isValid && timingValidation.isValid,
        errorCount: structureValidation.errors.length,
        warningCount: structureValidation.warnings.length,
        issueCount: timingValidation.issues.length
      });
    });

    res.json({
      results,
      notFound,
      summary: {
        total: results.length,
        valid: results.filter(r => r.isValid).length,
        averageScore: results.reduce((sum, r) => sum + r.dataQualityScore, 0) / results.length || 0
      }
    });
  } catch (error) {
    console.error('Error in batch validation:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/validation/stats', (req, res) => {
  try {
    const validationStats = {
      totalAthletes: athletes.length,
      validatedAthletes: 0,
      averageQualityScore: 0,
      qualityDistribution: {
        excellent: 0,
        good: 0,
        fair: 0,
        poor: 0
      },
      commonIssues: {},
      lastUpdated: new Date().toISOString()
    };

    let totalScore = 0;
    athletes.forEach(athlete => {
      const validation = AthleteDataValidator.validateAthleteStructure(athlete);
      totalScore += validation.score;
      validationStats.validatedAthletes++;

      if (validation.score >= 90) validationStats.qualityDistribution.excellent++;
      else if (validation.score >= 70) validationStats.qualityDistribution.good++;
      else if (validation.score >= 50) validationStats.qualityDistribution.fair++;
      else validationStats.qualityDistribution.poor++;

      [...validation.errors, ...validation.warnings].forEach(issue => {
        validationStats.commonIssues[issue] = (validationStats.commonIssues[issue] || 0) + 1;
      });
    });

    validationStats.averageQualityScore = totalScore / athletes.length || 0;

    res.json(validationStats);
  } catch (error) {
    console.error('Error getting validation stats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/api/leaderboard', validationMiddleware.validateAthleteQuery, (req, res) => {
  const { category = 'all', limit = 10, includeValidation, includeMetadata } = req.query;
  
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
  
  const enhancedData = enhanceResponse(leaderboard, {
    includeValidation: includeValidation === 'true',
    includeMetadata: includeMetadata === 'true'
  });
  
  res.json(enhancedData);
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
        total_athletes: athletes.length,
        parsingMethod: 'enhanced'
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
    total_athletes: athletes.length,
    parsingMethod: 'enhanced',
    validationEnabled: true,
    version: '2.1.0'
  });
});

let userSessions = [];

app.post('/api/sessions', validationMiddleware.validateSessionData, (req, res) => {
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
    version: '2.1.0',
    changelog: {
      '2.1.0': {
        type: 'MINOR',
        changes: [
          'Added data validation system',
          'New validation endpoints: /api/athletes/:id/validation, /api/validation/batch, /api/validation/stats',
          'Enhanced existing endpoints with optional validation metadata',
          'Added input validation middleware',
          'Improved error messages and data quality scoring'
        ]
      },
      '2.0.1': {
        type: 'PATCH',
        changes: [
          'Fixed timing data parsing accuracy',
          'Enhanced time format recognition',
          'Better handling of scraped data edge cases',
          'Improved validation for event times',
          'Added parsing error tracking'
        ]
      }
    },
    endpoints: {
      'GET /': 'API info',
      'GET /health': 'Health check',
      'GET /api/athletes': 'Get all athletes (supports ?category=, ?year=, ?limit=, ?includeValidation=, ?includeMetadata=)',
      'GET /api/athletes/:id': 'Get specific athlete (supports ?includeValidation=, ?includeMetadata=)',
      'GET /api/athletes/:id/validation': 'Get detailed validation for specific athlete',
      'POST /api/validation/batch': 'Batch validate multiple athletes',
      'GET /api/validation/stats': 'Get system-wide validation statistics',
      'GET /api/leaderboard': 'Get leaderboard (supports ?category=, ?limit=, ?includeValidation=, ?includeMetadata=)',
      'GET /api/templates': 'Get workout templates',
      'GET /api/stats/events': 'Get event statistics',
      'GET /api/stats/database': 'Get database statistics',
      'POST /api/scrape': 'Manual scrape trigger (enhanced parsing)',
      'GET /api/scrape/status': 'Get scraping status (includes validation info)',
      'POST /api/sessions': 'Create/update user session (enhanced validation)',
      'GET /api/sessions/:userId': 'Get user session',
      'GET /api/docs': 'This documentation'
    },
    features: {
      validation: 'Data quality scoring, structure validation, timing consistency checks',
      parsing: 'Enhanced timing parser for better accuracy',
      compatibility: 'Full backward compatibility maintained'
    }
  });
});

app.listen(PORT, async () => {
  console.log(`🚀 Enhanced Hyrox Simulator Backend running on port ${PORT}`);
  console.log(`🕷️ Scraping: ${SCRAPING_CONFIG.enabled ? 'ENABLED' : 'DISABLED'}`);
  console.log(`🔧 Version: 2.1.0 - Enhanced timing parser + validation system active`);

  await initializeFromDatabase();
  console.log(`📊 Serving ${athletes.length} athletes`);
  
  if (SCRAPING_CONFIG.enabled) {
    setTimeout(performPeriodicScrape, 5000);
  }
});

module.exports = app;