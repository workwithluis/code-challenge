# Problem 3: Sum to N - Three Unique Implementations

This directory contains three different implementations of a function that calculates the sum of integers from 1 to n.

## Files

- `sum_to_n.ts` - Main file containing three implementations with detailed complexity analysis
- `simple_test.ts` - Test file to verify correctness of all implementations
- `performance_demo.ts` - Performance comparison demonstration
- `performance_comparison.ts` - Advanced performance analysis (requires Node.js environment)
- `tsconfig.json` - TypeScript configuration
- `package.json` - Node.js project configuration

## Implementations

### 1. Iterative Approach (`sum_to_n_a`)
- **Algorithm**: Uses a for loop to accumulate the sum
- **Time Complexity**: O(n)
- **Space Complexity**: O(1)
- **Best for**: General purpose use, especially when you need a straightforward implementation

### 2. Mathematical Formula (`sum_to_n_b`)
- **Algorithm**: Uses Gauss's formula: n × (n + 1) / 2
- **Time Complexity**: O(1)
- **Space Complexity**: O(1)
- **Best for**: Performance-critical applications, large values of n

### 3. Recursive Approach (`sum_to_n_c`)
- **Algorithm**: Recursively adds n to the sum of (n-1)
- **Time Complexity**: O(n)
- **Space Complexity**: O(n) due to call stack
- **Best for**: Educational purposes, functional programming style (not recommended for large n)

## How to Run and Test

### Prerequisites
- Node.js (version 14 or higher)
- npm (comes with Node.js)

### Step-by-Step Instructions

1. **Navigate to the problem3 directory**:
   ```bash
   cd src/problem3
   ```

2. **Install dependencies** (if not already installed):
   ```bash
   npm install
   ```
   This will install TypeScript and Node.js type definitions.

3. **Compile the TypeScript files**:
   ```bash
   npx tsc
   ```
   This creates JavaScript files in the `dist/` directory.

4. **Run the simple test suite**:
   ```bash
   node dist/simple_test.js
   ```
   This will:
   - Test all three implementations with various inputs
   - Verify correctness including edge cases
   - Show a basic performance demonstration

5. **Run the performance comparison**:
   ```bash
   node dist/performance_demo.js
   ```
   This will:
   - Compare performance across different input sizes
   - Demonstrate the O(1) vs O(n) time complexity differences
   - Show stack overflow limitations of the recursive approach

### Quick Test Commands

If you want to run everything in one go:

```bash
# From the src/problem3 directory
npm install && npx tsc && node dist/simple_test.js
```

### Testing Individual Functions

You can also test individual functions directly:

```bash
# Test with a specific value
node -e "const {sum_to_n_a, sum_to_n_b, sum_to_n_c} = require('./dist/sum_to_n'); console.log('sum_to_n(100):', sum_to_n_a(100), sum_to_n_b(100), sum_to_n_c(100));"
```

## Example Usage in Your Code

```typescript
import { sum_to_n_a, sum_to_n_b, sum_to_n_c } from './sum_to_n';

// All three functions produce the same result
console.log(sum_to_n_a(5));  // 15 (1+2+3+4+5)
console.log(sum_to_n_b(5));  // 15
console.log(sum_to_n_c(5));  // 15

// For large numbers, mathematical approach is fastest
console.log(sum_to_n_b(1000000));  // 500000500000
```

## Performance Comparison Results

| Input Size | Iterative | Mathematical | Recursive |
|------------|-----------|--------------|-----------|
| n = 10     | 0ms       | 0ms          | 0ms       |
| n = 1,000  | 0ms       | 0ms          | 0ms       |
| n = 100,000| 1ms       | 0ms          | Skipped*  |
| n = 1,000,000| 2ms    | 0ms          | Skipped*  |

*Recursive approach causes stack overflow for large inputs

## Recommendations

1. **For production code**: Use the mathematical approach (`sum_to_n_b`) for optimal performance
2. **For readability**: Use the iterative approach (`sum_to_n_a`) if performance isn't critical
3. **For educational purposes**: The recursive approach (`sum_to_n_c`) demonstrates recursion concepts well

## Edge Cases Handled

- Negative numbers: All implementations return 0 for n ≤ 0
- Zero: Returns 0
- Large numbers: All implementations work within Number.MAX_SAFE_INTEGER limits

## Troubleshooting

If you encounter any issues:

1. **TypeScript not found**: Make sure you've run `npm install` in the problem3 directory
2. **Module not found errors**: Ensure you've compiled with `npx tsc` before running
3. **Permission errors**: You may need to use `sudo` for global installations (not recommended)

## Clean Up

To remove compiled files:
```bash
rm -rf dist/
```

To remove node_modules:
```bash
rm -rf node_modules/
