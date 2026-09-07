/**
 * Strict client-side HTML sanitizer for rendering webmail and template previews safely.
 * Strips dangerous tags (<script>, <iframe>, <embed>, <object>, <form>, <base>, <meta>)
 * and inline event attributes (e.g. onerror, onload, onclick) and javascript: URLs.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') {
    // SSR fallback: strip all HTML tags to prevent XSS during SSR
    return html.replace(/<[^>]*>/g, '');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const FORBIDDEN_TAGS = ['script', 'iframe', 'embed', 'object', 'form', 'base', 'meta', 'link', 'applet', 'style', 'svg', 'math'];

    // Remove forbidden tags
    FORBIDDEN_TAGS.forEach((tag) => {
      const elements = doc.querySelectorAll(tag);
      elements.forEach((el) => el.remove());
    });

    // Clean attributes on remaining elements
    const allElements = doc.querySelectorAll('*');
    allElements.forEach((el) => {
      const attributeNames = Array.from(el.attributes).map((attr) => attr.name);
      attributeNames.forEach((attrName) => {
        const lowerName = attrName.toLowerCase();
        // Remove all inline event handlers (on*)
        if (lowerName.startsWith('on')) {
          el.removeAttribute(attrName);
        }
        // Remove javascript:, vbscript:, or dangerous data: URIs in href, src, action, data
        if (['href', 'src', 'action', 'data', 'xlink:href'].includes(lowerName)) {
          const rawVal = el.getAttribute(attrName) || '';
          const normalizedVal = rawVal.replace(/[\x00-\x20\s]/g, '').toLowerCase();
          if (
            normalizedVal.startsWith('javascript:') ||
            normalizedVal.startsWith('vbscript:') ||
            normalizedVal.startsWith('data:text/html') ||
            normalizedVal.startsWith('data:text/javascript')
          ) {
            el.removeAttribute(attrName);
          }
        }
        // Sanitize inline style attribute against CSS exfiltration/tracking vectors
        if (lowerName === 'style') {
          const val = (el.getAttribute(attrName) || '').toLowerCase();
          if (val.includes('url(') || val.includes('expression(') || val.includes('@import') || val.includes('-moz-binding')) {
            el.removeAttribute(attrName);
          }
        }
      });
    });

    // Enforce safe <a> tags (add rel="noopener noreferrer" and validate href schemes)
    const links = doc.querySelectorAll('a');
    links.forEach((a) => {
      a.setAttribute('rel', 'noopener noreferrer');
      const href = (a.getAttribute('href') || '').trim();
      if (href) {
        const lowerHref = href.toLowerCase().replace(/[\x00-\x20\s]/g, '');
        const isAllowedScheme =
          lowerHref.startsWith('http:') ||
          lowerHref.startsWith('https:') ||
          lowerHref.startsWith('mailto:') ||
          lowerHref.startsWith('tel:') ||
          lowerHref.startsWith('/') ||
          lowerHref.startsWith('#') ||
          lowerHref.startsWith('.');

        if (!isAllowedScheme) {
          a.removeAttribute('href');
        }
      }
    });

    return doc.body.innerHTML;
  } catch {
    return html.replace(/<[^>]*>/g, '');
  }
}
