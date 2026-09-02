/**
 * Log filtering and formatting utilities for deployment logs
 */

export type LogLevel = 'all' | 'info' | 'warning' | 'error';

/**
 * Filter logs based on level and search text
 */
export function filterLogs(
  logText: string,
  logLevel: LogLevel,
  searchText: string
): string {
  if (!logText) return '';
  
  const lines = logText.split('\n');
  let filtered = lines;

  // Filter by log level
  if (logLevel !== 'all') {
    filtered = filtered.filter(line => {
      const lowerLine = line.toLowerCase();
      if (logLevel === 'error') {
        return lowerLine.includes('error') || lowerLine.includes('err') || lowerLine.includes('fatal');
      } else if (logLevel === 'warning') {
        return lowerLine.includes('warn') || lowerLine.includes('warning');
      } else if (logLevel === 'info') {
        return lowerLine.includes('info') || lowerLine.includes('debug') || lowerLine.includes('log');
      }
      return true;
    });
  }

  // Filter by search text
  if (searchText.trim()) {
    const search = searchText.toLowerCase();
    filtered = filtered.filter(line => line.toLowerCase().includes(search));
  }

  return filtered.join('\n');
}

/**
 * Parse log line and convert timestamps to local time
 */
export function formatLogLine(line: string): string {
  if (!line.trim()) return line;
  
  // Try to detect and replace ISO timestamps with local time
  const isoTimestampRegex = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z|[+-]\d{2}:\d{2})/g;
  const unixTimestampRegex = /\b\d{10,13}\b/g;
  
  let formatted = line;
  
  // Replace ISO timestamps
  formatted = formatted.replace(isoTimestampRegex, (match) => {
    try {
      const date = new Date(match);
      return date.toLocaleString();
    } catch {
      return match;
    }
  });
  
  // Replace Unix timestamps (10 or 13 digits)
  formatted = formatted.replace(unixTimestampRegex, (match) => {
    try {
      const ts = parseInt(match);
      // Valid seconds timestamp: 10 digits between ~2017 (1500000000) and ~2039 (2200000000)
      const isSeconds = match.length === 10 && ts >= 1500000000 && ts <= 2200000000;
      // Valid ms timestamp: 13 digits between ~2017 (1500000000000) and ~2039 (2200000000000)
      const isMs = match.length === 13 && ts >= 1500000000000 && ts <= 2200000000000;
      if (isSeconds || isMs) {
        const date = new Date(isMs ? ts : ts * 1000);
        return date.toLocaleString();
      }
      return match;
    } catch {
      return match;
    }
  });
  
  return formatted;
}
