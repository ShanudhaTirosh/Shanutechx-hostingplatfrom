/**
 * ShanuTechX Production E2E Master Test Suite
 *
 * Covers all 30 features across the 4-Tier Test Case Design Methodology:
 *  - Tier 1: Core Feature Coverage (Features 1 - 30, >= 5 tests each)
 *  - Tier 2: Boundary & Corner Cases (limits, zero/empty/negative, invalid inputs, edge conditions)
 *  - Tier 3: Cross-Feature Interactions (pairwise combinations across modules)
 *  - Tier 4: Real-World Application Scenarios (end-to-end full platform workflows)
 *
 * Invocation:
 *  npx tsx --test tests/e2e/index.test.ts
 */

// Tier 1: Core Feature Coverage
import './tier1-features/m1-core-platform.test';
import './tier1-features/m2-container-build.test';
import './tier1-features/m3-databases-supabase.test';
import './tier1-features/m4-deployments-catalog.test';
import './tier1-features/m5-proxy-mail-security.test';
import './tier1-features/m6-e2e-quality.test';

// Tier 2: Boundary & Corner Cases
import './tier2-boundary/limits-and-validation.test';
import './tier2-boundary/security-boundaries.test';

// Tier 3: Cross-Feature Interactions
import './tier3-interactions/auth-deployment-lifecycle.test';
import './tier3-interactions/volume-container-persistence.test';
import './tier3-interactions/database-backup-restore.test';
import './tier3-interactions/catalog-domain-traefik.test';
import './tier3-interactions/smtp-acl-tenant-isolation.test';

// Tier 4: Real-World Application Scenarios
import './tier4-scenarios/developer-app-lifecycle.test';
import './tier4-scenarios/supabase-full-platform.test';
import './tier4-scenarios/multi-tenant-enterprise.test';
