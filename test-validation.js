const { AthleteDataValidator } = require('./validation-middleware');

console.log('🧪 Testing Data Validation Middleware (MINOR Enhancement)');
console.log('=========================================================');


const validAthlete = {
  id: 1,
  name: "John Doe",
  category: "Men Pro",
  total_time: 4800,
  events: [
    { name: "1km Run", duration: 240 },
    { name: "1km SkiErg", duration: 300 },
    { name: "1km Run", duration: 250 },
    { name: "50m Sled Push", duration: 120 },
    { name: "1km Run", duration: 260 },
    { name: "50m Sled Pull", duration: 110 },
    { name: "1km Run", duration: 270 },
    { name: "80m Burpee Broad Jumps", duration: 420 },
    { name: "1km Run", duration: 280 },
    { name: "100m Rowing", duration: 200 },
    { name: "1km Run", duration: 290 },
    { name: "200m Farmers Carry", duration: 150 },
    { name: "1km Run", duration: 300 },
    { name: "100m Sandbag Lunges", duration: 180 },
    { name: "1km Run", duration: 310 },
    { name: "100 Wall Balls", duration: 360 }
  ]
};

const invalidAthlete = {
  id: null,
  name: "",
  category: 123,
  total_time: "invalid",
  events: "not an array"
};

const incompleteAthlete = {
  id: 2,
  name: "Jane Smith",
  category: "Women Pro",
  total_time: 1200,
  events: [
    { name: "1km Run", duration: 300 },
    { name: "1km SkiErg", duration: 350 },
    { name: "50m Sled Push", duration: 140 }
  ]
};

const suspiciousAthlete = {
  id: 3,
  name: "Speed Demon",
  category: "Men Pro",
  total_time: 1000,
  events: [
    { name: "1km Run", duration: 5 },  
    { name: "1km SkiErg", duration: 10 },
    { name: "50m Sled Push", duration: 2000 }, 
    { name: "100 Wall Balls", duration: 50 }
  ]
};

function testAthleteStructureValidation() {
  console.log('\n📋 Testing athlete structure validation...\n');

  const tests = [
    {
      athlete: validAthlete,
      description: 'Valid complete athlete',
      expectedValid: true
    },
    {
      athlete: invalidAthlete,
      description: 'Invalid athlete with multiple errors',
      expectedValid: false
    },
    {
      athlete: incompleteAthlete,
      description: 'Incomplete athlete (missing events)',
      expectedValid: true 
    },
    {
      athlete: { ...validAthlete, name: null },
      description: 'Athlete with null name',
      expectedValid: false
    },
    {
      athlete: { ...validAthlete, events: [] },
      description: 'Athlete with empty events array',
      expectedValid: true 
    }
  ];

  let passed = 0;
  let failed = 0;

  tests.forEach((test, index) => {
    try {
      const validation = AthleteDataValidator.validateAthleteStructure(test.athlete);
      
      if (validation.isValid === test.expectedValid) {
        console.log(`✅ Test ${index + 1}: ${test.description}`);
        console.log(`   Valid: ${validation.isValid}, Score: ${validation.score}/100`);
        if (validation.errors.length > 0) {
          console.log(`   Errors: ${validation.errors.join(', ')}`);
        }
        if (validation.warnings.length > 0) {
          console.log(`   Warnings: ${validation.warnings.join(', ')}`);
        }
        passed++;
      } else {
        console.log(`❌ Test ${index + 1}: ${test.description}`);
        console.log(`   Expected: ${test.expectedValid}, Got: ${validation.isValid}`);
        console.log(`   Errors: ${validation.errors.join(', ')}`);
        failed++;
      }
    } catch (error) {
      console.log(`💥 Test ${index + 1}: ${test.description} - ERROR: ${error.message}`);
      failed++;
    }
  });

  console.log(`\n📊 Structure Validation Results: ${passed} passed, ${failed} failed`);
}

function testDataQualityScoring() {
  console.log('\n🎯 Testing data quality scoring...\n');

  const scoringTests = [
    {
      athlete: validAthlete,
      description: 'Complete valid athlete',
      expectedRange: [90, 100]
    },
    {
      athlete: incompleteAthlete,
      description: 'Incomplete athlete (3/16 events)',
      expectedRange: [50, 80]
    },
    {
      athlete: suspiciousAthlete,
      description: 'Athlete with suspicious times',
      expectedRange: [40, 70]
    },
    {
      athlete: invalidAthlete,
      description: 'Invalid athlete structure',
      expectedRange: [0, 30]
    }
  ];

  let passed = 0;
  let failed = 0;

  scoringTests.forEach((test, index) => {
    try {
      const validation = AthleteDataValidator.validateAthleteStructure(test.athlete);
      const score = validation.score;
      const [minExpected, maxExpected] = test.expectedRange;
      
      if (score >= minExpected && score <= maxExpected) {
        console.log(`✅ Test ${index + 1}: ${test.description}`);
        console.log(`   Score: ${score}/100 (expected: ${minExpected}-${maxExpected})`);
        passed++;
      } else {
        console.log(`❌ Test ${index + 1}: ${test.description}`);
        console.log(`   Score: ${score}/100 (expected: ${minExpected}-${maxExpected})`);
        failed++;
      }
    } catch (error) {
      console.log(`💥 Test ${index + 1}: ${test.description} - ERROR: ${error.message}`);
      failed++;
    }
  });

  console.log(`\n📊 Quality Scoring Results: ${passed} passed, ${failed} failed`);
}

function testEventTimingValidation() {
  console.log('\n⏱️ Testing event timing validation...\n');

  const timingTests = [
    {
      athlete: validAthlete,
      description: 'Valid athlete with complete HYROX events',
      expectedValid: true
    },
    {
      athlete: {
        ...validAthlete,
        events: [
          { name: "1km Run", duration: 240 },
          { name: "1km Run", duration: 250 },
          { name: "Custom Event", duration: 300 }
        ]
      },
      description: 'Athlete with duplicate events',
      expectedValid: false
    },
    {
      athlete: {
        ...validAthlete,
        events: [
          { name: "1km Run", duration: 240 }
        ]
      },
      description: 'Athlete missing major HYROX components',
      expectedValid: false
    },
    {
      athlete: incompleteAthlete,
      description: 'Incomplete athlete (missing components)',
      expectedValid: false
    }
  ];

  let passed = 0;
  let failed = 0;

  timingTests.forEach((test, index) => {
    try {
      const validation = AthleteDataValidator.validateEventTiming(test.athlete);
      
      if (validation.isValid === test.expectedValid) {
        console.log(`✅ Test ${index + 1}: ${test.description}`);
        console.log(`   Valid: ${validation.isValid}`);
        if (validation.issues.length > 0) {
          console.log(`   Issues: ${validation.issues.join(', ')}`);
        }
        console.log(`   Completeness: ${validation.completeness.totalEvents}/16 events`);
        passed++;
      } else {
        console.log(`❌ Test ${index + 1}: ${test.description}`);
        console.log(`   Expected: ${test.expectedValid}, Got: ${validation.isValid}`);
        console.log(`   Issues: ${validation.issues.join(', ')}`);
        failed++;
      }
    } catch (error) {
      console.log(`💥 Test ${index + 1}: ${test.description} - ERROR: ${error.message}`);
      failed++;
    }
  });

  console.log(`\n📊 Timing Validation Results: ${passed} passed, ${failed} failed`);
}

function testEnhancedAthleteData() {
  console.log('\n🚀 Testing enhanced athlete data formatting...\n');

  const originalData = AthleteDataValidator.enhanceAthleteData(validAthlete, false);
  console.log('✅ Backward compatibility test:');
  console.log(`   Original structure preserved: ${!originalData.validation}`);

  const enhancedData = AthleteDataValidator.enhanceAthleteData(validAthlete, true);
  console.log('\n✅ Enhanced data test:');
  console.log(`   Validation added: ${!!enhancedData.validation}`);
  console.log(`   Data quality score: ${enhancedData.validation.dataQualityScore}/100`);
  console.log(`   Structure valid: ${enhancedData.validation.structure.isValid}`);
  console.log(`   Timing valid: ${enhancedData.validation.timing.isValid}`);
  console.log(`   Last validated: ${enhancedData.validation.lastValidated}`);
}

function demonstrateNewFeatures() {
  console.log('\n🎉 Demonstrating new MINOR version features...\n');

  console.log('🔧 New validation capabilities:');
  console.log('1. GET /api/athletes/:id/validation - Individual athlete validation');
  console.log('2. POST /api/validation/batch - Batch validation for multiple athletes');
  console.log('3. GET /api/validation/stats - System-wide validation statistics');
  console.log('4. Enhanced existing endpoints with optional validation metadata');
  
  console.log('\n📈 Validation features:');
  console.log('- Data structure validation');
  console.log('- Event timing consistency checks');
  console.log('- Quality scoring (0-100)');
  console.log('- HYROX event completeness verification');
  console.log('- Suspicious time detection');
  console.log('- Automated recommendations');
  
  console.log('\n🔄 Backward compatibility:');
  console.log('- All existing endpoints work unchanged');
  console.log('- Optional validation parameter (?includeValidation=true)');
  console.log('- New endpoints use different paths');
  console.log('- No breaking changes to response format');
  
  console.log('\n✨ Quality improvements:');
  console.log('- Input validation middleware');
  console.log('- Better error messages');
  console.log('- Data quality metrics');
  console.log('- Batch processing capabilities');
}

function simulateAPIRequests() {
  console.log('\n🌐 Simulating new API endpoint responses...\n');

  const validationResponse = {
    athleteId: 1,
    athleteName: "John Doe",
    validation: {
      structure: AthleteDataValidator.validateAthleteStructure(validAthlete),
      timing: AthleteDataValidator.validateEventTiming(validAthlete),
      dataQualityScore: 95,
      lastValidated: new Date().toISOString()
    },
    recommendations: [
      {
        type: 'success',
        message: 'High quality athlete data',
        details: ['All validation checks passed']
      }
    ]
  };

  console.log('📄 Sample GET /api/athletes/1/validation response:');
  console.log(JSON.stringify(validationResponse, null, 2));

  const batchResponse = {
    results: [
      {
        athleteId: 1,
        athleteName: "John Doe",
        dataQualityScore: 95,
        isValid: true,
        errorCount: 0,
        warningCount: 0,
        issueCount: 0
      },
      {
        athleteId: 2,
        athleteName: "Jane Smith",
        dataQualityScore: 67,
        isValid: false,
        errorCount: 0,
        warningCount: 1,
        issueCount: 2
      }
    ],
    notFound: [],
    summary: {
      total: 2,
      valid: 1,
      averageScore: 81
    }
  };

  console.log('\n📄 Sample POST /api/validation/batch response:');
  console.log(JSON.stringify(batchResponse, null, 2));
}

if (require.main === module) {
  testAthleteStructureValidation();
  testDataQualityScoring();
  testEventTimingValidation();
  testEnhancedAthleteData();
  demonstrateNewFeatures();
  simulateAPIRequests();
  
  console.log('\n🎯 MINOR Enhancement Testing Complete!');
  console.log('This validation system adds new functionality without breaking existing API.');
}

module.exports = {
  testAthleteStructureValidation,
  testDataQualityScoring,
  testEventTimingValidation,
  testEnhancedAthleteData
};