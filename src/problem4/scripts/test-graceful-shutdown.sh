#!/bin/bash

# Test script for graceful shutdown functionality
# This script helps verify zero-downtime deployment locally

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
API_URL="${API_URL:-http://localhost:3000}"
API_PREFIX="${API_PREFIX:-/api/v1}"
TEST_DURATION="${TEST_DURATION:-30}"
REQUEST_INTERVAL="${REQUEST_INTERVAL:-0.1}"

# Counters
SUCCESS_COUNT=0
FAILURE_COUNT=0
TOTAL_COUNT=0

echo -e "${GREEN}Zero-Downtime Deployment Test Script${NC}"
echo "======================================"
echo "API URL: $API_URL"
echo "Test Duration: ${TEST_DURATION}s"
echo "Request Interval: ${REQUEST_INTERVAL}s"
echo ""

# Function to make API request
make_request() {
    local start_time=$(date +%s%N)
    local response
    local status_code
    
    # Make request and capture status code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/health" 2>/dev/null)
    local end_time=$(date +%s%N)
    
    # Calculate duration in milliseconds
    local duration=$(( (end_time - start_time) / 1000000 ))
    
    if [ "$status_code" = "200" ]; then
        ((SUCCESS_COUNT++))
        echo -e "[$(date '+%H:%M:%S.%3N')] ${GREEN}✓${NC} Health check OK (${duration}ms)"
    else
        ((FAILURE_COUNT++))
        echo -e "[$(date '+%H:%M:%S.%3N')] ${RED}✗${NC} Health check failed - Status: $status_code (${duration}ms)"
    fi
    
    ((TOTAL_COUNT++))
}

# Function to test long-running request
test_long_request() {
    echo -e "\n${YELLOW}Testing long-running request handling...${NC}"
    
    # Create a resource (this simulates a longer operation)
    local response=$(curl -s -X POST "$API_URL$API_PREFIX/resources" \
        -H "Content-Type: application/json" \
        -d '{
            "name": "Test Resource for Shutdown",
            "type": "test",
            "description": "Testing graceful shutdown"
        }' 2>/dev/null)
    
    echo "Created test resource"
}

# Function to monitor server metrics
monitor_metrics() {
    echo -e "\n${YELLOW}Server Metrics:${NC}"
    local metrics=$(curl -s "$API_URL/metrics" 2>/dev/null)
    
    if [ -n "$metrics" ]; then
        echo "$metrics" | jq -r '
            "Active Requests: \(.requests.active)",
            "Server Ready: \(.server.isReady)",
            "Shutting Down: \(.server.isShuttingDown)",
            "Process Uptime: \(.process.uptime)s",
            "Memory Usage: \(.process.memory.heapUsed / 1024 / 1024 | floor)MB"
        ' 2>/dev/null || echo "$metrics"
    else
        echo "Unable to fetch metrics"
    fi
}

# Function to simulate deployment
simulate_deployment() {
    echo -e "\n${YELLOW}Simulating deployment (sending SIGTERM)...${NC}"
    
    # Find the server process
    local pid=$(lsof -ti:3000 2>/dev/null | head -1)
    
    if [ -n "$pid" ]; then
        echo "Found server process: PID $pid"
        echo "Sending SIGTERM signal..."
        kill -TERM "$pid"
        
        # Monitor shutdown
        local shutdown_start=$(date +%s)
        while kill -0 "$pid" 2>/dev/null; do
            echo -e "[$(date '+%H:%M:%S')] Process $pid still running..."
            sleep 1
            
            # Check timeout
            local elapsed=$(($(date +%s) - shutdown_start))
            if [ $elapsed -gt 60 ]; then
                echo -e "${RED}Shutdown timeout exceeded!${NC}"
                break
            fi
        done
        
        local shutdown_duration=$(($(date +%s) - shutdown_start))
        echo -e "${GREEN}Process terminated after ${shutdown_duration}s${NC}"
    else
        echo -e "${RED}No server process found on port 3000${NC}"
    fi
}

# Main test loop
run_continuous_test() {
    echo -e "\n${GREEN}Starting continuous health checks...${NC}"
    echo "Press Ctrl+C to stop"
    echo ""
    
    local start_time=$(date +%s)
    local last_metrics_time=$start_time
    
    trap 'show_summary' EXIT
    
    while true; do
        make_request
        
        # Show metrics every 5 seconds
        local current_time=$(date +%s)
        if [ $((current_time - last_metrics_time)) -ge 5 ]; then
            monitor_metrics
            last_metrics_time=$current_time
        fi
        
        # Check if we've reached test duration
        if [ $((current_time - start_time)) -ge $TEST_DURATION ]; then
            echo -e "\n${YELLOW}Test duration reached${NC}"
            break
        fi
        
        sleep "$REQUEST_INTERVAL"
    done
}

# Function to show test summary
show_summary() {
    echo -e "\n${YELLOW}Test Summary${NC}"
    echo "============="
    echo "Total Requests: $TOTAL_COUNT"
    echo -e "Successful: ${GREEN}$SUCCESS_COUNT${NC}"
    echo -e "Failed: ${RED}$FAILURE_COUNT${NC}"
    
    if [ $TOTAL_COUNT -gt 0 ]; then
        local success_rate=$(( (SUCCESS_COUNT * 100) / TOTAL_COUNT ))
        echo "Success Rate: ${success_rate}%"
        
        if [ $success_rate -eq 100 ]; then
            echo -e "\n${GREEN}✓ Zero-downtime achieved!${NC}"
        else
            echo -e "\n${RED}✗ Downtime detected${NC}"
        fi
    fi
}

# Menu
show_menu() {
    echo -e "\n${YELLOW}Select test option:${NC}"
    echo "1. Run continuous health checks"
    echo "2. Test graceful shutdown"
    echo "3. Test with simulated load"
    echo "4. Monitor server metrics"
    echo "5. Exit"
    echo ""
    read -p "Enter option (1-5): " option
    
    case $option in
        1)
            run_continuous_test
            ;;
        2)
            # Start continuous test in background
            run_continuous_test &
            TEST_PID=$!
            
            # Wait a bit then simulate deployment
            sleep 5
            simulate_deployment
            
            # Wait for test to complete
            wait $TEST_PID
            ;;
        3)
            echo -e "\n${YELLOW}Starting load test...${NC}"
            # Run multiple concurrent requests
            for i in {1..10}; do
                (
                    while true; do
                        curl -s "$API_URL$API_PREFIX/resources" > /dev/null
                        sleep 0.5
                    done
                ) &
            done
            
            echo "Started 10 concurrent request loops"
            echo "Press Enter to stop..."
            read
            
            # Kill all background jobs
            jobs -p | xargs kill 2>/dev/null
            ;;
        4)
            while true; do
                clear
                monitor_metrics
                sleep 2
            done
            ;;
        5)
            exit 0
            ;;
        *)
            echo -e "${RED}Invalid option${NC}"
            ;;
    esac
}

# Check if server is running
check_server() {
    if ! curl -s "$API_URL/health" > /dev/null 2>&1; then
        echo -e "${RED}Error: Server is not running at $API_URL${NC}"
        echo "Please start the server first:"
        echo "  npm run build && npm start"
        exit 1
    fi
}

# Main execution
main() {
    check_server
    
    if [ "$1" = "--continuous" ]; then
        run_continuous_test
    elif [ "$1" = "--shutdown" ]; then
        run_continuous_test &
        TEST_PID=$!
        sleep 5
        simulate_deployment
        wait $TEST_PID
    else
        while true; do
            show_menu
        done
    fi
}

# Run main function
main "$@"
