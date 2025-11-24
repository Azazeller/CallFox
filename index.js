
import express from 'express';
import fetch from 'node-fetch';

const app = express();
app.use(express.json());

const TOKEN = process.env.TELEGRAM_TOKEN;
const API_KEY = process.env.CRYPT_CLOUD_API_KEY;
const MERCHANT = process.env.MERCHANT_ID;

app.get('/', (req, res) => res.send('CallFox bot is running'));

app.post('/webhook', async (req, res) => {
    console.log('Webhook received:', req.body);

    if (req.body.type === 'payment' && req.body.status === 'paid') {
        const chatId = req.body.order_id;
        await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                chat_id: chatId,
                text: "Оплата подтверждена! Спасибо 🔥"
            })
        });
    }
    res.sendStatus(200);
});

app.post('/bot', async (req, res) => {
    const body = req.body;
    if (!body.message) return res.sendStatus(200);

    const chatId = body.message.chat.id;

    await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            text: "Для оформления платежа используйте ссылку: https://cryptocloud.plus/pay/" + MERCHANT
        })
    });

    res.sendStatus(200);
});

app.listen(3000, () => console.log('Server running on port 3000'));
