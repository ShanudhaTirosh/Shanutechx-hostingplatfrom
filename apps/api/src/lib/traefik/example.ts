/**
 * Traefik Configuration Module - Usage Examples
 * 
 * This file demonstrates common usage patterns for the Traefik configuration module.
 * DO NOT import this file in production code - it's for documentation purposes only.
 */

import { traefikConfig } from './config';
import { prisma } from '../prisma';

/**
 * Example 1: Adding a custom domain to a deployment
 * 
 * This is the typical flow when a customer attaches a custom domain.
 */
async function exampleAddCustomDomain() {
  const deploymentId = 'dep-abc-123';
  const customDomain = 'myapp.example.com';

  // 1. Fetch the deployment
  const deployment = await prisma.deployment.findUnique({
    where: { id: deploymentId },
    include: { node: true },
  });

  if (!deployment || !deployment.node) {
    throw new Error('Deployment or node not found');
  }

  if (deployment.internalPort === null) {
    throw new Error('Deployment has no internal port configured');
  }

  // 2. Validate the domain format
  if (!traefikConfig.validateDomain(customDomain)) {
    throw new Error('Invalid domain format');
  }

  // 3. Check for domain conflicts
  const hasConflict = await traefikConfig.checkDomainConflict(customDomain);
  if (hasConflict) {
    throw new Error('Domain already in use');
  }

  // 4. Add the Traefik route
  await traefikConfig.addRoute(deployment.node, deployment.id, {
    domain: customDomain,
    targetService: deployment.id,
    targetPort: deployment.internalPort,
    useSSL: true, // Enable SSL certificate provisioning
  });

  // 5. Create the custom domain record in the database
  await prisma.customDomain.create({
    data: {
      deploymentId: deployment.id,
      domain: customDomain,
      cnameTarget: `${deployment.subdomain}.platform.example.com`,
      status: 'active',
      verifiedAt: new Date(),
    },
  });

  console.log(`Custom domain ${customDomain} added successfully`);
}

/**
 * Example 2: Removing a custom domain
 * 
 * This is called when a customer detaches a custom domain.
 */
async function exampleRemoveCustomDomain() {
  const customDomainId = 'domain-xyz-789';

  // 1. Fetch the custom domain record
  const customDomain = await prisma.customDomain.findUnique({
    where: { id: customDomainId },
    include: {
      deployment: {
        include: { node: true },
      },
    },
  });

  if (!customDomain || !customDomain.deployment.node) {
    throw new Error('Custom domain or deployment not found');
  }

  // 2. Remove the Traefik route
  await traefikConfig.removeRoute(
    customDomain.deployment.node,
    customDomain.deploymentId,
    customDomain.domain
  );

  // 3. Delete the custom domain record from the database
  await prisma.customDomain.delete({
    where: { id: customDomainId },
  });

  console.log(`Custom domain ${customDomain.domain} removed successfully`);
}

/**
 * Example 3: Updating SSL configuration
 * 
 * This refreshes the SSL certificate configuration for a domain.
 */
async function exampleUpdateSSL() {
  const customDomainId = 'domain-xyz-789';

  // 1. Fetch the custom domain record
  const customDomain = await prisma.customDomain.findUnique({
    where: { id: customDomainId },
    include: {
      deployment: {
        include: { node: true },
      },
    },
  });

  if (!customDomain || !customDomain.deployment.node) {
    throw new Error('Custom domain or deployment not found');
  }

  // 2. Update SSL configuration
  await traefikConfig.updateSSL(
    customDomain.deployment.node,
    customDomain.deploymentId,
    customDomain.domain,
    customDomain.sslCertId || 'auto'
  );

  // 3. Update the custom domain record
  await prisma.customDomain.update({
    where: { id: customDomainId },
    data: { updatedAt: new Date() },
  });

  console.log(`SSL configuration updated for ${customDomain.domain}`);
}

/**
 * Example 4: Generating router configuration for debugging
 * 
 * This is useful for troubleshooting Traefik configuration issues.
 */
function exampleGenerateConfig() {
  const labels = traefikConfig.generateRouterConfig({
    domain: 'myapp.example.com',
    deploymentId: 'dep-abc-123',
    internalPort: 3000,
    sslEnabled: true,
    httpsRedirect: true,
    routingPriority: 100,
  });

  console.log('Generated Traefik labels:');
  console.log(JSON.stringify(labels, null, 2));

  // Output example:
  // {
  //   "traefik.enable": "true",
  //   "traefik.http.routers.custom-dep-abc-123-myapp-example-com.rule": "Host(`myapp.example.com`)",
  //   "traefik.http.routers.custom-dep-abc-123-myapp-example-com.entrypoints": "websecure",
  //   "traefik.http.routers.custom-dep-abc-123-myapp-example-com.tls": "true",
  //   "traefik.http.routers.custom-dep-abc-123-myapp-example-com.tls.certresolver": "letsencrypt",
  //   ...
  // }
}

/**
 * Example 5: Domain validation
 * 
 * Validate domain format before processing.
 */
function exampleValidateDomain() {
  const domains = [
    'valid.example.com',
    'invalid',
    'also-valid.staging.example.io',
    'invalid-.com',
    'http://not-a-domain.com',
  ];

  for (const domain of domains) {
    const isValid = traefikConfig.validateDomain(domain);
    console.log(`${domain}: ${isValid ? '✓ Valid' : '✗ Invalid'}`);
  }
}

/**
 * Example 6: Checking for domain conflicts
 * 
 * Ensure a domain is not already in use before adding it.
 */
async function exampleCheckConflict() {
  const domainToCheck = 'myapp.example.com';
  const currentDeploymentId = 'dep-abc-123';

  // Check if domain is used by another deployment
  const hasConflict = await traefikConfig.checkDomainConflict(
    domainToCheck,
    currentDeploymentId // Exclude this deployment from the check
  );

  if (hasConflict) {
    console.log(`Domain ${domainToCheck} is already in use by another deployment`);
  } else {
    console.log(`Domain ${domainToCheck} is available`);
  }
}

/**
 * Example 7: Complete custom domain attachment flow
 * 
 * This combines all the steps for a complete domain attachment.
 */
async function exampleCompleteFlow() {
  const deploymentId = 'dep-abc-123';
  const customDomain = 'myapp.example.com';

  try {
    // Step 1: Validate domain
    if (!traefikConfig.validateDomain(customDomain)) {
      throw new Error('Invalid domain format');
    }

    // Step 2: Check for conflicts
    const hasConflict = await traefikConfig.checkDomainConflict(customDomain);
    if (hasConflict) {
      throw new Error('Domain already in use');
    }

    // Step 3: Fetch deployment
    const deployment = await prisma.deployment.findUnique({
      where: { id: deploymentId },
      include: { node: true },
    });

    if (!deployment || !deployment.node) {
      throw new Error('Deployment not found');
    }

    if (deployment.internalPort === null) {
      throw new Error('Deployment has no internal port configured');
    }

    // Step 4: Generate CNAME target
    const cnameTarget = `${deployment.subdomain}.platform.example.com`;

    // Step 5: Create custom domain record (pending status)
    const domainRecord = await prisma.customDomain.create({
      data: {
        deploymentId: deployment.id,
        domain: customDomain,
        cnameTarget,
        status: 'pending',
      },
    });

    // Step 6: Wait for DNS verification (in real flow, this is a separate API call)
    // For this example, we'll assume it's verified
    console.log(`Waiting for DNS verification for ${customDomain}...`);
    console.log(`Customer needs to create CNAME: ${customDomain} → ${cnameTarget}`);

    // Step 7: Once verified, add Traefik route
    await traefikConfig.addRoute(deployment.node, deployment.id, {
      domain: customDomain,
      targetService: deployment.id,
      targetPort: deployment.internalPort,
      useSSL: true,
    });

    // Step 8: Update domain status
    await prisma.customDomain.update({
      where: { id: domainRecord.id },
      data: {
        status: 'active',
        verifiedAt: new Date(),
      },
    });

    console.log(`✓ Custom domain ${customDomain} is now active`);
    console.log(`  HTTPS: https://${customDomain}`);
    console.log(`  HTTP: http://${customDomain} (redirects to HTTPS)`);
  } catch (error) {
    console.error('Failed to attach custom domain:', error);
    throw error;
  }
}

// Export examples for documentation (not for production use)
export const examples = {
  exampleAddCustomDomain,
  exampleRemoveCustomDomain,
  exampleUpdateSSL,
  exampleGenerateConfig,
  exampleValidateDomain,
  exampleCheckConflict,
  exampleCompleteFlow,
};
