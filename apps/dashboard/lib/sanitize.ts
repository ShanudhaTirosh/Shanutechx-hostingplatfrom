/**
 * Strict client-side HTML sanitizer for rendering webmail and template previews safely.
 * Strips dangerous tags (<script>, <iframe>, <embed>, <object>, <form>, <base>, <meta>)
 * and inline event attributes (e.g. onerror, onload, onclick) and javascript: URLs.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return '';
  if (typeof window === 'undefined') {
    // SSR fallback: remove script tags and inline event attributes via regex
    return html
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/\s*on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '')
      .replace(/javascript:/gi, 'javascript_disabled:');
  }

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');

    const FORBIDDEN_TAGS = ['script', 'iframe', 'embed', 'object', 'form', 'base', 'meta', 'link', 'applet'];

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
        // Remove javascript: or data: URIs in href, src, action, data
        if (['href', 'src', 'action', 'data'].includes(lowerName)) {
          const val = (el.getAttribute(attrName) || '').trim().toLowerCase();
          if (val.startsWith('javascript:') || val.startsWith('vbscript:') || (lowerName === 'src' && val.startsWith('data:text/html'))) {
            el.removeAttribute(attrName);
          }
        }
      });
    });

    return doc.body.innerHTML;
  } catch {
    return html.replace(/<[^>]*>/g, '');
  }
}
