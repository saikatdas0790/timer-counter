#!/bin/bash
# Post-create script for devcontainer setup
# Runs after the devcontainer is created

set -e

echo "========================================="
echo "DevContainer Post-Create Setup"
echo "========================================="

# Install system packages
echo ""
echo "Installing system packages..."
sudo apt-get update -qq && sudo apt-get install -y -qq dnsutils
echo "✓ Installed dnsutils (dig, nslookup, host)"

# SpacetimeDB CLI
echo ""
echo "Installing SpacetimeDB CLI..."
curl -sSf https://install.spacetimedb.com | sh -s -- -y
echo "✓ SpacetimeDB CLI installed"

# Check SSH Agent accessibility
echo ""
echo "Checking SSH Agent..."
if ssh-add -l >/dev/null 2>&1; then
    echo "✓ SSH Agent is accessible"
    ssh-add -l | sed 's/^/  /'
elif [ $? -eq 1 ]; then
    echo "✓ SSH Agent is running but has no identities"
    echo "  Run 'ssh-add ~/.ssh/id_ed25519' in WSL to add your key"
else
    echo "⚠ Warning: SSH agent not accessible"
    echo "  Ensure agent is running in WSL with fixed socket at ~/.ssh/agent.sock"
    echo "  See: https://github.com/dolr-ai/yral-bare-metal-kubernetes-cluster/blob/main/README.md#ssh-setup"
fi

# Configure GitHub CLI to use SSH
echo ""
echo "Configuring GitHub CLI..."
gh config set git_protocol ssh --host github.com 2>/dev/null || true
gh config set git_protocol ssh 2>/dev/null || true
echo "✓ GitHub CLI configured to use SSH protocol"

# Install npm dependencies
echo ""
echo "Installing npm dependencies..."
npm install
echo "✓ npm dependencies installed"

# Check gh authentication status
echo ""
echo "Checking GitHub CLI authentication..."
if gh auth status >/dev/null 2>&1; then
    echo "✓ GitHub CLI is authenticated"
else
    echo "⚠ GitHub CLI not authenticated (expected in CI)"
    echo "  For local development: ensure gh is authenticated in WSL"
fi

# Generate .env from Ansible Vault if vault password is present
echo ""
echo "Checking Ansible Vault..."
if [ -f "ansible/.vault_pass" ]; then
    echo "✓ Vault password found, generating .env..."
    (ansible-playbook ansible/setup_env.yml)
    echo "✓ .env generated"
    
    # Authenticate SpacetimeDB if token is available
    if [ -f ".env" ]; then
        source .env
        if [ -n "$SPACETIMEDB_TOKEN" ]; then
            echo ""
            echo "Authenticating SpacetimeDB CLI..."
            if spacetime login --token "$SPACETIMEDB_TOKEN" --no-browser; then
                echo "✓ SpacetimeDB CLI authenticated"
            else
                echo "⚠ Failed to authenticate SpacetimeDB CLI"
            fi
        fi
    fi
elif [ -f "ansible/vars/vault.yml" ]; then
    echo "⚠ vault.yml exists but no .vault_pass found"
    echo "  Set your vault password: echo 'your_password' > ansible/.vault_pass && chmod 600 ansible/.vault_pass"
    echo "  Then run: ansible-playbook ansible/setup_env.yml"
else
    echo "ℹ️  Ansible Vault not yet initialised"
    echo "  Create ansible/vars/vault.yml from ansible/vars/vault.yml.example,"
    echo "  write your password to ansible/.vault_pass, then encrypt:"
    echo "  ansible-vault encrypt ansible/vars/vault.yml"
fi

echo ""
echo "========================================="
echo "✓ DevContainer setup complete!"
echo "========================================="
