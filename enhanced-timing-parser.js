
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
      return value > 3600 ? value : value;
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

  static validateEventTime(eventName, seconds) {
    const eventLimits = {
      'Running 1': { min: 180, max: 900 },     
      'Running 2': { min: 180, max: 900 },
      'Running 3': { min: 180, max: 900 },
      'Running 4': { min: 180, max: 900 },
      'Running 5': { min: 180, max: 900 },
      'Running 6': { min: 180, max: 900 },
      'Running 7': { min: 180, max: 900 },
      'Running 8': { min: 180, max: 900 },
      '1000m SkiErg': { min: 180, max: 600 },   
      '50m Sled Push': { min: 30, max: 300 },  
      '50m Sled Pull': { min: 30, max: 300 },
      '80m Burpee Broad Jump': { min: 180, max: 900 }, 
      '1000m Row': { min: 180, max: 600 },      
      '200m Farmers Carry': { min: 60, max: 400 }, 
      '100m Sandbag Lunges': { min: 120, max: 600 }, 
      'Wall Balls': { min: 180, max: 900 }      
    };

    const limit = eventLimits[eventName];
    if (!limit) return true; 

    if (seconds < limit.min || seconds > limit.max) {
      console.warn(`Suspicious time for ${eventName}: ${seconds}s (expected: ${limit.min}-${limit.max}s)`);
      return false;
    }

    return true;
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

    if (!this.validateEventTime(eventName, seconds)) {
      console.warn(`Time validation failed for ${eventName}: ${seconds}s`);
    }

    return {
      originalText: timeStr,
      cleanedText: cleaned,
      seconds: Math.round(seconds * 100) / 100,
      isValid: this.validateEventTime(eventName, seconds)
    };
  }
}

const enhancedScraperMethods = {
  timeToSeconds(timeStr) {
    const result = ImprovedTimingParser.cleanScrapedTimeData(timeStr, 'Unknown Event');
    return result ? result.seconds : 0;
  },

  parseAthleteResultsEnhanced(html, name) {
    const $ = cheerio.load(html);
    const athlete = { 
      name: name, 
      data: {},
      lastUpdated: new Date().toISOString(),
      parsingErrors: []
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
            }
          }
        });
        return false;
      }
    });
    
    console.log(`   🎯 Enhanced parsing result for ${name}: ${Object.keys(athlete.data).length} events parsed`);
    if (athlete.parsingErrors.length > 0) {
      console.log(`   ⚠️ Parsing errors: ${athlete.parsingErrors.length}`);
    }
    
    return athlete;
  }
};

module.exports = {
  ImprovedTimingParser,
  enhancedScraperMethods
};