/**
 * Utility functions for HTML escaping to prevent XSS attacks.
 * All user-controlled strings should be escaped before being inserted into HTML.
 */

/**
 * Escapes special HTML characters in a string to prevent XSS attacks.
 * @param text - The string to escape
 * @returns The escaped string safe for insertion into HTML
 */
export function escapeHtml(text: string | undefined | null): string {
    if (text === undefined || text === null) {
        return '';
    }
    const str = String(text);
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;')
        .replace(/\//g, '&#x2F;');
}

/**
 * Validates that a tree name doesn't contain HTML/script tags or other dangerous content.
 * @param name - The tree name to validate
 * @returns True if the name is safe, false otherwise
 */
export function isValidTreeName(name: string | undefined | null): boolean {
    if (!name || typeof name !== 'string') {
        return false;
    }
    const trimmed = name.trim();
    if (trimmed.length === 0 || trimmed.length > 100) {
        return false;
    }
    // Check for HTML tags and script keywords
    const dangerousPatterns = [
        /<[^>]*>/gi,           // HTML tags
        /javascript:/gi,        // JavaScript protocol
        /on\w+\s*=/gi,          // Event handlers like onclick=
        /data:\s*text\/html/gi, // Data URLs
    ];
    for (const pattern of dangerousPatterns) {
        if (pattern.test(trimmed)) {
            return false;
        }
    }
    return true;
}

/**
 * Sanitizes a tree name, returning a safe version or empty string if invalid.
 * @param name - The tree name to sanitize
 * @returns A safe tree name
 */
export function sanitizeTreeName(name: string | undefined | null): string {
    if (!isValidTreeName(name)) {
        return '';
    }
    return name!.trim();
}