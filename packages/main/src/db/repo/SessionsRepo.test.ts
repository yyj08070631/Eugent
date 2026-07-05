import { describe, it, expect, beforeEach } from 'vitest';
import { openDb } from '../connect.js';
import { SessionsRepo } from './SessionsRepo.js';

describe('SessionsRepo', () => {
  let repo: SessionsRepo;
  beforeEach(() => {
    repo = new SessionsRepo(openDb(':memory:'));
  });

  it('creates and lists a session', () => {
    const s = repo.create('第一次对话', 1000);
    expect(s.id).toMatch(/[0-9a-f-]{36}/);
    expect(s.title).toBe('第一次对话');
    expect(s.createdAt).toBe(1000);
    expect(repo.list()).toHaveLength(1);
  });

  it('lists sessions sorted by updatedAt DESC', () => {
    repo.create('A', 1000);
    repo.create('B', 2000);
    repo.create('C', 1500);
    const list = repo.list();
    expect(list.map((s) => s.title)).toEqual(['B', 'C', 'A']);
  });

  it('renames and bumps updatedAt', () => {
    const s = repo.create('old', 1000);
    repo.rename(s.id, 'new', 5000);
    const found = repo.list().find((x) => x.id === s.id)!;
    expect(found.title).toBe('new');
    expect(found.updatedAt).toBe(5000);
  });

  it('deletes a session', () => {
    const s = repo.create('gone', 1000);
    repo.delete(s.id);
    expect(repo.list()).toHaveLength(0);
  });

  it('touch bumps updatedAt only', () => {
    const s = repo.create('t', 1000);
    repo.touch(s.id, 9000);
    const found = repo.list()[0]!;
    expect(found.updatedAt).toBe(9000);
    expect(found.title).toBe('t');
  });
});
