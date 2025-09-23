# Codeflow Development Instructions

Always reference these instructions first and fallback to search or bash commands only when you encounter unexpected information that does not match the info here.

## Current Repository State

**CRITICAL**: This repository is currently in early development stage with minimal code. The repository contains only a README.md file describing codeflow as "an autonomous coding agent running 100% natively in a E2B sandbox."

## Working Effectively

### Repository Structure
```
.
├── README.md               # Project description
└── .github/
    └── copilot-instructions.md  # These instructions
```

### Current Limitations
- **No build system present**: There are no package.json, requirements.txt, Makefile, or other build configuration files.
- **No source code**: The main application code has not been implemented yet.
- **No tests**: No testing framework or test files exist.
- **No dependencies**: No dependency management files are present.

### Development Environment Setup
Since the actual codebase is not yet implemented, standard setup steps cannot be validated. When the codebase is developed, update these instructions with:

1. **Dependency Installation**:
   - Document exact commands for installing runtime dependencies
   - Include specific versions and download URLs where applicable
   - Test and validate every command works from a fresh environment

2. **Build Process**:
   - Add exact build commands with validated timeouts
   - Document expected build times (e.g., "NEVER CANCEL: Build takes 45 minutes")
   - Include any required environment variables or configuration

3. **Testing**:
   - Document test execution commands
   - Include timeout requirements for test suites
   - Specify validation scenarios that must be tested after changes

## E2B Sandbox Context

Since this project involves E2B sandbox development, future instructions should include:
- E2B SDK installation and setup requirements
- Sandbox environment configuration
- Authentication and API key management
- Testing procedures for sandbox-based functionality

## Validation Requirements

**CRITICAL**: When actual code is added to this repository, all instructions must be:
1. **Exhaustively validated** - Every command must be tested to work
2. **Time-documented** - Include actual timing for builds/tests with appropriate timeouts
3. **Scenario-tested** - Include end-to-end user workflows that must be validated
4. **Never cancelled** - Long-running operations must complete with adequate timeouts

## Common Tasks

### Repository Exploration
```bash
# View current repository contents
ls -la
# Expected output: README.md and .github/ directory only

# Check git status
git --no-pager status
# Should show clean working directory
```

### Documentation Review
```bash
# View project description
cat README.md
# Output: "Codeflow is an autonomous coding agent running 100% natively in a E2B sandbox."
```

## Future Development Guidelines

When the actual codebase is implemented, these instructions must be updated to include:

1. **Exact Setup Commands**:
   - Validated installation procedures for all dependencies
   - Operating system specific requirements
   - Version pinning for critical dependencies

2. **Build and Test Procedures**:
   - Complete build pipeline with timing information
   - Test execution with explicit timeout values
   - Linting and formatting commands that match CI requirements

3. **Validation Scenarios**:
   - Specific user workflows to test after changes
   - Integration tests with E2B sandbox
   - End-to-end scenarios for the autonomous coding agent

4. **Troubleshooting**:
   - Common issues and their solutions
   - Known limitations and workarounds
   - Debug procedures for sandbox-related problems

## Important Notes

- **DO NOT** attempt to run build or test commands until actual source code is present
- **DO NOT** assume standard Node.js, Python, or other language conventions apply
- **ALWAYS** validate any new instructions added to this file with exhaustive testing
- **UPDATE** these instructions immediately when new code or configuration is added

## Next Steps for Development

When adding code to this repository:
1. Update these instructions with validated setup procedures
2. Add comprehensive build and test documentation
3. Include specific E2B sandbox integration requirements
4. Test all instructions from a fresh clone to ensure they work reliably