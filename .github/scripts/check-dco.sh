#!/usr/bin/env bash
# DCO check: every non-merge commit in BASE..HEAD needs a Signed-off-by trailer
# whose address is exactly the commit author's address. Addresses are compared
# as fixed text (plus signs, brackets and dots are not pattern syntax).
set -euo pipefail
: "${BASE:?BASE commit required}" "${HEAD:?HEAD commit required}"
DEPENDABOT_EMAIL='49699333+dependabot[bot]@users.noreply.github.com'

fail=0
for sha in $(git rev-list --no-merges "$BASE..$HEAD"); do
  author_email=$(git log -1 --format='%ae' "$sha")
  subject=$(git log -1 --format='%s' "$sha")
  if [ "${PR_AUTHOR:-}" = "dependabot[bot]" ] && [ "$author_email" = "$DEPENDABOT_EMAIL" ]; then
    echo "Skipping Dependabot commit $sha ($subject)"
    continue
  fi
  ok=0
  while IFS= read -r value; do
    [[ "$value" == *"<$author_email>" ]] && ok=1
  done < <(git log -1 --format='%(trailers:key=Signed-off-by,valueonly,separator=%x0A)' "$sha")
  if [ "$ok" -ne 1 ]; then
    echo "::error::Commit $sha ($subject) has no Signed-off-by line matching its author <$author_email>."
    fail=1
  fi
done
if [ "$fail" -ne 0 ]; then
  echo "Fix with: git rebase --signoff $BASE && git push --force-with-lease"
  exit 1
fi
echo "All commits are signed off."
