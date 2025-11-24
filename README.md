# CallFox — Final Release (A+)

## Quick deploy (recommended)
1. Push these files to your GitHub repo (https://github.com/Azazeller/CallFox)
2. On Render create New → Web Service → Connect repo
3. Build command: `npm install`
4. Start command: `npm start`
5. In Render Dashboard → Environment add (or keep embedded):
   - BOT_TOKEN
   - CRYPTOCLOUD_API_KEY
   - CRYPTO_SECRET
   - SHOP_ID
   - JSON_URL
   - JSON_KEY
   - OPERATOR_CHAT (numeric id: 399248837)
6. Set webhooks:
   - Telegram webhook: `https://<your-render-domain>/telegram-webhook`
   - CryptoCloud webhook: `https://<your-render-domain>/cryptocloud` (set Secret = CRYPTO_SECRET)

## Notes
- Original uploaded local server file (for reference): /mnt/data/index.js
- If you need me to push the repo to GitHub for you, provide a GitHub PAT with repo scope (delete it after) or use the manual upload.
