# ShanUtechX Documentation

Welcome to the ShanUtechX documentation. This directory contains all project documentation organized by category.

## 📁 Directory Structure

### `/deployment`
Deployment guides, checklists, and production configuration
- Deployment checklists
- Production deployment guides
- Environment setup

### `/development`
Development guides, setup instructions, and troubleshooting
- Setup and installation guides
- Development workflows
- Build and test reports
- Docker setup
- Troubleshooting guides

### `/audits`
Code audits, security reviews, and audit reports
- Comprehensive audit reports
- Security audit findings
- Code quality assessments

### `/sprints`
Sprint summaries, progress tracking, and task completions
- Sprint progress reports
- Completed tasks summaries
- Feature implementation logs

## 🚀 Quick Start

1. **New Developers**: Start with [development/SETUP_COMPLETE.md](development/SETUP_COMPLETE.md)
2. **Deployment**: See [deployment/DEPLOYMENT_CHECKLIST.md](deployment/DEPLOYMENT_CHECKLIST.md)
3. **Quick Reference**: Check [QUICK_START.md](QUICK_START.md)

## 📝 Key Documents

- **[QUICK_START.md](QUICK_START.md)** - Get up and running quickly
- **[QUICK_SUMMARY.md](QUICK_SUMMARY.md)** - Project overview
- **[CLAUDE.md](CLAUDE.md)** - AI assistant context and guidelines

## 🔧 Scripts and Configuration

Scripts and configuration files have been moved to:
- **Scripts**: `/config/scripts/` - PowerShell and CMD scripts
- **Firebase Config**: `/config/firebase/` - Firebase admin SDK and configs

## 📦 Build Artifacts

Build artifacts are stored in:
- **Build Output**: `/.build/` - Build artifacts (gitignored)

## 🔒 Security Note

⚠️ Firebase admin SDK keys and credentials are stored in `/config/firebase/` and should be gitignored. Never commit sensitive credentials to version control.

## 📊 Project Structure

```
shanutechx/
├── apps/           # Main applications (API, Dashboard, Web)
├── services/       # Microservices (Discord, WhatsApp, Node Agent)
├── packages/       # Shared packages
├── android/        # Android applications
├── infra/          # Infrastructure as code
├── templates/      # Service templates
├── tests/          # Test suites
└── docs/           # Documentation (you are here)
```

## 🤝 Contributing

When adding new documentation:
1. Place it in the appropriate subdirectory
2. Update this README with a link
3. Follow the existing naming conventions
4. Keep the root clean - documentation goes in `/docs/`

## 📚 Additional Resources

- [Project README](../README.md) - Main project overview
- [GitHub Workflows](../.github/workflows/) - CI/CD configuration
