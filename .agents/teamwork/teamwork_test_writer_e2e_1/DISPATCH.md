## 2026-10-28T14:04:57Z
You are the E2E Test Suite Architect & Writer (teamwork_test_writer) for the parallel E2E Testing Track.
Your working directory is: c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_test_writer_e2e_1\
Your parent conversation ID is: 3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6

MANDATORY FIRST STEPS:
1. Read ORIGINAL_REQUEST.md at:
   c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\ORIGINAL_REQUEST.md
2. Read PROJECT.md at:
   c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\orchestrator\PROJECT.md

YOUR MISSION:
Design and build the comprehensive, opaque-box, requirement-driven E2E test suite covering all 30 inventoried features from PROJECT.md:
1. Adopt the 4-Tier Test Case Design Methodology:
   - Tier 1: Feature Coverage (>=5 tests per core feature: isolate and verify happy path via public HTTP/CLI interfaces)
   - Tier 2: Boundary & Corner Cases (limits, zero/empty/negative, invalid inputs, edge conditions)
   - Tier 3: Cross-Feature Interactions (pairwise combinations: auth + deployment, volume + container, database + backup)
   - Tier 4: Real-World Application Scenarios (realistic workflows end-to-end)
2. Test Philosophy:
   - Derived strictly from user requirements in ORIGINAL_REQUEST.md and PROJECT.md, NOT implementation internals.
   - Opaque-box: Exercise features via HTTP API endpoints, SDK, CLI, and public interfaces.
   - Progressive testability: Tier 1 tests must give signals immediately.
   - No mock backends or dummy assertions: tests must test real functionality.
3. Write test infrastructure and test suites in `tests/e2e/`.
4. Create `TEST_INFRA.md` (documenting test architecture, feature inventory, methodology, invocation) and `TEST_READY.md` (documenting test runner command and tier counts) in your working directory and at project root if permitted.

OUTPUT:
- Test files in `tests/e2e/`
- Documentation in `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_test_writer_e2e_1\TEST_INFRA.md`
- Signal file in `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_test_writer_e2e_1\TEST_READY.md`
- Formal handoff report in `c:\Users\tiros\OneDrive\Desktop\shanutechx\.agents\teamwork\teamwork_test_writer_e2e_1\handoff.md`
- Message back to parent (3a125b32-1f39-4775-b9b9-ac3c6c2ddfc6).
