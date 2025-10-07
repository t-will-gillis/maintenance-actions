# Maintenance Actions Monorepo

Centralized GitHub Actions for repository maintenance and automation across the organization.

## Repository Structure

```
maintenance-actions/
├── add-update-label-weekly/         # Issue staleness tracking action
│   ├── action.yml
│   └── index.js
│
├── check-pr-linked-issue/           # Future: PR validation action
│   ├── action.yml
│   └── index.js
│
├── shared/                          # Shared utilities across all actions
│   ├── get-timeline.js
│   ├── find-linked-issue.js
│   ├── hide-issue-comment.js
│   ├── logger.js
│   └── load-config.js
│
├── core/                            # Core business logic (one folder per workflow)
│   ├── staleness/
│   │   ├── add-label.js             # Main staleness logic
│   │   └── config.js                # Staleness-specific config loader
│   └── pr-validation/               # Future: PR validation logic
│       ├── validate-pr.js
│       └── config.js                # PR-specific config loader
│
├── example-configs/                 # Example configuration files
│   ├── add-update-label-config.example.yml
│   └── check-pr-config.example.yml
│
└── package.json                     # Dependencies for all actions
```

## Available Actions

### Add Update Label Weekly

Automatically manages issue staleness labels based on assignee activity.

**Usage:**

```yaml
- uses: my_github_username/maintenance-actions/add-update-label-weekly@v1
  with:
    github-token: ${{ secrets.MY_TOKEN }}
    config-path: '.github/maintenance-actions/add-update-label-config.yml'
```

[Full documentation →](#add-update-label-weekly-1)

### Check PR Linked Issue (Coming Soon)

Validates that pull requests reference an issue.

---

## Getting Started

### For Projects Using These Actions

#### Step 1: Copy Example Config

Copy the appropriate example config from `example-configs/` to your project:

```bash
mkdir -p .github/maintenance-actions
cp example-configs/add-update-label-config.example.yml \
   .github/maintenance-actions/add-update-label-config.yml
```

#### Step 2: Customize Config

Edit `.github/maintenance-actions/add-update-label-config.yml` for your project's needs.

#### Step 3: Create Workflow

Create `.github/workflows/add-update-label-weekly.yml`:

```yaml
name: Add Update Label Weekly

on:
  schedule:
    - cron: '0 7 * 1-6,8-11 5'
  workflow_dispatch:

permissions:
  contents: read
  issues: read

jobs:
  check-staleness:
    runs-on: ubuntu-latest
    steps:
      - uses: my_github_username/maintenance-actions/add-update-label-weekly@v1
        with:
          github-token: ${{ secrets.MY_TOKEN }}
```

#### Step 4: Add Secrets

Add required secrets to your repository (Settings → Secrets → Actions).

---

## Add Update Label Weekly

### What It Does

- Monitors issues in "In progress (actively working)" status
- Adds warning labels after 7 days of inactivity
- Adds inactive labels after 14 days of inactivity
- Removes labels when issues are updated or have linked PRs
- Minimizes outdated bot comments

### Configuration

All configuration is done via YAML file in your project:

```yaml
# .github/maintenance-actions/add-update-label-config.yml

timeframes:
  updatedByDays: 3
  commentByDays: 7
  inactiveUpdatedByDays: 14
  upperLimitDays: 35

projectBoard:
  targetStatus: "In progress (actively working)"

labels:
  statusUpdated: "Status: Updated"
  statusInactive1: "Status: To Update"
  statusInactive2: "Status: Inactive"
  exclude:
    - "Draft"
    - "Epic"

bots:
  - "github-actions[bot]"

labelDirectoryPath: ".github/label-directory.json"  # Optional

commentTemplate: |
  Hello ${assignees}! 👋
  This issue needs an update...
```

### Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | Token with repo and project scopes | Yes | - |
| `config-path` | Path to config YAML in your repo | No | `.github/maintenance-actions/add-update-label-config.yml` |
| `updated-by-days` | Override: days for "current" threshold | No | From config |
| `comment-by-days` | Override: days for first warning | No | From config |
| `inactive-updated-by-days` | Override: days for inactive | No | From config |
| `target-status` | Override: project board status | No | From config |
| `label-status-*` | Override: label names | No | From config |

### Label Directory Integration

If your project has a label directory JSON file, the action will automatically use it:

```json
// .github/label-directory.json
{
  "statusUpdated": "Status: Updated",
  "statusInactive1": "Status: To Update",
  "statusInactive2": "Status: Inactive"
}
```

Set the path in your config:

```yaml
labelDirectoryPath: ".github/label-directory.json"
```

### Required Secret

Create a Personal Access Token with:
- `repo` (full control)
- `project` (full control)

Add it as a repository secret and reference in your workflow.

---

## Development

### Setup

```bash
git clone https://github.com/my_github_username/maintenance-actions.git
cd maintenance-actions
npm install
```

### Adding Dependencies

Since this is a composite action that runs in the GitHub Actions environment, dependencies are installed automatically. Just add them to `package.json`.

### Testing

Test actions in a separate test repository before releasing to `@v1`.

### Adding a New Action

1. Create new folder: `new-action-name/`
2. Add `action.yml` and `index.js`
3. Add logic to `core/` if substantial
4. Add shared utilities to `shared/` if reusable
5. Create example config in `example-configs/`
6. Update this README

### Versioning

Use tags for versioning:

```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0

# Update major version tag
git tag -fa v1 -m "Update v1 to v1.0.0"
git push origin v1 --force
```

Projects can reference:
- `@v1` - Gets latest v1.x.x (auto-updates)
- `@v1.0.0` - Pins to specific version
- `@main` - Uses latest commit (not recommended)

---

## Shared Utilities

Located in `shared/`, these are used across multiple actions:

### load-config.js (Generic Config Loader)

**Generic configuration loader** used by all actions. Handles:
- Loading YAML/JSON config files from project repos
- Merging defaults, file config, and overrides
- Deep merging of nested objects
- Config validation

Each action creates its own config loader in `core/[action-name]/config.js` that:
1. Defines action-specific defaults
2. Transforms flat action inputs to nested config structure
3. Calls the generic `load-config.js`
4. Validates required fields for that action

**Example pattern for new actions:**

```javascript
// core/your-action/config.js
const loadConfig = require('../../shared/load-config');

function loadYourActionConfig({ projectRepoPath, configPath, overrides }) {
  const defaults = {
    // Action-specific defaults
  };
  
  const nestedOverrides = {
    // Transform flat overrides to nested
  };
  
  const config = loadConfig({
    projectRepoPath,
    configPath,
    overrides: nestedOverrides,
    defaults,
  });
  
  // Validate required fields
  loadConfig.validateConfig(config, ['field1', 'nested.field2']);
  
  return config;
}
```

### get-timeline.js

Fetches issue timeline events from GitHub API.

### find-linked-issue.js

Parses PR body to find linked issues (fixes #123, resolves #456, etc.).

### hide-issue-comment.js

Minimizes comments using GraphQL mutation.

### logger.js

Consistent logging across all actions.

### load-config.js

Loads and merges YAML config files with overrides.

---

## Contributing

1. Create a feature branch
2. Make your changes
3. Test in a test repository
4. Submit a pull request
5. After approval, tag a new release

---

## Support

- **Issues**: Open an issue in this repository
- **Questions**: Contact DevOps team
- **Docs**: See action-specific documentation above

---

## License

MIT
