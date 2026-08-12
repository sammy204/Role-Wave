import test from 'node:test';
import assert from 'node:assert/strict';

import { getPaginatedJobs } from '../lib/pagination';

test('paginates jobs into chunks of 10', () => {
  const jobs = Array.from({ length: 25 }, (_, index) => ({ id: index + 1 }));

  const pageOne = getPaginatedJobs(jobs, 1);
  const pageTwo = getPaginatedJobs(jobs, 2);
  const pageThree = getPaginatedJobs(jobs, 3);

  assert.equal(pageOne.items.length, 10);
  assert.deepEqual(pageOne.items.map((job) => job.id), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.deepEqual(pageTwo.items.map((job) => job.id), [11, 12, 13, 14, 15, 16, 17, 18, 19, 20]);
  assert.deepEqual(pageThree.items.map((job) => job.id), [21, 22, 23, 24, 25]);
  assert.equal(pageThree.totalPages, 3);
});

test('keeps page number within valid range', () => {
  const jobs = Array.from({ length: 12 }, (_, index) => ({ id: index + 1 }));

  const pageSix = getPaginatedJobs(jobs, 6);

  assert.deepEqual(pageSix.items.map((job) => job.id), [11, 12]);
  assert.equal(pageSix.totalPages, 2);
  assert.equal(pageSix.currentPage, 2);
});
