import { describe, it, expect } from 'vitest';
import { filterLogs, formatLogLine } from './logUtils';

describe('filterLogs', () => {
  const sampleLogs = `
[2024-01-15T10:30:00Z] INFO: Application started
[2024-01-15T10:30:01Z] DEBUG: Loading configuration
[2024-01-15T10:30:02Z] WARNING: High memory usage detected
[2024-01-15T10:30:03Z] ERROR: Failed to connect to database
[2024-01-15T10:30:04Z] FATAL: Critical system failure
[2024-01-15T10:30:05Z] INFO: Retrying connection
Server listening on port 3000
Request received from 192.168.1.1
`.trim();

  describe('log level filtering', () => {
    it('should return all logs when level is "all"', () => {
      const result = filterLogs(sampleLogs, 'all', '');
      expect(result).toBe(sampleLogs);
    });

    it('should filter info level logs', () => {
      const result = filterLogs(sampleLogs, 'info', '');
      expect(result).toContain('INFO: Application started');
      expect(result).toContain('DEBUG: Loading configuration');
      expect(result).toContain('INFO: Retrying connection');
      expect(result).not.toContain('WARNING');
      expect(result).not.toContain('ERROR');
    });

    it('should filter warning level logs', () => {
      const result = filterLogs(sampleLogs, 'warning', '');
      expect(result).toContain('WARNING: High memory usage detected');
      expect(result).not.toContain('INFO');
      expect(result).not.toContain('ERROR');
    });

    it('should filter error level logs', () => {
      const result = filterLogs(sampleLogs, 'error', '');
      expect(result).toContain('ERROR: Failed to connect to database');
      expect(result).toContain('FATAL: Critical system failure');
      expect(result).not.toContain('INFO');
      expect(result).not.toContain('WARNING');
    });
  });

  describe('text search filtering', () => {
    it('should filter logs by search text', () => {
      const result = filterLogs(sampleLogs, 'all', 'database');
      expect(result).toContain('Failed to connect to database');
      expect(result).not.toContain('Application started');
    });

    it('should be case insensitive', () => {
      const result = filterLogs(sampleLogs, 'all', 'DATABASE');
      expect(result).toContain('Failed to connect to database');
    });

    it('should handle empty search text', () => {
      const result = filterLogs(sampleLogs, 'all', '');
      expect(result).toBe(sampleLogs);
    });

    it('should handle whitespace-only search text', () => {
      const result = filterLogs(sampleLogs, 'all', '   ');
      expect(result).toBe(sampleLogs);
    });
  });

  describe('combined filtering', () => {
    it('should apply both log level and search text filters', () => {
      const result = filterLogs(sampleLogs, 'error', 'database');
      expect(result).toContain('ERROR: Failed to connect to database');
      expect(result).not.toContain('INFO');
      expect(result).not.toContain('WARNING');
      expect(result).not.toContain('FATAL');
    });

    it('should return empty string when no matches found', () => {
      const result = filterLogs(sampleLogs, 'error', 'nonexistent');
      expect(result).toBe('');
    });
  });

  describe('edge cases', () => {
    it('should handle empty log text', () => {
      const result = filterLogs('', 'all', '');
      expect(result).toBe('');
    });

    it('should preserve line structure', () => {
      const multiLineLogs = 'Line 1\nLine 2\nLine 3';
      const result = filterLogs(multiLineLogs, 'all', '');
      expect(result.split('\n')).toHaveLength(3);
    });
  });
});

describe('formatLogLine', () => {
  describe('ISO timestamp formatting', () => {
    it('should convert ISO timestamps to local time', () => {
      const line = '[2024-01-15T10:30:00Z] Application started';
      const result = formatLogLine(line);
      
      // Result should contain a date representation (format varies by locale)
      expect(result).not.toContain('2024-01-15T10:30:00Z');
      expect(result).toContain('Application started');
    });

    it('should handle multiple ISO timestamps in one line', () => {
      const line = 'Start: 2024-01-15T10:30:00Z End: 2024-01-15T11:30:00Z';
      const result = formatLogLine(line);
      
      expect(result).not.toContain('T10:30:00Z');
      expect(result).not.toContain('T11:30:00Z');
    });

    it('should handle ISO timestamps with milliseconds', () => {
      const line = '[2024-01-15T10:30:00.123Z] Event occurred';
      const result = formatLogLine(line);
      
      expect(result).not.toContain('T10:30:00.123Z');
      expect(result).toContain('Event occurred');
    });

    it('should handle ISO timestamps with timezone offset', () => {
      const line = '[2024-01-15T10:30:00+05:30] Event occurred';
      const result = formatLogLine(line);
      
      expect(result).not.toContain('T10:30:00+05:30');
      expect(result).toContain('Event occurred');
    });
  });

  describe('Unix timestamp formatting', () => {
    it('should convert Unix timestamps to local time', () => {
      const line = 'Timestamp: 1705315800';
      const result = formatLogLine(line);
      
      expect(result).not.toContain('1705315800');
    });

    it('should handle Unix timestamps in milliseconds', () => {
      const line = 'Timestamp: 1705315800000';
      const result = formatLogLine(line);
      
      expect(result).not.toContain('1705315800000');
    });

    it('should not convert numbers that are not timestamps', () => {
      const line = 'Port: 3000, Users: 42';
      const result = formatLogLine(line);
      
      expect(result).toContain('3000');
      expect(result).toContain('42');
    });
  });

  describe('edge cases', () => {
    it('should handle empty lines', () => {
      const result = formatLogLine('');
      expect(result).toBe('');
    });

    it('should handle lines with only whitespace', () => {
      const result = formatLogLine('   ');
      expect(result).toBe('   ');
    });

    it('should handle lines without timestamps', () => {
      const line = 'Plain log message without timestamp';
      const result = formatLogLine(line);
      expect(result).toBe(line);
    });

    it('should handle malformed timestamps gracefully', () => {
      const line = 'Invalid: 2024-99-99T99:99:99Z';
      const result = formatLogLine(line);
      // Should not throw and should return something reasonable
      expect(typeof result).toBe('string');
    });
  });
});
