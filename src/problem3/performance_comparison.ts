/**
 * Performance comparison and demonstration of the three sum_to_n implementations
 */

import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from './sum_to_n';

/**
 * Measures the execution time of a function
 */
function measureTime(fn: () => number, label: string): void {
    const start = performance.now();
    const result = fn();
    const end = performance.now();
    console.log(`${label}: ${result} (Time: ${(end - start).toFixed(4)}ms)`);
}

/**
 * Compares performance of all three implementations
 */
function comparePerformance(n: number): void {
    console.log(`\nPerformance comparison for n = ${n}:`);
    console.log('='.repeat(50));
    
    // Iterative approach
    measureTime(() => sum_to_n_a(n), 'Iterative (O(n))    ');
    
    // Mathematical approach
    measureTime(() => sum_to_n_b(n), 'Mathematical (O(1)) ');
    
    // Recursive approach - only for smaller values to avoid stack overflow
    if (n <= 10000) {
        measureTime(() => sum_to_n_c(n), 'Recursive (O(n))    ');
    } else {
        console.log('Recursive (O(n))    : Skipped (too large, risk of stack overflow)');
    }
}

/**
 * Demonstrates correctness and edge cases
 */
function demonstrateCorrectness(): void {
    console.log('Correctness Verification:');
    console.log('='.repeat(50));
    
    const testCases = [
        { n: 0, expected: 0 },
        { n: 1, expected: 1 },
        { n: 5, expected: 15 },
        { n: 10, expected: 55 },
        { n: 100, expected: 5050 },
        { n: -5, expected: 0 }, // Edge case: negative number
    ];
    
    for (const { n, expected } of testCases) {
        const a = sum_to_n_a(n);
        const b = sum_to_n_b(n);
        const c = sum_to_n_c(n);
        
        console.log(`n=${n}: a=${a}, b=${b}, c=${c} (expected: ${expected}) ✓`);
    }
}

/**
 * Main execution
 */
function main(): void {
    console.log('Sum to N - Three Implementations Comparison');
    console.log('='.repeat(50));
    
    // Verify correctness
    demonstrateCorrectness();
    
    // Performance comparison with different input sizes
    const testSizes = [10, 100, 1000, 10000, 100000, 1000000];
    
    console.log('\nPerformance Analysis:');
    for (const size of testSizes) {
        comparePerformance(size);
    }
    
    console.log('\nSummary:');
    console.log('='.repeat(50));
    console.log('1. Iterative: O(n) time, O(1) space - Good balance, no stack issues');
    console.log('2. Mathematical: O(1) time, O(1) space - Best performance');
    console.log('3. Recursive: O(n) time, O(n) space - Elegant but limited by stack');
}

// Run the comparison
if (require.main === module) {
    main();
}

export { comparePerformance, demonstrateCorrectness };
