#!/bin/bash

echo "=== Recriando repositório astracampaign ==="

# Remove o remote atual
git remote remove origin

# Recria o repositório no GitHub usando gh CLI
gh repo create AstraOnlineWeb/astracampaign --public --source=. --remote=origin

# Faz push de todo o código
git push -u origin main

echo "=== Repositório recriado com sucesso! ==="
