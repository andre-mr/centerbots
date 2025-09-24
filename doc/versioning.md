# after any commit/push

- npm version patch --tag-version-prefix "v" -m "%s"
- git push origin main --follow-tags
