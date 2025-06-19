const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseManager {
  constructor() {
    this.dbPath = path.join(__dirname, 'athletes.db');
    this.db = null;
    this.ready = this.init();
  }

  init() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error connecting to database:', err);
          reject(err);
        } else {
          console.log('📊 Connected to SQLite database');
          this.createTables().then(resolve).catch(reject);
        }
      });
    });
  }

  createTables() {
    return new Promise((resolve, reject) => {
      this.db.serialize(() => {
        // Create athletes table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS athletes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            category TEXT NOT NULL,
            total_time INTEGER NOT NULL,
            ranking INTEGER,
            year INTEGER,
            location TEXT,
            scraped_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) {
            console.error('Error creating athletes table:', err);
            reject(err);
            return;
          }
        });

        // Create events table
        this.db.run(`
          CREATE TABLE IF NOT EXISTS events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            athlete_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            duration INTEGER NOT NULL,
            color TEXT DEFAULT '#feed00',
            order_index INTEGER NOT NULL,
            split_time INTEGER,
            FOREIGN KEY (athlete_id) REFERENCES athletes (id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            console.error('Error creating events table:', err);
            reject(err);
            return;
          }
        });

        // Create indexes
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_athletes_category ON athletes(category)`, (err) => {
          if (err) {
            console.error('Error creating athletes index:', err);
            reject(err);
            return;
          }
        });
        
        this.db.run(`CREATE INDEX IF NOT EXISTS idx_events_athlete_id ON events(athlete_id)`, (err) => {
          if (err) {
            console.error('Error creating events index:', err);
            reject(err);
            return;
          }
          console.log('✅ Database tables and indexes created successfully');
          resolve();
        });
      });
    });
  }

  // Save scraped athletes to database
  async saveAthletes(athletesArray) {
    // Wait for database to be ready
    await this.ready;
    
    return new Promise((resolve, reject) => {
      const db = this.db; // Store reference to avoid context issues
      
      db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        let saved = 0;
        let updated = 0;
        let completed = 0;
        
        athletesArray.forEach((athlete, index) => {
          // Insert or update athlete
          db.run(`
            INSERT OR REPLACE INTO athletes (name, category, total_time, ranking, year, location, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `, [athlete.name, athlete.category, athlete.total_time, athlete.ranking, athlete.year, athlete.location], 
          function(err) {
            if (err) {
              console.error('Error saving athlete:', err);
              return;
            }
            
            const athleteId = this.lastID;
            
            // Delete existing events for this athlete
            db.run('DELETE FROM events WHERE athlete_id = ?', [athleteId], (err) => {
              if (err) {
                console.error('Error deleting old events:', err);
                return;
              }
              
              // Insert new events
              let eventsInserted = 0;
              if (athlete.events && athlete.events.length > 0) {
                athlete.events.forEach((event, eventIndex) => {
                  db.run(`
                    INSERT INTO events (athlete_id, name, duration, color, order_index, split_time)
                    VALUES (?, ?, ?, ?, ?, ?)
                  `, [athleteId, event.name, event.duration, event.color || '#feed00', eventIndex + 1, event.split_time || null], (err) => {
                    if (err) {
                      console.error('Error inserting event:', err);
                    }
                    eventsInserted++;
                    
                    // Check if all events for this athlete are done
                    if (eventsInserted === athlete.events.length) {
                      completed++;
                      if (this.changes > 0) {
                        updated++;
                      } else {
                        saved++;
                      }
                      
                      // Commit when all athletes are processed
                      if (completed === athletesArray.length) {
                        db.run('COMMIT', (err) => {
                          if (err) {
                            reject(err);
                          } else {
                            console.log(`✅ Database saved: ${saved} new, ${updated} updated`);
                            resolve({ saved, updated });
                          }
                        });
                      }
                    }
                  });
                });
              } else {
                // No events to insert
                completed++;
                if (this.changes > 0) {
                  updated++;
                } else {
                  saved++;
                }
                
                // Commit when all athletes are processed
                if (completed === athletesArray.length) {
                  db.run('COMMIT', (err) => {
                    if (err) {
                      reject(err);
                    } else {
                      console.log(`✅ Database saved: ${saved} new, ${updated} updated`);
                      resolve({ saved, updated });
                    }
                  });
                }
              }
            });
          });
        });
      });
    });
  }

  // Load athletes from database
  async loadAthletes() {
    // Wait for database to be ready
    await this.ready;
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          a.id,
          a.name,
          a.category,
          a.total_time,
          a.ranking,
          a.year,
          a.location,
          e.name as event_name,
          e.duration,
          e.color,
          e.order_index,
          e.split_time
        FROM athletes a
        LEFT JOIN events e ON a.id = e.athlete_id
        ORDER BY a.id, e.order_index
      `;

      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        // Transform rows into athlete objects
        const athletesMap = new Map();
        
        rows.forEach(row => {
          if (!athletesMap.has(row.id)) {
            athletesMap.set(row.id, {
              id: row.id,
              name: row.name,
              category: row.category,
              total_time: row.total_time,
              ranking: row.ranking,
              year: row.year,
              location: row.location,
              events: []
            });
          }
          
          if (row.event_name) {
            athletesMap.get(row.id).events.push({
              name: row.event_name,
              duration: row.duration,
              color: row.color || '#feed00',
              order_index: row.order_index,
              split_time: row.split_time
            });
          }
        });

        const athletes = Array.from(athletesMap.values());
        console.log(`📊 Loaded ${athletes.length} athletes from database`);
        resolve(athletes);
      });
    });
  }

  // Get database stats
  async getStats() {
    // Wait for database to be ready
    await this.ready;
    
    return new Promise((resolve, reject) => {
      this.db.get(`
        SELECT 
          COUNT(*) as total_athletes,
          COUNT(CASE WHEN category LIKE '%Men%' OR category LIKE '%M%' THEN 1 END) as men_count,
          COUNT(CASE WHEN category LIKE '%Women%' OR category LIKE '%W%' THEN 1 END) as women_count,
          MAX(updated_at) as last_update
        FROM athletes
      `, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || { total_athletes: 0, men_count: 0, women_count: 0, last_update: null });
        }
      });
    });
  }
}

module.exports = DatabaseManager;
