# Ansible Setup Guide

Secrets are managed with [Ansible Vault](https://docs.ansible.com/ansible/latest/vault_guide/index.html). The encrypted `vars/vault.yml` is committed to the repository; the vault password is stored only in `ansible/.vault_pass` (gitignored locally).

## First-Time Setup

1. Copy the vault example and fill in your Cloudflare API token:
   ```bash
   cp ansible/vars/vault.yml.example ansible/vars/vault.yml
   # edit ansible/vars/vault.yml with your real token
   ```

2. Write your vault password and encrypt:
   ```bash
   echo 'your_vault_password' > ansible/.vault_pass && chmod 600 ansible/.vault_pass
   ansible-vault encrypt ansible/vars/vault.yml
   ```

3. Rebuild (or reopen) the devcontainer — `postCreate.sh` will detect the vault password and run `setup_env.yml` automatically, generating `.env`.

## Directory Structure

```
ansible.cfg                  # Ansible config — at repo root so commands run from root
ansible/
├── .vault_pass              # Vault password (gitignored — never commit)
├── inventory/
│   └── hosts                # Local inventory (localhost)
├── vars/
│   ├── main.yml             # Plaintext variable references (committed)
│   ├── vault.yml            # Ansible-vault-encrypted secrets (committed)
│   └── vault.yml.example    # Template showing expected vault keys
├── templates/
│   └── env.j2               # Template for .env file
├── setup_env.yml            # Playbook: decrypt vault → write .env (runs in postCreate)
└── manage_dns.yml           # Playbook: upsert CNAME record in Cloudflare (one-time)
```

## Variable Naming Convention

- **`vars/main.yml`** (committed) — public identifiers in plaintext; sensitive values reference the vault:
  ```yaml
  cloudflare_api_token: "{{ vault_cloudflare_api_token }}"  # sensitive → vault
  cloudflare_zone_id: "4250af23497bb7a306e4450a7709a997"    # public — plaintext is fine
  ```

- **`vars/vault.yml`** (encrypted, committed) — only truly secret values:
  ```yaml
  vault_cloudflare_api_token: "your_actual_token"
  ```

## Common Commands

All commands run from the **repo root**:

```bash
# View encrypted secrets
ansible-vault view ansible/vars/vault.yml

# Edit secrets (decrypts, opens $EDITOR, re-encrypts on save)
ansible-vault edit ansible/vars/vault.yml

# Regenerate .env after editing secrets
ansible-playbook ansible/setup_env.yml

# Upsert the CNAME record in Cloudflare (one-time DNS setup)
ansible-playbook ansible/manage_dns.yml

# Change vault password
ansible-vault rekey ansible/vars/vault.yml
```

## Security

- **Never commit** `ansible/.vault_pass` or `.env`
- **Always commit** the encrypted `vars/vault.yml`
- Share the vault password via a password manager (not Slack/email)
