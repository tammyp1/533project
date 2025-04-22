import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Load test configuration
export const options = {
  scenarios: {
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },   // Ramp up to 50 users over 1 minute
        { duration: '3m', target: 50},   // Stay at 50 users for 3 minutes
        { duration: '1m', target: 75},   // Ramp up to 75 users over 1 minute
        { duration: '3m', target: 75},   // Stay at 75 users for 3 minutes
        { duration: '1m', target: 0 },    // Ramp down to 0 users
      ],
      gracefulRampDown: '30s',
      tags: { test_type: 'load' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests should be below 500ms
    'http_req_duration{test_type:load}': ['p(95)<500'],
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
  // Add think time - normal users pause between actions
  sleep(Math.random() * 3 + 1); // Random sleep between 1-4 seconds
}