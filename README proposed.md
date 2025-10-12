# Maintenance Actions

Centralized, reusable GitHub Actions for repository maintenance and automation.

## Available Workflows

### Add Update Label Weekly

Automatically checks issue staleness and applies appropriate labels based on the last update time. This helps teams stay on top of active issues and identify work that may need attention.

**What it does:**
- Monitors issues with a specific project board status
- Checks when issues were last updated by assignees
- Applies labels based on update recency
- Posts reminder comments for stale issues
- Removes labels when PRs are opened
- Minimizes outdated bot comments

## Quick Start

### 1. Set up your project repository

#### a. Create a label directory

Create `.github/maintenance-actions/label-directory.yml` in your project:

```yaml
# Required labels
statusUpdated: "Status: Updated"
statusInactive1: "Status: To Update"
statusInactive2: "Status: Inactive"

# Optional labels (customize as needed)
statusHelpWanted: "Status: Help Wanted"
draft: "Draft"
er: "ER"
epic: "Epic"
dependency: "Dependency"
```

See [example-configs/label-directory.example.yml](./example-configs/label-directory.example.yml) for a complete example.

#### b. Create a configuration file (optional)

Create `.github/maintenance-actions/add-update-label-config.yml` to customize behavior:

```yaml
timeframes:
  updatedByDays: 3
  commentByDays: 7
  inactiveByDays: 14
  upperLimitDays: 30

projectBoard:
  targetStatus: "In progress (actively working)"

labels:
  exclude:
    - draft
    - epic
    - dependency
```

See [example-configs/add-update-label-weekly-config.example.yml](./example-configs/add-update-label-weekly-config.example.yml) for all options.

#### c. Create a GitHub workflow

Create `.github/workflows/maintenance.yml` in your project:

```yaml
name: Add Update Label Weekly

on:
  schedule:
    - cron: '0 7 * * 5'  # Fridays at 7am UTC
  workflow_dispatch:
    inputs:
      dry-run:
        description: 'Run in dry-run mode (no changes)'
        type: boolean
        default: true

permissions:
  contents: read
  issues: write

jobs:
  add-update-label-weekly:
    runs-on: ubuntu-latest
    if: github.repository == 'your-org/your-repo'  # Customize this
    steps:
      - name: Checkout project repository
        uses: actions/checkout@v4
        
      - name: Run Add Update Label Weekly
        uses: your-org/maintenance-actions/add-update-label-weekly@v1
        with:
          github-token: ${{ secrets.GITHUB_TOKEN }}
          dry-run: ${{ inputs.dry-run || 'false' }}
```

### 2. Create required labels in your repository

Make sure all labels referenced in your `label-directory.yml` exist in your GitHub repository. You can create them manually or use a tool like [GitHub Label Sync](https://github.com/Financial-Times/github-label-sync).

### 3. Test with dry-run mode

1. Go to your repository's Actions tab
2. Select "Add Update Label Weekly"
3. Click "Run workflow"
4. Enable "Run in dry-run mode"
5. Review the logs to see what would happen without making changes

### 4. Run for real

Once you've verified the dry-run output looks correct:
1. Set `dry-run: false` in your workflow file, or
2. Uncheck the dry-run option when manually triggering

## Configuration

### Action Inputs

| Input | Required | Default | Description |
|-------|----------|---------|-------------|
| `github-token` | Yes | - | GitHub token with `issues: write` permission |
| `config-path` | No | `.github/maintenance-actions/add-update-label-config.yml` | Path to config file |
| `dry-run` | No | `false` | Run without making changes |

### Configuration File Options

#### Timeframes

```yaml
timeframes:
  updatedByDays: 3      # Issues updated within this are "current"
  commentByDays: 7      # After this, issue gets "to update" label
  inactiveByDays: 14    # After this, issue gets "inactive" label
  upperLimitDays: 30    # Don't check bot comments older than this
```

#### Project Board

```yaml
projectBoard:
  targetStatus: "In progress (actively working)"  # Only check issues with this status
```

#### Labels

```yaml
labels:
  exclude:  # Issues with these labels are skipped entirely
    - draft
    - epic
    - dependency
```

#### Comment Template

Customize the message posted to stale issues:

```yaml
commentTemplate: |
  Hello ${assignees}!
  
  Please provide an update on this issue.
  
  ${cutoffTime}
```

Available variables:
- `${assignees}` - @-mentions of assignees
- `${label}` - Label being applied
- `${cutoffTime}` - Formatted timestamp
- `${statusUpdated}` - Your "updated" label name
- `${statusHelpWanted}` - Your "help wanted" label name

#### Other Options

```yaml
timezone: "America/New_York"  # Timezone for ${cutoffTime}
dryRun: true                  # Enable dry-run mode in config
bots:                          # Bot comments to minimize
  - "github-actions[bot]"
  - "your-bot-name"
```

## Label Directory

The label directory maps internal label keys to your project's actual label names.

**Label Keys (DO NOT CHANGE):**
- `statusUpdated` - Recently updated issues
- `statusInactive1` - Issues needing update
- `statusInactive2` - Inactive issues
- `statusHelpWanted` - Assignee needs help
- `draft`, `er`, `epic`, `dependency`, etc. - Exclusion labels

**Label Names (CUSTOMIZE):**
- Must match labels in your GitHub repository exactly
- Can be anything you want

Example:
```yaml
statusUpdated: "Status: Updated"  # Your repo uses this name
statusInactive1: "Needs Update"   # Different name, same purpose
```

## How It Works

### Decision Flow

```
For each issue in "In progress (actively working)" status:
  ├─ Has open PR by assignee? → Remove all update labels
  ├─ Updated within 3 days? → Keep "Updated" label
  ├─ Updated 3-7 days ago? → Remove all labels
  ├─ Updated 7-14 days ago? → Add "To Update" label, post comment
  └─ No update in 14+ days? → Add "Inactive" label, post comment
```

### What Counts as an "Update"?

1. A comment by an assignee
2. Assigning an assignee to the issue

### Special Handling

- **Open PRs:** If an assignee opens a PR that fixes/resolves/closes the issue, all update labels are removed (focus shifts to the PR)
- **Closed PRs:** If a linked PR is closed, the issue continues through normal staleness checking
- **Bot Comments:** Outdated bot comments (7-30 days old) are automatically minimized to reduce clutter

## Dry-Run Mode

Dry-run mode shows you what the action would do without making any changes.

**Enable via workflow input:**
```yaml
workflow_dispatch:
  inputs:
    dry-run:
      type: boolean
      default: true
```

**Enable via config file:**
```yaml
dryRun: true
```

**Enable via action input:**
```yaml
- uses: your-org/maintenance-actions/add-update-label-weekly@v1
  with:
    dry-run: 'true'
```

In dry-run mode, logs show:
```
[DRY-RUN] Would add 'Status: To Update' label to issue #123
[DRY-RUN] Would remove 'Status: Updated' label from issue #123
[DRY-RUN] Would post comment to issue #123
```

## Troubleshooting

### "Label directory not found"

**Problem:** The action can't find your `label-directory.yml` file.

**Solution:** 
- Verify the file exists at `.github/maintenance-actions/label-directory.yml`
- Check the `labelDirectoryPath` in your config file
- Ensure the checkout action runs before this action

### "Missing required label keys"

**Problem:** Your label directory is missing required labels.

**Solution:** Add these required keys to your `label-directory.yml`:
- `statusUpdated`
- `statusInactive1`
- `statusInactive2`

### Labels aren't being applied

**Possible causes:**
1. **Dry-run mode is enabled** - Check workflow inputs and config file
2. **Labels don't exist in repo** - Create the labels first
3. **Project board status doesn't match** - Verify `targetStatus` in config
4. **Issues have exclusion labels** - Check your `labels.exclude` configuration

### "Configuration validation failed"

**Problem:** Required config fields are missing.

**Solution:** Ensure your config file includes:
```yaml
timeframes:
  updatedByDays: 3
  commentByDays: 7
  inactiveByDays: 14
  upperLimitDays: 35
projectBoard:
  targetStatus: "In progress (actively working)"
commentTemplate: |
  Your template here
```

## Permissions

The GitHub token needs these permissions:

```yaml
permissions:
  contents: read   # To checkout the repository
  issues: write    # To add/remove labels and post comments
```

## Version Pinning

We recommend pinning to a specific version:

```yaml
uses: your-org/maintenance-actions/add-update-label-weekly@v1.0.0
```

Available version strategies:
- `@v1` - Latest v1.x.x (may include breaking changes within major version)
- `@v1.0` - Latest v1.0.x (patch updates only)
- `@v1.0.0` - Exact version (no automatic updates)
- `@main` - Latest commit (not recommended for production)

## Development

### Repository Structure

```
maintenance-actions/
├── workflows/                          # Workflow-specific entry points
│   └── add-update-label-weekly/
│       ├── action.yml                  # Action definition
│       └── index.js                    # Orchestration layer
├── core/                               # Business logic (minimal changes from originals)
│   └── add-update-label-weekly.js
├── shared/                             # Reusable utilities
│   ├── get-timeline.js
│   ├── find-linked-issue.js
│   ├── hide-issue-comment.js
│   ├── query-issue-info.js
│   ├── resolve-configs.js              # Resolve config files
│   └── resolve-labels.js               # Resolve label files
│
├── example-configs/                    # Example configuration files
│   ├── add-update-label-weekly-config.example.yml
│   └── label-directory.example.yml
└── package.json
```

### Adding New Workflows

To add a new workflow following this architecture:

1. Create `workflows/[workflow-name]/action.yml`
2. Create `workflows/[workflow-name]/index.js` (orchestration)
3. Create `core/[workflow-name].js` (business logic)
4. Reuse `shared/resolve-configs.js` and `shared/resolve-labels.js`
5. Add example configs to `example-configs/`

## Support

For issues, questions, or contributions:
- Open an issue in this repository
- Check existing issues for similar problems
- Review the example configurations

## License

[Your License Here]