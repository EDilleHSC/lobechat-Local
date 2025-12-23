# Secret leak remediation

When a secret is detected (CI/gitleaks or manual review):

1. **Rotate immediately**
   - Revoke or rotate the credential at the provider (GitHub token, cloud key, DB password, etc.).
   - Update the new value in your secret store or local `.env` (do not commit).

2. **Remove from repo**
   - Delete or untrack the file:
     ```bash
     git rm --cached path/to/.env
     echo "path/to/.env" >> .gitignore
     git commit -m "chore: remove local env file from tracking"
     ```

3. **If committed historically**
   - Coordinate with stakeholders.
   - Use `git filter-repo` (preferred) or BFG to purge the secret from history.
   - Force-push updated history and notify all collaborators to re-clone or hard-reset.

4. **Record the incident**
   - Log what was leaked, when, and the rotation steps taken.
   - Update docs or runbooks if process changes are needed.
