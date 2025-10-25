# Automate the ORG 
## Maintenance Actions Monorepo

Centralized GitHub Actions for repository maintenance and automation across the organization.

## Repository Structure

```markdown
maintenance-actions/
│
├── add-update-label-weekly/            # "Add Update Label Weekly" workflow
│   ├── dist/
│   │   └── index.js
│   ├── action.yml
│   └── index.js
│
├── core/                               # Core business logic
│   └── add-update-label-weekly.js      # "Add Update Label Weekly" files
│
├── shared/                             # Shared utilities across all actions
│   ├── get-timeline.js
│   ├── find-linked-issue.js
│   ├── hide-issue-comment.js
│   ├── query-issue-info.js
│   ├── resolve-configs.js              # Resolve config files
│   └── resolve-labels.js               # Resolve label files
│
├── example-configs/                    # Example configuration files
│   ├── add-update-label-config.example.yml
│   ├── add-update-label-weekly.example.yml
│   └── label-directory.example.yml
│
├── package.json                        # Dependencies for all actions
├── 
├── CHANGELOG.md
└── README.md                           # This file
```

## Available Actions

### Add Update Label Weekly

Monitors “In Progress” issues for recent updates since the last run and posts reminders to assignees who haven’t provided activity.<br>[Full details →](#add-update-label-weekly-1)

### Check PR Linked Issue (Coming Soon)

Validates that pull requests reference an issue.

---

## Set Up
Choose your desired workflow, then follow the steps to implement it in your repo.



### Add Update Label Weekly

#### What It Does

- Scans all **open, assigned** issues with a status of "In progress (actively working)"<sup>1</sup>.
- Checks for recent comments from the issue **assignee** since the last automation run<sup>2</sup>.
- If there are no recent comments from the assignee, posts a reminder<sup>3</sup> that the assignee should: 
  - provide a brief update on their progress,
  - describe blockers and request help if needed,
  - indicate their availability for working on the issue, and
  - share an estimated time to complete the issue.
- Applies the label "statusInactive1" : `To Update!`<sup>4</sup> if this is the first notice.
- Applies the label "statusInactive2": `2 weeks inactive`<sup>4</sup> if this is the second notice. 
- Additional features:
  - Minimizes previous, repetitive bot comments within a specified timeframe<sup>2</sup>.
  - Applies the label (default) "statusUpdated": `Status: Updated`<sup>4</sup> if an update was posted recently.
  - Removes previously applied labels when appropriate.
- Ensures ongoing communication, accountability, and support across active tasks.


These are configurable, see [Step 2: Customize Config →](#step-2-customize-config):  
<sub>&emsp; <sup>1</sup> Project Board status  
&emsp; <sup>2</sup> All time periods  
&emsp; <sup>3</sup> Reminder message  
&emsp; <sup>4</sup> All label names</sub>  

### Implementing in Your Project

#### Step 0: Copy and rename the three workflow files that you need for your workflow. (coming soon)

#### Step 1: Copy GitHub Actions Workflow YML 
Copy and rename the example GitHub Actions Workflow YML from `example-configs/` into your repo, then customize `.github/workflows/add-update-label-weekly.yml` for cron schedule, project repo path, and PAT. 

```bash
# Ensure target folder exists
mkdir -p .github/maintenance-actions

# Copy and rename the remote file into your local repo
curl -L https://github.com/hackforla/website/raw/main/maintenance-actions/example-configs/add-update-label-weekly.example.yml \
-o .github/workflows/add-update-label-weekly.yml
```
See [example-configs/add-update-label-weekly.example.yml](./example-configs/add-update-label-weekly.example.yml) for a complete example.

#### Step 2: Copy and Customize Config File
Copy and rename the example configuration file from `example-configs/` into your repo, then customize `add-update-label-weekly-config.yml` for your project's needs.

  ```bash
  # Ensure target folder exists
  mkdir -p .github/maintenance-actions

  # Copy and rename the remote file into your local repo
  curl -L https://github.com/hackforla/website/raw/main/maintenance-actions/example-configs/add-update-label-weekly-config.example.yml \
  -o .github/maintenance-actions/add-update-label-weekly-config.yml
  ```
See [example-configs/add-update-label-config.example.yml](./example-configs/add-update-label-config.example.yml) for a complete example.
#### Step 3: Copy Label Directory 
Copy and rename the example label directory file from `example-configs/` into your repo, then customize `.github/maintenance-actions/label-directory.yml` to match the labels you are using in your project.


```bash
# Ensure target folder exists
mkdir -p .github/maintenance-actions

# Only if this file does not exist, copy to your local repo and rename 
[ -f .github/maintenance-actions/label-directory.yml ] && echo "File already exists" || curl -L https://github.com/hackforla/website/raw/main/maintenance-actions/example-configs/label-directory.example.yml \
-o .github/maintenance-actions/label-directory.yml
```
Correlate the 'labelKey' values to the 'Label Names' that are applicable to your project in the format: 
```yml
labels:
  ...
  labelKey1: "Label Name 1"
  labelKey2: "Label Name 2'
  ...
```

If you do not include the values in `.github/maintenance-actions/label-directory.yml`, the default values shown in `.github/maintenance-actions/add-update-label-weekly-config.yml` will apply. For this workflow, the default values are: 

```yml
  # Required by the workflow:
  statusUpdated: "Status: Updated"
  statusInactive1: "To Update!"
  statusInactive2: "2 weeks inactive"
  statusHelpWanted: "Status: Help Wanted"

  # Exclude issues with any of these labels: 
  draft: "Draft"
  er: "ER"
  epic: "Epic"
  dependency: "Dependency"
  complexity0: "Complexity: Prework"
```

Set the path in your config:

```bash
labelDirectoryPath: ".github/maintenance-actions/label-directory.yml"
```
See [example-configs/label-directory.example.yml](./example-configs/label-directory.example.example.yml) for a complete example.



#### Step 5: Create Token and Secret

Create a Personal Access Token with the scopes:
- `repo` (full control)
- `project` (full control)

Add it to the secret (default is `PROJECT_GRAPHQL_TOKEN`) to use in the workflow.



### Action Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `github-token` | Token with 'repo (full)' and 'project (full)' scopes | Yes | - |
| `config-path` | Path to config YAML in your repo | No | `.github/maintenance-actions/`<br>`add-update-label-weekly-config.yml` |
| `updated-by-days` | Override: days for "current" threshold | No | From config |
| `comment-by-days` | Override: days for first notice | No | From config |
| `inactive-by-days` | Override: days for second notice | No | From config |
| `target-status` | Override: Project Board status | No | From config |
| `label-status-*` | Override: label names | No | From config |


---

# Monorepo Development Notes

The following applies to the maintenance of the `hackforla/maintenance-actions` repo only.
### Setup

```bash
git clone https://hackforla/my_github_username/maintenance-actions.git
cd maintenance-actions
npm install
```

### Adding Dependencies

Since this is a composite action that runs in the GitHub Actions environment, dependencies are installed automatically. Just add them to `package.json`.

### Testing

Test actions in a separate test repository before releasing next version.

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
