/**
 * Simple test file to verify the correctness of all three sum_to_n implementations
 * This file can be compiled and run without additional type definitions
 */

import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from './sum_to_n';

// Test data with expected results
const testCases = [
    { n: 0, expected: 0, description: "Zero input" },
    { n: 1, expected: 1, description: "Single element" },
    { n: 5, expected: 15, description: "Small positive number" },
    { n: 10, expected: 55, description: "Medium positive number" },
    { n: 100, expected: 5050, description: "Large positive number" },
    { n: -5, expected: 0, description: "Negative number" },
];

console.log("Testing Three Implementations of sum_to_n");
console.log("========================================\n");

// Test each implementation
let allTestsPassed = true;

for (const testCase of testCases) {
    const { n, expected, description } = testCase;
    
    console.log(`Test: ${description} (n = ${n})`);
    
    // Test iterative implementation
    const resultA = sum_to_n_a(n);
    const passedA = resultA === expected;
    console.log(`  Iterative:    ${resultA} ${passedA ? '✓' : '✗'}`);
    
    // Test mathematical implementation
    const resultB = sum_to_n_b(n);
    const passedB = resultB === expected;
    console.log(`  Mathematical: ${resultB} ${passedB ? '✓' : '✗'}`);
    
    // Test recursive implementation
    const resultC = sum_to_n_c(n);
    const passedC = resultC === expected;
    console.log(`  Recursive:    ${resultC} ${passedC ? '✓' : '✗'}`);
    
    if (!passedA || !passedB || !passedC) {
        allTestsPassed = false;
    }
    
    console.log();
}

// Summary
console.log("Summary");
console.log("=======");
console.log(`All tests passed: ${allTestsPassed ? 'YES ✓' : 'NO ✗'}`);

// Performance demonstration with a larger number
console.log("\nPerformance Demonstration (n = 1000):");
console.log("=====================================");

const n = 1000;
const expected = (n * (n + 1)) / 2;

// Time iterative approach
const startA = Date.now();
const resultA = sum_to_n_a(n);
const timeA = Date.now() - startA;

// Time mathematical approach
const startB = Date.now();
const resultB = sum_to_n_b(n);
const timeB = Date.now() - startB;

// Time recursive approach (careful with stack size)
try {
    const startC = Date.now();
    const resultC = sum_to_n_c(n);
    const timeC = Date.now() - startC;
    console.log(`Iterative:    ${resultA} (${timeA}ms)`);
    console.log(`Mathematical: ${resultB} (${timeB}ms)`);
    console.log(`Recursive:    ${resultC} (${timeC}ms)`);
} catch (error) {
    console.log(`Iterative:    ${resultA} (${timeA}ms)`);
    console.log(`Mathematical: ${resultB} (${timeB}ms)`);
    console.log(`Recursive:    Stack overflow - cannot handle n=${n}`);
}

console.log("\nNote: Mathematical approach is O(1) and typically fastest.");
console.log("Recursive approach may fail with stack overflow for very large n.");
