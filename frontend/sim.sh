#!/bin/bash
export NVM_DIR="$HOME/.nvm"
source "$NVM_DIR/nvm.sh"
cd "/Users/sergio/Desktop/APP C+E/NutriAI-Fit/frontend"
pm2 start zencrus-backend 2>/dev/null
npx expo start --localhost --ios
