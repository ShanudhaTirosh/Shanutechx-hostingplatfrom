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
  
  // Replace Unix timestamps (10-13 digits)
  formatted = formatted.replace(unixTimestampRegex, (match) => {
    try {
      const timestamp = parseInt(match);
      // Check if it's a reasonable timestamp (between 2000 and 2100)
      // Timestamps can be in seconds (10 digits) or milliseconds (13 digits)
      if (timestamp > 946684800 && timestamp < 4102444800000) {
        const date = new Date(timestamp > 9999999999 ? timestamp : timestamp * 1000);
        return date.toLocaleString();
      }
      return match;
    } catch {
      return match;
    }
  });
  
  return formatted;
}
