# Folder Reorganization Plan

## Current Issues:
1. Duplicate `sms-forwarder` folders (root and android/)
2. Improperly named "New folder"
3. Build artifacts (`graphify-out`) in root
4. 20+ documentation files cluttering root
5. Firebase credentials exposed in root
6. No clear separation of concerns

## Proposed Structure:

```
shanutechx/
├── .github/                    # CI/CD workflows
├── .kiro/                      # Kiro configuration
├── .vscode/                    # VS Code settings
├── android/                    # Android projects
│   └── sms-forwarder/         # SMS forwarder app
├── apps/                       # Main applications
│   ├── api/                   # Backend API
│   ├── dashboard/             # Admin dashboard
│   └── web/                   # Public website
├── docs/                       # ⭐ NEW: All documentation
│   ├── deployment/            # Deployment guides
│   ├── development/           # Development guides
│   ├── audits/                # Audit reports
│   └── sprints/               # Sprint summaries
├── config/                     # ⭐ NEW: Configuration files
│   ├── firebase/              # Firebase config
│   └── scripts/               # Build/deployment scripts
├── infra/                      # Infrastructure as code
├── packages/                   # Shared packages
├── services/                   # Microservices
│   ├── discord-bot/
│   ├── node-agent/
│   └── whatsapp-bot/
├── templates/                  # Service templates
├── tests/                      # Test suites
├── .build/                     # ⭐ NEW: Build artifacts (gitignored)
│   └── graphify-out/
├── .dockerignore
├── .gitignore
├── package.json
├── package-lock.json
└── README.md                   # Main readme only
```

## Actions Required:

### 1. Remove Duplicates
- Delete root `sms-forwarder/` (keep android version)

### 2. Rename/Remove
- Delete or rename "New folder"

### 3. Move Documentation
- Create `docs/` structure
- Move all MD files to appropriate subdirectories

### 4. Secure Credentials
- Move Firebase admin SDK file to `config/firebase/`
- Add to .gitignore if not already

### 5. Organize Build Artifacts
- Create `.build/` directory
- Move `graphify-out/` there
- Ensure .gitignore covers it

### 6. Consolidate Scripts
- Move PS1 and CMD files to `config/scripts/`
