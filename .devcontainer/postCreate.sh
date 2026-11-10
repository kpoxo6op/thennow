#!/bin/bash
corepack enable
corepack pnpm install --frozen-lockfile
git config --global user.email "$GIT_EMAIL"
git config --global user.name "$GIT_USER"
