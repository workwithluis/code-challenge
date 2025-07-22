/**
 * Three unique implementations of sum_to_n function
 * Each calculates the sum of integers from 1 to n
 */

/**
 * Implementation 1: Iterative Approach
 * Uses a simple for loop to accumulate the sum
 * 
 * Time Complexity: O(n) - loops through n iterations
 * Space Complexity: O(1) - uses constant extra space
 * 
 * Pros: 
 * - Simple and straightforward to understand
 * - Works for all positive integers
 * - No risk of stack overflow
 * 
 * Cons:
 * - Slower for large values of n compared to mathematical approach
 * - Requires n iterations
 */
function sum_to_n_a(n: number): number {
    let sum = 0;
    for (let i = 1; i <= n; i++) {
        sum += i;
    }
    return sum;
}

/**
 * Implementation 2: Mathematical Formula (Gauss's Formula)
 * Uses the arithmetic series formula: n * (n + 1) / 2
 * 
 * Time Complexity: O(1) - constant time, just one calculation
 * Space Complexity: O(1) - uses constant extra space
 * 
 * Pros:
 * - Extremely fast, regardless of input size
 * - Most efficient approach
 * - No loops or recursion needed
 * 
 * Cons:
 * - Less intuitive for those unfamiliar with the formula
 * - Potential for integer overflow with very large n (though still within MAX_SAFE_INTEGER as per requirements)
 */
function sum_to_n_b(n: number): number {
    // Handle negative numbers by returning 0
    if (n <= 0) {
        return 0;
    }
    return (n * (n + 1)) / 2;
}

/**
 * Implementation 3: Recursive Approach
 * Uses recursion to calculate the sum by breaking down the problem
 * 
 * Time Complexity: O(n) - makes n recursive calls
 * Space Complexity: O(n) - uses O(n) space on the call stack
 * 
 * Pros:
 * - Elegant and functional programming style
 * - Demonstrates recursive problem-solving
 * - Easy to understand the mathematical relationship
 * 
 * Cons:
 * - Risk of stack overflow for very large n
 * - Uses more memory due to call stack
 * - Slower than iterative due to function call overhead
 */
function sum_to_n_c(n: number): number {
    // Base case: if n is 0 or negative, return 0
    if (n <= 0) {
        return 0;
    }
    // Recursive case: n + sum of all numbers from 1 to (n-1)
    return n + sum_to_n_c(n - 1);
}

// Test cases to verify all implementations
function runTests(): void {
    const testCases = [0, 1, 5, 10, 100, 1000];
    
    console.log("Testing all three implementations:");
    console.log("==================================");
    
    for (const n of testCases) {
        const resultA = sum_to_n_a(n);
        const resultB = sum_to_n_b(n);
        const resultC = sum_to_n_c(n);
        
        console.log(`n = ${n}:`);
        console.log(`  Iterative (a): ${resultA}`);
        console.log(`  Mathematical (b): ${resultB}`);
        console.log(`  Recursive (c): ${resultC}`);
        console.log(`  All match: ${resultA === resultB && resultB === resultC}`);
        console.log();
    }
}

// Export the functions
export { sum_to_n_a, sum_to_n_b, sum_to_n_c };

// Uncomment to run tests
// runTests();
