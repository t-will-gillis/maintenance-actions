#!/usr/bin/env bash
set -euo pipefail

# Define remote base and local targets
REMOTE_BASE="https://github.com/my_org/my_repo/raw/main/maintenance-actions/example-configs"

# Array of source → destination pairs
declare -A FILES=(
  ["add-update-label-weekly.example.yml"]=".github/workflows/add-update-label-weekly.yml"
  ["add-update-label-weekly-config.example.yml"]=".github/maintenance-actions/add-update-label-weekly-config.yml"
  ["label-directory.example.yml"]=".github/maintenance-actions/label-directory.yml"
)

# Loop through and copy only if the destination doesn't exist
for SRC in "${!FILES[@]}"; do
  DEST="${FILES[$SRC]}"
  mkdir -p "$(dirname "$DEST")"
  if [[ ! -f "$DEST" ]]; then
    echo "Downloading $SRC → $DEST"
    curl -L "$REMOTE_BASE/$SRC" -o "$DEST"
  else
    echo "Skipping $DEST (already exists)"
  fi
done
echo "Setup complete."