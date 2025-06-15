const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors({
  origin: [
    'http://localhost:3000',
    'hysimulator.vercel.app',
    /\.vercel\.app$/,
  ],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
  credentials: true
}));

app.options('*', cors());

app.use(express.json());

const athletes = [
  {
    id: 1,
    name: 'Hunter McIntyre',
    category: 'Men Pro',
    total_time: 3792,
    ranking: 1,
    year: 2024,
    location: 'World Championships',
    events: [
      { name: '1km Run', duration: 185, color: '#feed00', order_index: 1, split_time: 185 },
      { name: '1km SkiErg', duration: 215, color: '#feed00', order_index: 2, split_time: 400 },
      { name: '1km Run', duration: 192, color: '#feed00', order_index: 3, split_time: 592 },
      { name: '50m Sled Push', duration: 88, color: '#feed00', order_index: 4, split_time: 680 },
      { name: '1km Run', duration: 200, color: '#feed00', order_index: 5, split_time: 880 },
      { name: '50m Sled Pull', duration: 90, color: '#feed00', order_index: 6, split_time: 970 },
      { name: '1km Run', duration: 198, color: '#feed00', order_index: 7, split_time: 1168 },
      { name: '80m Burpee Broad Jumps', duration: 230, color: '#feed00', order_index: 8, split_time: 1398 },
      { name: '1km Run', duration: 202, color: '#feed00', order_index: 9, split_time: 1600 },
      { name: '100m Rowing', duration: 205, color: '#feed00', order_index: 10, split_time: 1805 },
      { name: '1km Run', duration: 200, color: '#feed00', order_index: 11, split_time: 2005 },
      { name: '200m Farmers Carry', duration: 190, color: '#feed00', order_index: 12, split_time: 2195 },
      { name: '1km Run', duration: 205, color: '#feed00', order_index: 13, split_time: 2400 },
      { name: '100m Sandbag Lunges', duration: 260, color: '#feed00', order_index: 14, split_time: 2660 },
      { name: '1km Run', duration: 210, color: '#feed00', order_index: 15, split_time: 2870 },
      { name: '100 Wall Balls', duration: 545, color: '#feed00', order_index: 16, split_time: 3415 }
    ]
  },
  {
    id: 2,
    name: 'Lauren Weeks',
    category: 'Women Pro',
    total_time: 4245,
    ranking: 1,
    year: 2024,
    location: 'World Championships',
    events: [
      { name: '1km Run', duration: 210, color: '#feed00', order_index: 1, split_time: 210 },
      { name: '1km SkiErg', duration: 240, color: '#feed00', order_index: 2, split_time: 450 },
      { name: '1km Run', duration: 218, color: '#feed00', order_index: 3, split_time: 668 },
      { name: '50m Sled Push', duration: 105, color: '#feed00', order_index: 4, split_time: 773 },
      { name: '1km Run', duration: 225, color: '#feed00', order_index: 5, split_time: 998 },
      { name: '50m Sled Pull', duration: 110, color: '#feed00', order_index: 6, split_time: 1108 },
      { name: '1km Run', duration: 220, color: '#feed00', order_index: 7, split_time: 1328 },
      { name: '80m Burpee Broad Jumps', duration: 280, color: '#feed00', order_index: 8, split_time: 1608 },
      { name: '1km Run', duration: 228, color: '#feed00', order_index: 9, split_time: 1836 },
      { name: '100m Rowing', duration: 235, color: '#feed00', order_index: 10, split_time: 2071 },
      { name: '1km Run', duration: 230, color: '#feed00', order_index: 11, split_time: 2301 },
      { name: '200m Farmers Carry', duration: 220, color: '#feed00', order_index: 12, split_time: 2521 },
      { name: '1km Run', duration: 235, color: '#feed00', order_index: 13, split_time: 2756 },
      { name: '100m Sandbag Lunges', duration: 310, color: '#feed00', order_index: 14, split_time: 3066 },
      { name: '1km Run', duration: 240, color: '#feed00', order_index: 15, split_time: 3306 },
      { name: '100 Wall Balls', duration: 620, color: '#feed00', order_index: 16, split_time: 3926 }
    ]
  },
  {
    id: 3,
    name: 'Jake Dearden',
    category: 'Men Pro',
    total_time: 3850,
    ranking: 2,
    year: 2024,
    location: 'World Championships',
    events: [
      { name: '1km Run', duration: 190, color: '#feed00', order_index: 1, split_time: 190 },
      { name: '1km SkiErg', duration: 220, color: '#feed00', order_index: 2, split_time: 410 },
      { name: '1km Run', duration: 195, color: '#feed00', order_index: 3, split_time: 605 },
      { name: '50m Sled Push', duration: 92, color: '#feed00', order_index: 4, split_time: 697 },
      { name: '1km Run', duration: 205, color: '#feed00', order_index: 5, split_time: 902 },
      { name: '50m Sled Pull', duration: 95, color: '#feed00', order_index: 6, split_time: 997 },
      { name: '1km Run', duration: 202, color: '#feed00', order_index: 7, split_time: 1199 },
      { name: '80m Burpee Broad Jumps', duration: 240, color: '#feed00', order_index: 8, split_time: 1439 },
      { name: '1km Run', duration: 208, color: '#feed00', order_index: 9, split_time: 1647 },
      { name: '100m Rowing', duration: 210, color: '#feed00', order_index: 10, split_time: 1857 },
      { name: '1km Run', duration: 205, color: '#feed00', order_index: 11, split_time: 2062 },
      { name: '200m Farmers Carry', duration: 195, color: '#feed00', order_index: 12, split_time: 2257 },
      { name: '1km Run', duration: 210, color: '#feed00', order_index: 13, split_time: 2467 },
      { name: '100m Sandbag Lunges', duration: 270, color: '#feed00', order_index: 14, split_time: 2737 },
      { name: '1km Run', duration: 215, color: '#feed00', order_index: 15, split_time: 2952 },
      { name: '100 Wall Balls', duration: 560, color: '#feed00', order_index: 16, split_time: 3512 }
    ]
  }
];

const workoutTemplates = [
  {
    id: 1,
    name: 'Beginner HYROX',
    description: 'Modified HYROX workout for beginners',
    difficulty: 'Beginner',
    estimated_time: 4800,
    events: [
      { name: '800m Run', duration: 240, color: '#feed00' },
      { name: '800m SkiErg', duration: 280, color: '#feed00' },
      { name: '800m Run', duration: 250, color: '#feed00' },
      { name: '25m Sled Push', duration: 120, color: '#feed00' },
      { name: '800m Run', duration: 260, color: '#feed00' },
      { name: '25m Sled Pull', duration: 130, color: '#feed00' },
      { name: '800m Run', duration: 255, color: '#feed00' },
      { name: '40m Burpee Broad Jumps', duration: 320, color: '#feed00' }
    ]
  },
  {
    id: 2,
    name: 'Intermediate HYROX',
    description: 'Standard HYROX workout with moderate pacing',
    difficulty: 'Intermediate',
    estimated_time: 4200,
    events: [
      { name: '1km Run', duration: 220, color: '#feed00' },
      { name: '1km SkiErg', duration: 250, color: '#feed00' },
      { name: '1km Run', duration: 225, color: '#feed00' },
      { name: '50m Sled Push', duration: 100, color: '#feed00' },
      { name: '1km Run', duration: 230, color: '#feed00' },
      { name: '50m Sled Pull', duration: 105, color: '#feed00' },
      { name: '1km Run', duration: 235, color: '#feed00' },
      { name: '80m Burpee Broad Jumps', duration: 300, color: '#feed00' }
    ]
  }
];

app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Hyrox Simulator Backend is running',
    version: '1.0.0',
    athletes_count: athletes.length
  });
});

app.get('/api/athletes', (req, res) => {
  try {
    console.log('Serving athletes data:', athletes.length);
    res.json(athletes);
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
      'GET /health': 'Health check',
      'GET /api/athletes': 'Get all athletes (supports ?category= and ?year= filters)',
      'GET /api/athletes/:id': 'Get specific athlete',
      'GET /api/leaderboard': 'Get leaderboard (supports ?category= and ?limit= params)',
      'GET /api/templates': 'Get workout templates',
      'GET /api/stats/events': 'Get event statistics',
      'POST /api/sessions': 'Create/update user session',
      'GET /api/sessions/:userId': 'Get user session',
      'GET /api/docs': 'This documentation'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Enhanced Hyrox Simulator Backend running on port ${PORT}`);
  console.log(`📊 Serving ${athletes.length} athletes`);
  console.log(`📚 Available endpoints: http://localhost:${PORT}/api/docs`);
});

module.exports = app;