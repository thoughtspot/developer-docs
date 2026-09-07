#!/usr/bin/env bash
# Removes the temporary .reviewChanged review markup from the docs
# sources and the stylesheet. Safe to run more than once.
set -euo pipefail
cd "$(dirname "$0")/.."

FILES=(
  modules/ROOT/pages/user-api.adoc
  modules/ROOT/pages/partials/user-api-list.adoc
  modules/ROOT/pages/api-user-management.adoc
)

for f in "${FILES[@]}"; do
  # [NOTE.reviewChanged] -> [NOTE]
  sed -i '' -E 's/^\[(NOTE|IMPORTANT|TIP|WARNING|CAUTION)\.reviewChanged\]$/[\1]/' "$f"
  # table role
  sed -i '' 's/^\[div tableContainer reviewChanged\]$/[div tableContainer]/' "$f"
  # standalone section role lines
  sed -i '' '/^\[\.reviewChanged\]$/d' "$f"
done

# stylesheet block: the markup is appended at the end of the file, so drop
# everything from its banner comment onward, plus any trailing blank lines.
python3 - <<'PYEOF'
import re
p = "src/assets/styles/index.scss"
lines = open(p).read().split("\n")
start = next((i for i, l in enumerate(lines) if "TEMPORARY REVIEW MARKUP" in l), None)
if start is not None:
    while start > 0 and not lines[start].lstrip().startswith("/*"):
        start -= 1
    lines = lines[:start]
    while lines and not lines[-1].strip():
        lines.pop()
    open(p, "w").write("\n".join(lines) + "\n")
PYEOF

echo "Stripped. Remaining references:"
grep -rn "reviewChanged" modules/ src/ 2>/dev/null || echo "  none"
