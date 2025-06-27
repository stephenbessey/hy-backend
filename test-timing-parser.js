const { ImprovedTimingParser } = require('./enhanced-timing-parser');

console.log('🧪 Testing Enhanced Timing Parser (PATCH Fix)');
console.log('===============================================');

const testCases = [

  { input: '4:32', expected: 272, description: 'MM:SS format' },
  { input: '0:04:32', expected: 272, description: 'HH:MM:SS format with leading zero' },
  { input: '1:05:23', expected: 3923, description: 'HH:MM:SS format over 1 hour' },
  
  { input: '4:32.5', expected: 272.5, description: 'MM:SS.d format' },
  { input: '4:32.50', expected: 272.5, description: 'MM:SS.dd format' },
  { input: '4:32.500', expected: 272.5, description: 'MM:SS.ddd format' },
  { input: '1:05:23.123', expected: 3923.123, description: 'HH:MM:SS.ddd format' },
  
  { input: '  4:32  ', expected: 272, description: 'Time with whitespace' },
  { input: '04:32', expected: 272, description: 'Leading zero in minutes' },
  { input: '4:05', expected: 245, description: 'Leading zero in seconds' },
  { input: '4:5', expected: 245, description: 'Single digit seconds' },
  
  { input: '4:32 ', expected: 272, description: 'Trailing space' },
  { input: ' 4:32', expected: 272, description: 'Leading space' },
  { input: '4:32.', expected: 272, description: 'Trailing decimal point' },
  
  { input: '45', expected: 45, description: 'Seconds only (under 60)' },
  { input: '90', expected: 90, description: 'Seconds only (over 60)' },
  { input: '45.5', expected: 45.5, description: 'Seconds with decimal' },
  
  { input: '', expected: 0, description: 'Empty string' },
  { input: null, expected: 0, description: 'Null input' },
  { input: undefined, expected: 0, description: 'Undefined input' },
  { input: '---', expected: 0, description: 'Only dashes' },
  { input: 'abc', expected: 0, description: 'Non-numeric string' },
  
  { input: '–4:32–', expected: 0, description: 'Dashes around time (invalid)' },
  { input: '4:32–', expected: 0, description: 'Trailing dash (invalid)' },
  { input: 'DNF', expected: 0, description: 'Did not finish' },
  { input: 'N/A', expected: 0, description: 'Not available' }
];

function runTests() {
  let passed = 0;
  let failed = 0;

  console.log('\n📋 Running parseTimeToSeconds tests...\n');

  testCases.forEach((test, index) => {
    try {
      const result = ImprovedTimingParser.parseTimeToSeconds(test.input);
      const success = Math.abs(result - test.expected) < 0.001;
      
      if (success) {
        console.log(`✅ Test ${index + 1}: ${test.description}`);
        console.log(`   Input: "${test.input}" -> ${result}s (expected: ${test.expected}s)`);
        passed++;
      } else {
        console.log(`❌ Test ${index + 1}: ${test.description}`);
        console.log(`   Input: "${test.input}" -> ${result}s (expected: ${test.expected}s)`);
        failed++;
      }
    } catch (error) {
      console.log(`💥 Test ${index + 1}: ${test.description} - ERROR: ${error.message}`);
      failed++;
    }
  });

  console.log('\n' + '='.repeat(50));
  console.log(`📊 Test Results: ${passed} passed, ${failed} failed`);
  console.log(`Success rate: ${Math.round((passed / (passed + failed)) * 100)}%`);
}

function testEventValidation() {
  console.log('\n🏃 Testing event time validation...\n');

  const validationTests = [
    { event: 'Running 1', time: 300, expected: true, description: '5 minute run (valid)' },
    { event: 'Running 1', time: 60, expected: false, description: '1 minute run (too fast)' },
    { event: 'Running 1', time: 1200, expected: false, description: '20 minute run (too slow)' },
    { event: '50m Sled Push', time: 120, expected: true, description: '2 minute sled push (valid)' },
    { event: '50m Sled Push', time: 15, expected: false, description: '15 second sled push (too fast)' },
    { event: 'Unknown Event', time: 5000, expected: true, description: 'Unknown event (always valid)' }
  ];

  let validationPassed = 0;
  let validationFailed = 0;

  validationTests.forEach((test, index) => {
    const result = ImprovedTimingParser.validateEventTime(test.event, test.time);
    
    if (result === test.expected) {
      console.log(`✅ Validation ${index + 1}: ${test.description}`);
      validationPassed++;
    } else {
      console.log(`❌ Validation ${index + 1}: ${test.description}`);
      console.log(`   Expected: ${test.expected}, Got: ${result}`);
      validationFailed++;
    }
  });

  console.log(`\n📊 Validation Results: ${validationPassed} passed, ${validationFailed} failed`);
}

function testCleanScrapedData() {
  console.log('\n🧹 Testing scraped data cleaning...\n');

  const cleaningTests = [
    { input: '4:32', event: 'Running 1', expectedSeconds: 272, description: 'Clean time data' },
    { input: '–4:32–', event: 'Running 1', expectedSeconds: null, description: 'Time with surrounding dashes' },
    { input: '4:32–', event: 'Running 1', expectedSeconds: null, description: 'Time with trailing dash' },
    { input: '4:32 (PB)', event: 'Running 1', expectedSeconds: 272, description: 'Time with text annotation' },
    { input: '4,32', event: 'Running 1', expectedSeconds: 272, description: 'European decimal format' },
    { input: '', event: 'Running 1', expectedSeconds: null, description: 'Empty input' }
  ];

  let cleaningPassed = 0;
  let cleaningFailed = 0;

  cleaningTests.forEach((test, index) => {
    const result = ImprovedTimingParser.cleanScrapedTimeData(test.input, test.event);
    const actualSeconds = result ? result.seconds : null;
    
    if (actualSeconds === test.expectedSeconds || 
        (actualSeconds !== null && test.expectedSeconds !== null && 
         Math.abs(actualSeconds - test.expectedSeconds) < 0.001)) {
      console.log(`✅ Cleaning ${index + 1}: ${test.description}`);
      if (result) {
        console.log(`   "${test.input}" -> "${result.cleanedText}" -> ${result.seconds}s`);
      }
      cleaningPassed++;
    } else {
      console.log(`❌ Cleaning ${index + 1}: ${test.description}`);
      console.log(`   Expected: ${test.expectedSeconds}, Got: ${actualSeconds}`);
      cleaningFailed++;
    }
  });

  console.log(`\n📊 Cleaning Results: ${cleaningPassed} passed, ${cleaningFailed} failed`);
}

function demonstrateImprovement() {
  console.log('\n🚀 Demonstrating improvements over original parser...\n');

  function originalTimeToSeconds(timeStr) {
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

  const comparisonTests = [
    '4:32.5',
    '  4:32  ',  
    '4:32 (PB)', 
    'DNF',        
    '4,32',      
  ];

  comparisonTests.forEach(input => {
    const originalResult = originalTimeToSeconds(input);
    const enhancedResult = ImprovedTimingParser.parseTimeToSeconds(input);
    
    console.log(`Input: "${input}"`);
    console.log(`  Original: ${originalResult}s`);
    console.log(`  Enhanced: ${enhancedResult}s`);
    
    if (originalResult !== enhancedResult) {
      console.log(`  📈 IMPROVED!`);
    } else {
      console.log(`  ➡️ Same result`);
    }
    console.log('');
  });
}

if (require.main === module) {
  runTests();
  testEventValidation();
  testCleanScrapedData();
  demonstrateImprovement();
  
  console.log('\n🎯 PATCH Fix Testing Complete!');
  console.log('This enhanced parser should resolve timing accuracy issues.');
}

module.exports = {
  runTests,
  testEventValidation,
  testCleanScrapedData
};