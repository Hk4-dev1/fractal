// Test decimal parsing issues
import { parseUnits } from 'viem';

function testDecimals() {
  console.log('Testing decimal parsing...');
  
  // Test cases that might cause issues
  const testCases = [
    { value: '0.01', decimals: 18 },
    { value: '39.100339', decimals: 6 },
    { value: '38.904837', decimals: 6 },
    { value: '0.1', decimals: 18 },
    { value: '100', decimals: 6 }
  ];
  
  testCases.forEach(({ value, decimals }) => {
    try {
  const result = parseUnits(value, decimals);
      console.log(`✅ ${value} (${decimals} decimals) = ${result.toString()}`);
    } catch (error) {
      console.log(`❌ ${value} (${decimals} decimals) = ${error.message}`);
    }
  });
}

testDecimals();
