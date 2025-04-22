import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Spike test configuration
export const options = {
  scenarios: {
    spike_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '5s', target: 0 },      // Initialization
        { duration: '10s', target: 50 },   // Rapid spike to 50 users
        { duration: '20s', target: 100 },  // Quick ramp up to 100 users
        { duration: '1m', target: 100 },  // Maintain high load for 1 minute
        { duration: '5s', target: 75 },   // Quick partial drop
        { duration: '15s', target: 125 },  // Second massive spike to 125 users
        { duration: '2m', target: 125 },   // Sustained heavy load for 2 minutes
        { duration: '5s', target: 0 },      // Rapid drop to 0
      ],
      gracefulRampDown: '30s',
      tags: { test_type: 'spike' },
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<1000'], // 95% of requests should be below 1000ms
    'http_req_duration{test_type:spike}': ['p(95)<1000'],
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
  // Reduce sleep time to increase request rate
  sleep(Math.random() * 0.5 + 0.1); // Random sleep between 0.1-0.6 seconds
}