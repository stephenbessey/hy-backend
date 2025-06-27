const express = require('express');

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

    const expectedSequence = [
      '1km Run', '1km SkiErg', '1km Run', '50m Sled Push',
      '1km Run', '50m Sled Pull', '1km Run', '80m Burpee Broad Jumps',
      '1km Run', '100m Rowing', '1km Run', '200m Farmers Carry',
      '1km Run', '100m Sandbag Lunges', '1km Run', '100 Wall Balls'
    ];

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


const validationRoutes = (app, athletes) => {

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
};


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

module.exports = {
  AthleteDataValidator,
  validationMiddleware,
  validationRoutes,
  enhanceResponse
};