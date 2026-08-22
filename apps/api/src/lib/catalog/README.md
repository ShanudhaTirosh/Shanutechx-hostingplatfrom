# Catalog Template Parser

This module provides functionality to parse YAML template files from the `templates/` directory and extract structured metadata and service definitions.

## Features

- **Metadata Extraction**: Parses comment headers to extract documentation URL, slogan, category, tags, logo path, and port
- **Service Definition Parsing**: Extracts Docker service configurations including images, environment variables, volumes, commands, and health checks
- **Environment Variable Classification**: Distinguishes between required, optional (with defaults), and platform-injected variables
- **Validation**: Validates Docker image references and template structure
- **Error Handling**: Gracefully handles parsing errors and provides detailed error messages

## Usage

### Basic Parsing

```typescript
import { parseTemplateYaml } from './lib/catalog/template-parser';

const templatePath = '/path/to/templates/myapp.yml';
const result = parseTemplateYaml(templatePath);

console.log(result.name);       // "myapp"
console.log(result.category);   // "backend"
console.log(result.services);   // Array of service definitions
```

### Template Structure

Templates should follow this structure:

```yaml
# documentation: https://example.com/docs
# slogan: Short description of the application
# category: backend
# tags: tag1,tag2,tag3
# logo: svgs/logo.png
# port: 8080

services:
  servicename:
    image: namespace/image:tag
    environment:
      - SERVICE_URL_SERVICENAME_8080
      - REQUIRED_VAR=${REQUIRED_VAR}
      - OPTIONAL_VAR=${OPTIONAL_VAR:-defaultvalue}
    volumes:
      - data:/path/to/data
```

## Environment Variable Types

The parser recognizes three types of environment variables:

### 1. Platform-Injected Variables
These are automatically provided by the platform and start with `SERVICE_URL_` or `SERVICE_PASSWORD_`:

```yaml
- SERVICE_URL_SERVICENAME_8080
- SERVICE_PASSWORD_MYSERVICE
```

**Parsed as**: `{ required: false, defaultValue: null }`

### 2. Required User Variables
Variables that must be provided by the user during deployment:

```yaml
- DATABASE_URL=${DATABASE_URL}
- API_KEY=${API_KEY}
```

**Parsed as**: `{ required: true, defaultValue: null }`

### 3. Optional Variables with Defaults
Variables that have a default value if not provided:

```yaml
- DEBUG=${DEBUG:-false}
- MAX_CONNECTIONS=${MAX_CONNECTIONS:-100}
```

**Parsed as**: `{ required: false, defaultValue: "false" }` or `{ required: false, defaultValue: "100" }`

## API Reference

### `parseTemplateYaml(filePath: string): TemplateDetails`

Parses a template YAML file and returns structured data.

**Parameters:**
- `filePath` (string): Absolute path to the YAML template file

**Returns:** `TemplateDetails` object containing:
- `slug`: Filename without extension (used as identifier)
- `filename`: Original filename
- `name`: Display name (from metadata or slug)
- `slogan`: Short description
- `documentation`: URL to documentation
- `category`: Template category (defaults to "other")
- `tags`: Array of tags
- `logo`: Path to logo image
- `port`: Main service port (nullable)
- `services`: Array of service definitions
- `yaml`: Raw YAML content

**Throws:** Error if file cannot be read

### `validateDockerImage(image: string): boolean`

Validates a Docker image reference format.

**Parameters:**
- `image` (string): Docker image reference (e.g., "nginx:latest", "ghcr.io/owner/repo:tag")

**Returns:** `true` if valid, `false` otherwise

**Valid formats:**
- `image:tag`
- `namespace/image:tag`
- `registry.com/namespace/image:tag`
- `registry.com:5000/namespace/image:tag`

### `validateTemplateStructure(details: TemplateDetails): { valid: boolean; errors: string[] }`

Validates the parsed template structure.

**Parameters:**
- `details` (TemplateDetails): Parsed template object

**Returns:** Validation result object:
- `valid`: Whether the template is valid
- `errors`: Array of error messages (empty if valid)

**Validation Rules:**
- Must have at least one service definition
- Each service must have a name
- Each service must have a valid Docker image reference
- Template must have a category

## Types

### `TemplateMeta`
Basic metadata for catalog listing:
```typescript
interface TemplateMeta {
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
```

### `TemplateDetails`
Extended template information including service definitions:
```typescript
interface TemplateDetails extends TemplateMeta {
  services: ServiceDefinition[];
  yaml: string;
}
```

### `ServiceDefinition`
Docker service configuration:
```typescript
interface ServiceDefinition {
  name: string;
  image: string;
  environmentVariables: EnvironmentVariable[];
  volumes: string[];
  healthcheck?: unknown;
  command?: string[];
}
```

### `EnvironmentVariable`
Environment variable configuration:
```typescript
interface EnvironmentVariable {
  key: string;
  required: boolean;
  defaultValue: string | null;
  rawValue: string;
}
```

## Example Output

For the template `convertx.yml`:

```typescript
{
  slug: "convertx",
  filename: "convertx.yml",
  name: "convertx",
  slogan: "A self-hosted online file converter. Supports over a thousand different formats.",
  documentation: "https://github.com/C4illin/ConvertX",
  category: "backend",
  tags: ["converter", "file", "documents", "files", "directories"],
  logo: "svgs/convertx.png",
  port: 3000,
  services: [
    {
      name: "convertx",
      image: "ghcr.io/c4illin/convertx:latest",
      environmentVariables: [
        { key: "SERVICE_URL_CONVERTX", required: false, defaultValue: null, rawValue: "SERVICE_URL_CONVERTX" },
        { key: "ACCOUNT_REGISTRATION", required: false, defaultValue: "false", rawValue: "ACCOUNT_REGISTRATION=${ACCOUNT_REGISTRATION:-false}" },
        { key: "JWT_SECRET", required: true, defaultValue: null, rawValue: "JWT_SECRET=${SERVICE_PASSWORD_CONVERTXJWTSECRET}" }
      ],
      volumes: ["convertx_data:/app/data"]
    }
  ],
  yaml: "... (full YAML content) ..."
}
```

## Error Handling

The parser handles errors gracefully:

- **File not found**: Throws error with clear message
- **Invalid YAML syntax**: Should be caught by the calling code (catalog manager)
- **Missing required metadata**: Provides default values (e.g., category defaults to "other")
- **Invalid Docker images**: Reported in validation but doesn't prevent parsing

## Performance Considerations

- The parser uses simple string parsing rather than a full YAML library for better performance
- Metadata extraction stops at the first non-comment line
- Service parsing uses line-by-line iteration for memory efficiency
- Suitable for parsing hundreds of templates in the catalog cache rebuild process

## Future Enhancements

Possible improvements for future iterations:

1. Support for YAML anchors and references
2. More sophisticated environment variable type detection (URL, email, number patterns)
3. Extraction of port mappings and network configurations
4. Support for Docker Compose v3 specific features
5. Validation of volume mount syntax
6. Health check configuration parsing
