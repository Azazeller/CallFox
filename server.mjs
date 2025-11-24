
import express from 'express';
import bodyParser from 'body-parser';
import dotenv from 'dotenv';
dotenv.config();

const app = express();
app.use(bodyParser.json());

app.post('/telegram', (req,res)=>{
  console.log('Telegram update:', req.body);
  res.sendStatus(200);
});

app.post('/cryptocloud', (req,res)=>{
  console.log('CryptoCloud payload:', req.body);
  res.sendStatus(200);
});

app.get('/', (req,res)=>res.send('CallFox Render A+ Worker running'));

app.listen(process.env.PORT || 3000, ()=>console.log('Server started'));
