import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Stress test configuration
export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 100 },   // Ramp up to 100 users over 1 minute
        { duration: '2m', target: 100 },   // Stay at 100 users for 2 minutes
        { duration: '1m', target: 150 },   // Ramp up to 150 users over 1 minute
        { duration: '2m', target: 150 },   // Stay at 150 users for 2 minutes
        { duration: '1m', target: 200 },   // Ramp up to 200 users over 1 minute
        { duration: '2m', target: 200 },   // Stay at 200 users for 2 minutes
        { duration: '1m', target: 0 },    // Ramp down to 0 users
      ],
      gracefulRampDown: '30s',
      tags: { test_type: 'stress' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<750'], // 95% of requests should be below 750ms
    'http_req_duration{test_type:stress}': ['p(95)<750'],
    errors: ['rate<0.1'] // Error rate should be less than 10%
  },
};

// The base function that all tests build upon
function makeRequest() {
  const url = 'http://myloadbalancer-389812607.us-west-1.elb.amazonaws.com/';
  const res = http.get(url);
  
  const checkRes = check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  // If checks fail, increase error rate
  errorRate.add(!checkRes);
  
  // Return response for potential further analysis
  return res;
}

// Default function that k6 will call
export default function() {
  const res = makeRequest();
  // Add shorter think time - simulating impatient users or high concurrency
  sleep(Math.random() * 2 + 0.5); // Random sleep between 0.5-2.5 seconds
}