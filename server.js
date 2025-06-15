// server.js
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: ['https://hysimulator.vercel.app', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Static athlete data
const athletes = [
  {
    id: 1,
    name: 'Hunter McIntyre',
    category: 'men',
    total_time: 3420,
    events: [
      { name: '1km Run', duration: 180, color: '#feed00', order_index: 0 },
      { name: '1000m SkiErg', duration: 195, color: '#feed00', order_index: 1 },
      { name: '1km Run', duration: 185, color: '#feed00', order_index: 2 },
      { name: '50m Sled Push', duration: 75, color: '#feed00', order_index: 3 },
      { name: '1km Run', duration: 190, color: '#feed00', order_index: 4 },
      { name: '50m Sled Pull', duration: 85, color: '#feed00', order_index: 5 },
      { name: '1km Run', duration: 188, color: '#feed00', order_index: 6 },
      { name: '80m Burpee Broad Jumps', duration: 210, color: '#feed00', order_index: 7 },
      { name: '1km Run', duration: 192, color: '#feed00', order_index: 8 },
      { name: '100m Rowing', duration: 195, color: '#feed00', order_index: 9 },
      { name: '1km Run', duration: 190, color: '#feed00', order_index: 10 },
      { name: '200m Farmers Carry', duration: 180, color: '#feed00', order_index: 11 },
      { name: '1km Run', duration: 195, color: '#feed00', order_index: 12 },
      { name: '100m Sandbag Lunges', duration: 240, color: '#feed00', order_index: 13 },
      { name: '1km Run', duration: 200, color: '#feed00', order_index: 14 },
      { name: '100 Wall Balls', duration: 510, color: '#feed00', order_index: 15 }
    ]
  },
  {
    id: 2,
    name: 'Lauren Weeks',
    category: 'women',
    total_time: 3840,
    events: [
      { name: '1km Run', duration: 210, color: '#feed00', order_index: 0 },
      { name: '1000m SkiErg', duration: 195, color: '#feed00', order_index: 1 },
      { name: '1km Run', duration: 215, color: '#feed00', order_index: 2 },
      { name: '50m Sled Push', duration: 95, color: '#feed00', order_index: 3 },
      { name: '1km Run', duration: 220, color: '#feed00', order_index: 4 },
      { name: '50m Sled Pull', duration: 105, color: '#feed00', order_index: 5 },
      { name: '1km Run', duration: 218, color: '#feed00', order_index: 6 },
      { name: '80m Burpee Broad Jumps', duration: 280, color: '#feed00', order_index: 7 },
      { name: '1km Run', duration: 222, color: '#feed00', order_index: 8 },
      { name: '100m Rowing', duration: 225, color: '#feed00', order_index: 9 },
      { name: '1km Run', duration: 220, color: '#feed00', order_index: 10 },
      { name: '200m Farmers Carry', duration: 210, color: '#feed00', order_index: 11 },
      { name: '1km Run', duration: 225, color: '#feed00', order_index: 12 },
      { name: '100m Sandbag Lunges', duration: 300, color: '#feed00', order_index: 13 },
      { name: '1km Run', duration: 230, color: '#feed00', order_index: 14 },
      { name: '75 Wall Balls', duration: 420, color: '#feed00', order_index: 15 }
    ]
  },
  {
    id: 3,
    name: 'Kris Rugloski',
    category: 'men',
    total_time: 3600,
    events: [
      { name: '1km Run', duration: 190, color: '#feed00', order_index: 0 },
      { name: '1000m SkiErg', duration: 200, color: '#feed00', order_index: 1 },
      { name: '1km Run', duration: 195, color: '#feed00', order_index: 2 },
      { name: '50m Sled Push', duration: 80, color: '#feed00', order_index: 3 },
      { name: '1km Run', duration: 200, color: '#feed00', order_index: 4 },
      { name: '50m Sled Pull', duration: 90, color: '#feed00', order_index: 5 },
      { name: '1km Run', duration: 198, color: '#feed00', order_index: 6 },
      { name: '80m Burpee Broad Jumps', duration: 230, color: '#feed00', order_index: 7 },
      { name: '1km Run', duration: 202, color: '#feed00', order_index: 8 },
      { name: '100m Rowing', duration: 205, color: '#feed00', order_index: 9 },
      { name: '1km Run', duration: 200, color: '#feed00', order_index: 10 },
      { name: '200m Farmers Carry', duration: 190, color: '#feed00', order_index: 11 },
      { name: '1km Run', duration: 205, color: '#feed00', order_index: 12 },
      { name: '100m Sandbag Lunges', duration: 260, color: '#feed00', order_index: 13 },
      { name: '1km Run', duration: 210, color: '#feed00', order_index: 14 },
      { name: '100 Wall Balls', duration: 545, color: '#feed00', order_index: 15 }
    ]
  }
];

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    message: 'Hyrox Simulator Backend is running'
  });
});

// Get all athletes
app.get('/api/athletes', (req, res) => {
  res.json(athletes);
});

// Get athlete by ID
app.get('/api/athletes/:id', (req, res) => {
  const { id } = req.params;
  const athlete = athletes.find(a => a.id === parseInt(id));
  
  if (!athlete) {
    return res.status(404).json({ error: 'Athlete not found' });
  }
  
  res.json(athlete);
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Hyrox Simulator Backend running on port ${PORT}`);
  console.log(`📊 Serving ${athletes.length} athletes`);
});

module.exports = app;