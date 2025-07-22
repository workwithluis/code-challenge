# Problem 3 Solution: Three Implementations of sum_to_n

## Overview
I have provided three unique implementations of a function that calculates the sum of integers from 1 to n in TypeScript, each with different algorithmic approaches and complexity characteristics.

## Implementation Details

### 1. Iterative Approach (`sum_to_n_a`)
```typescript
function sum_to_n_a(n: number): number {
    let sum = 0;
    for (let i = 1; i <= n; i++) {
        sum += i;
    }
    return sum;
}
```
- **Time Complexity**: O(n) - requires n iterations
- **Space Complexity**: O(1) - uses constant extra space
- **Characteristics**: Straightforward, no risk of stack overflow, good for general use

### 2. Mathematical Formula Approach (`sum_to_n_b`)
```typescript
function sum_to_n_b(n: number): number {
    return (n * (n + 1)) / 2;
}
```
- **Time Complexity**: O(1) - single calculation using Gauss's formula
- **Space Complexity**: O(1) - uses constant extra space
- **Characteristics**: Optimal performance, instant result regardless of input size

### 3. Recursive Approach (`sum_to_n_c`)
```typescript
function sum_to_n_c(n: number): number {
    if (n <= 0) {
        return 0;
    }
    return n + sum_to_n_c(n - 1);
}
```
- **Time Complexity**: O(n) - makes n recursive calls
- **Space Complexity**: O(n) - uses O(n) space on the call stack
- **Characteristics**: Elegant functional style, but limited by stack size for large n

## Performance Analysis

| Approach | Time Complexity | Space Complexity | Best Use Case |
|----------|----------------|------------------|---------------|
| Iterative | O(n) | O(1) | General purpose, safe for all inputs |
| Mathematical | O(1) | O(1) | Performance-critical applications |
| Recursive | O(n) | O(n) | Educational, small inputs only |

## Example Results
- `sum_to_n(5) = 15` (1 + 2 + 3 + 4 + 5)
- `sum_to_n(10) = 55`
- `sum_to_n(100) = 5050`

## Files Created
1. **sum_to_n.ts** - Main implementation file with all three functions
2. **simple_test.ts** - Test file to verify correctness
3. **performance_comparison.ts** - Performance analysis (requires Node.js environment)
4. **tsconfig.json** - TypeScript configuration
5. **README.md** - Detailed documentation

## Recommendation
For production use, the mathematical approach (`sum_to_n_b`) is recommended due to its O(1) time complexity. The iterative approach is a good alternative when code clarity is prioritized over performance. The recursive approach serves well for educational purposes but should be avoided for large inputs due to stack overflow risk.
