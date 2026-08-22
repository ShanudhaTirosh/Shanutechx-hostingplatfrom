import fs from 'fs';
import path from 'path';

/**
 * Template metadata extracted from YAML comment header
 */
export interface TemplateMeta {
  slug: string;
  filename: string;
  name: string;
  slogan: string;
  documentation: string;
  category: string;
  tags: string[];
  logo: string;
  port: number | null;
}

/**
 * Detailed template structure including services and environment variables
 */
export interface TemplateDetails extends TemplateMeta {
  services: ServiceDefinition[];
  yaml: string;
}

/**
 * Service definition extracted from template YAML
 */
export interface ServiceDefinition {
  name: string;
  image: string;
  environmentVariables: EnvironmentVariable[];
  volumes: string[];
  healthcheck?: unknown;
  command?: string[];
}

/**
 * Environment variable definition
 */
export interface EnvironmentVariable {
  key: string;
  required: boolean;
  defaultValue: string | null;
  rawValue: string;
}

/**
 * Parse a template YAML file and extract metadata and structure
 * 
 * @param filePath - Absolute path to the YAML template file
 * @returns TemplateDetails object with all extracted data
 * @throws Error if file cannot be read or YAML is invalid
 */
export function parseTemplateYaml(filePath: string): TemplateDetails {
  // Read file content
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Extract metadata from comment header
  const metadata = extractMetadata(content);
  
  // Extract service definitions
  const services = extractServices(content);
  
  // Generate slug from filename
  const filename = path.basename(filePath);
  const slug = filename.replace(/\.ya?ml$/i, '');
  
  // Use slug as name if not provided in metadata
  const name = metadata.name || slug;
  
  return {
    slug,
    filename,
    name,
    slogan: metadata.slogan,
    documentation: metadata.documentation,
    category: metadata.category,
    tags: metadata.tags,
    logo: metadata.logo,
    port: metadata.port,
    services,
    yaml: content,
  };
}

/**
 * Extract metadata from YAML comment header
 * Comments in format: # key: value
 */
function extractMetadata(content: string): {
  name: string;
  slogan: string;
  documentation: string;
  category: string;
  tags: string[];
  logo: string;
  port: number | null;
} {
  const lines = content.split('\n');
  const metadata: Record<string, string> = {};
  
  // Extract comment header lines (lines starting with #)
  for (const line of lines) {
    const trimmed = line.trim();
    
    // Stop when we reach non-comment content
    if (!trimmed.startsWith('#')) {
      if (trimmed.length > 0) {
        break;
      }
      continue;
    }
    
    // Parse comment line: # key: value
    const commentContent = trimmed.substring(1).trim();
    const colonIndex = commentContent.indexOf(':');
    
    if (colonIndex === -1) continue;
    
    const key = commentContent.substring(0, colonIndex).trim();
    const value = commentContent.substring(colonIndex + 1).trim();
    
    if (key && value) {
      metadata[key] = value;
    }
  }
  
  // Parse tags (comma-separated)
  const tags = metadata.tags
    ? metadata.tags.split(',').map(t => t.trim()).filter(t => t.length > 0)
    : [];
  
  // Parse port (numeric) and validate range (1-65535)
  // Also ensure it's an integer (no decimals)
  let port: number | null = null;
  if (metadata.port) {
    // Check if it's a valid integer string (no decimals or non-numeric chars)
    if (/^\d+$/.test(metadata.port.trim())) {
      const parsedPort = parseInt(metadata.port, 10);
      if (!isNaN(parsedPort) && parsedPort >= 1 && parsedPort <= 65535) {
        port = parsedPort;
      }
    }
  }
  
  return {
    name: metadata.name || '',
    slogan: metadata.slogan || '',
    documentation: metadata.documentation || '',
    category: metadata.category || 'other',
    tags,
    logo: metadata.logo || '',
    port,
  };
}

/**
 * Extract service definitions from YAML content
 * Uses simple parsing without full YAML library for basic structure extraction
 */
function extractServices(content: string): ServiceDefinition[] {
  const services: ServiceDefinition[] = [];
  
  // Simple YAML parsing for services section
  const lines = content.split('\n');
  let inServices = false;
  let currentService: (Partial<ServiceDefinition> & { _indent?: number }) | null = null;
  let currentSection: 'root' | 'environment' | 'volumes' | 'command' | 'healthcheck' = 'root';
  let indentLevel = 0;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed.length === 0) continue;
    
    // Calculate indentation
    const indent = line.length - line.trimStart().length;
    
    // Check for services section
    if (trimmed.startsWith('services:')) {
      inServices = true;
      indentLevel = indent;
      continue;
    }
    
    if (!inServices) continue;
    
    // Check if we've exited services section (back to root level)
    if (indent <= indentLevel && trimmed.includes(':') && !trimmed.startsWith('-')) {
      break;
    }
    
    // Service name (one level deeper than services:)
    // Allow 2-4 spaces of indentation (flexible for different YAML styles)
    const serviceIndent = indent - indentLevel;
    if (serviceIndent >= 1 && serviceIndent <= 4 && trimmed.includes(':') && !trimmed.startsWith('-')) {
      // Check if this is a new service (not a property of current service)
      if (!currentService || indent <= (currentService as any)._indent) {
        // Save previous service
        if (currentService && currentService.name) {
          services.push(currentService as ServiceDefinition);
        }
        
        // Start new service
        const serviceName = trimmed.substring(0, trimmed.indexOf(':')).trim();
        currentService = {
          name: serviceName,
          image: '',
          environmentVariables: [],
          volumes: [],
          _indent: indent, // Store for comparison
        };
        currentSection = 'root';
        continue;
      }
    }
    
    if (!currentService) continue;
    
    // Parse service properties
    if (indent > (currentService as any)._indent) {
      // Image
      if (trimmed.startsWith('image:')) {
        let imageValue = trimmed.substring(6).trim();
        // Remove comments (everything after #)
        const commentIndex = imageValue.indexOf('#');
        if (commentIndex !== -1) {
          imageValue = imageValue.substring(0, commentIndex).trim();
        }
        // Remove surrounding quotes if present (after comment removal)
        if ((imageValue.startsWith('"') && imageValue.endsWith('"')) ||
            (imageValue.startsWith("'") && imageValue.endsWith("'"))) {
          imageValue = imageValue.substring(1, imageValue.length - 1);
        }
        currentService.image = imageValue;
        currentSection = 'root';
      }
      // Environment section
      else if (trimmed === 'environment:') {
        currentSection = 'environment';
      }
      // Volumes section
      else if (trimmed === 'volumes:') {
        currentSection = 'volumes';
      }
      // Command section
      else if (trimmed === 'command:') {
        currentSection = 'command';
        currentService.command = [];
      }
      // Healthcheck section
      else if (trimmed === 'healthcheck:') {
        currentSection = 'healthcheck';
      }
      // Parse environment variables
      else if (currentSection === 'environment' && trimmed.startsWith('-')) {
        const envLine = trimmed.substring(1).trim();
        const envVar = parseEnvironmentVariable(envLine);
        if (envVar) {
          currentService.environmentVariables!.push(envVar);
        }
      }
      // Parse volumes
      else if (currentSection === 'volumes' && trimmed.startsWith('-')) {
        let volume = trimmed.substring(1).trim();
        // Remove surrounding quotes if present
        if ((volume.startsWith('"') && volume.endsWith('"')) ||
            (volume.startsWith("'") && volume.endsWith("'"))) {
          volume = volume.substring(1, volume.length - 1);
        }
        if (volume) {
          currentService.volumes!.push(volume);
        }
      }
      // Parse command array
      else if (currentSection === 'command' && trimmed.startsWith('-')) {
        const commandPart = trimmed.substring(1).trim();
        if (commandPart) {
          currentService.command!.push(commandPart);
        }
      }
    }
  }
  
  // Save last service
  if (currentService && currentService.name) {
    services.push(currentService as ServiceDefinition);
  }
  
  // Clean up temporary properties
  for (const service of services) {
    delete (service as any)._indent;
  }
  
  return services;
}

/**
 * Parse environment variable line
 * Formats:
 * - SERVICE_URL_SERVICENAME_PORT (platform-injected, not user-provided)
 * - KEY=${VARIABLE_NAME} (required user-provided)
 * - KEY=${VARIABLE_NAME:-default} (optional with default)
 * - KEY=value (hardcoded value, not user-provided)
 */
function parseEnvironmentVariable(line: string): EnvironmentVariable | null {
  // Check for KEY=VALUE format
  const equalIndex = line.indexOf('=');
  
  if (equalIndex === -1) {
    // Simple key without value (treated as platform variable)
    return {
      key: line,
      required: false,
      defaultValue: null,
      rawValue: line,
    };
  }
  
  const key = line.substring(0, equalIndex).trim();
  const value = line.substring(equalIndex + 1).trim();
  
  // Platform-injected variables (SERVICE_URL_*, SERVICE_PASSWORD_*)
  if (key.startsWith('SERVICE_URL_') || key.startsWith('SERVICE_PASSWORD_')) {
    return {
      key,
      required: false,
      defaultValue: null,
      rawValue: line,
    };
  }
  
  // Check for ${VARIABLE} or ${VARIABLE:-default} pattern
  const varMatch = value.match(/^\$\{([^}:]+)(?::-(.*))?\}$/);
  
  if (varMatch) {
    const varName = varMatch[1];
    const defaultValue = varMatch[2] || null;
    
    return {
      key,
      required: defaultValue === null,
      defaultValue,
      rawValue: line,
    };
  }
  
  // Hardcoded value (not user-configurable)
  return {
    key,
    required: false,
    defaultValue: value,
    rawValue: line,
  };
}

/**
 * Validate Docker image reference format
 * Accepts formats:
 * - image:tag
 * - namespace/image:tag
 * - registry.com/namespace/image:tag
 * 
 * @param image - Docker image reference
 * @returns true if valid, false otherwise
 */
export function validateDockerImage(image: string): boolean {
  if (!image || image.trim().length === 0) {
    return false;
  }
  
  // Basic Docker image format validation
  // Must not contain spaces
  if (image.includes(' ')) {
    return false;
  }
  
  // Should contain at least one alphanumeric character
  if (!/[a-zA-Z0-9]/.test(image)) {
    return false;
  }
  
  // Simplified Docker image validation
  // Allow common patterns: namespace/image:tag, registry.com/namespace/image:tag, image:tag
  // This is a pragmatic validation - Docker itself will reject truly invalid images
  
  // Allow environment variable substitution patterns
  if (image.includes('${')) {
    // Contains environment variable, allow it
    return true;
  }
  
  // Allow SHA256 digests (@sha256:...)
  if (image.includes('@sha256:')) {
    return true;
  }
  
  // Must contain valid characters only (alphanumeric, dots, dashes, underscores, slashes, colons, @)
  if (!/^[a-zA-Z0-9._\-/:@]+$/.test(image)) {
    return false;
  }
  
  // Must have at least one alphanumeric character
  if (!/[a-zA-Z0-9]/.test(image)) {
    return false;
  }
  
  // Cannot be empty
  if (image.trim().length === 0) {
    return false;
  }
  
  return true;
}

/**
 * Validate YAML structure for required fields
 * 
 * @param details - Parsed template details
 * @returns Validation result with errors
 */
export function validateTemplateStructure(details: TemplateDetails): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];
  
  // Must have at least one service
  if (details.services.length === 0) {
    errors.push('Template must contain at least one service definition');
  }
  
  // Validate each service
  for (const service of details.services) {
    if (!service.name) {
      errors.push('Service must have a name');
    }
    
    if (!service.image) {
      errors.push(`Service '${service.name}' must have an image`);
    } else if (!validateDockerImage(service.image)) {
      errors.push(`Service '${service.name}' has invalid Docker image reference: ${service.image}`);
    }
  }
  
  // Category should not be empty (defaults to 'other' if missing)
  if (!details.category) {
    errors.push('Template must have a category');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
