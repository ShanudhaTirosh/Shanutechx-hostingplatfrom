# Build and Management Scripts

This directory contains PowerShell (`.ps1`) and CMD (`.cmd`) scripts for building, running, and managing the ShanUtechX platform.

## 🚀 Quick Commands

### Starting Services
```powershell
# Start all services
.\START-ALL.ps1

# Check service health
.\CHECK-HEALTH.cmd
.\STATUS.ps1
```

### Stopping Services
```powershell
# Stop all services
.\STOP-ALL.ps1
```

### Viewing Logs
```powershell
# View service logs
.\VIEW-LOGS.ps1
```

### Building
```powershell
# Rebuild all services
.\REBUILD.ps1
```

## 📁 Available Scripts

| Script | Description |
|--------|-------------|
| `START-ALL.ps1` | Start all Docker services |
| `START-ALL.cmd` | Start all services (CMD version) |
| `STOP-ALL.ps1` | Stop all running services |
| `CHECK-HEALTH.cmd` | Check health status of services |
| `STATUS.ps1` | View detailed service status |
| `VIEW-LOGS.ps1` | View aggregated logs |
| `REBUILD.ps1` | Rebuild Docker images and services |

## 💡 Usage Tips

### PowerShell Scripts
Run PowerShell scripts from the repository root:
```powershell
cd c:\Users\tiros\OneDrive\Desktop\shanutechx-final\shanutechx
.\config\scripts\START-ALL.ps1
```

### CMD Scripts
Run CMD scripts from the repository root:
```cmd
cd c:\Users\tiros\OneDrive\Desktop\shanutechx-final\shanutechx
.\config\scripts\CHECK-HEALTH.cmd
```

## 🔧 Prerequisites

- **Docker Desktop** installed and running
- **PowerShell 5.1+** for `.ps1` scripts
- **Administrator privileges** may be required for some operations

## 🐛 Troubleshooting

If scripts fail to execute:

1. **PowerShell Execution Policy**:
   ```powershell
   Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
   ```

2. **Docker Not Running**:
   - Start Docker Desktop
   - Wait for Docker to fully initialize

3. **Permission Issues**:
   - Run terminal as Administrator
   - Check file permissions

## 📝 Adding New Scripts

When adding new scripts:
1. Place them in this directory
2. Use clear, descriptive names (VERB-NOUN pattern)
3. Add documentation header in the script
4. Update this README
5. Test on both PowerShell and CMD if applicable

## 🔗 Related Documentation

- [Development Guide](../../docs/development/)
- [Deployment Guide](../../docs/deployment/)
- [Docker Setup](../../docs/development/DOCKER_SETUP_README.md)
