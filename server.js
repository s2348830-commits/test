require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');
const cors = require('cors');
const axios = require('axios');
const User = require('./models/User');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ミドルウェアの設定
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // publicフォルダ内のHTMLをWebとして公開

// MongoDBに接続
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('✅ MongoDB Connected'))
    .catch(err => console.error('❌ MongoDB Connection Error:', err));

// ==========================================
// Discord SDK 配信（CSPエラー回避の裏技）
// ==========================================
app.get('/sdk.js', async (req, res) => {
    try {
        // サーバー側で外部のSDKを取得し、自分のURLから配信する
        const response = await axios.get('https://esm.sh/@discord/embedded-app-sdk?bundle');
        res.setHeader('Content-Type', 'application/javascript');
        res.send(response.data);
    } catch (error) {
        console.error('SDK取得エラー:', error);
        res.status(500).send('SDK Error');
    }
});

app.get('/@discord/*', async (req, res) => {
    try {
        // パス回しされた本体のファイルも、サーバーが代わりに取得してあげる
        const response = await axios.get(`https://esm.sh${req.originalUrl}`);
        res.setHeader('Content-Type', 'application/javascript');
        res.send(response.data);
    } catch (error) {
        console.error('内部SDK取得エラー:', error);
        res.status(404).send('Not Found');
    }
});

// ==========================================
// REST API エンドポイント
// ==========================================

// 1. FP取得API (Webから呼ばれる)
app.get('/api/fp/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        let user = await User.findOne({ userId });
        
        // ユーザーが未登録の場合は新規作成（初期FPは0）
        if (!user) {
            user = await User.create({ userId, fp: 0 });
        }
        res.json({ userId: user.userId, fp: user.fp });
    } catch (error) {
        res.status(500).json({ error: 'サーバーエラーが発生しました' });
    }
});

// 2. FP更新API (Botから呼ばれる)
app.post('/api/fp/update', async (req, res) => {
    // セキュリティ：Bot以外が勝手にAPIを叩けないように「合言葉(API_KEY)」でチェック
    const apiKey = req.headers['authorization'];
    if (apiKey !== process.env.API_KEY) {
        return res.status(403).json({ error: '認証エラー：不正なアクセスです' });
    }

    try {
        const { userId, fpChange } = req.body;
        
        // ユーザーを探してFPを加算（未登録なら作ってから加算）
        const user = await User.findOneAndUpdate(
            { userId },
            { $inc: { fp: fpChange } }, // $inc は「加算(増減)」の命令
            { new: true, upsert: true } // upsert: 見つからなければ作る
        );

        // ★ここでWebSocketを使って、Web(Activity)を開いている全員に更新を通知！
        io.emit('fp_updated', { userId: user.userId, fp: user.fp });

        res.json({ success: true, userId: user.userId, fp: user.fp });
    } catch (error) {
        res.status(500).json({ error: '更新エラーが発生しました' });
    }
});

// ==========================================
// Discord SDK 認証用トークン取得エンドポイント
// (Activity内でユーザーIDを安全に取得するために必須)
// ==========================================
app.post('/api/token', async (req, res) => {
    try {
        const response = await fetch(`https://discord.com/api/oauth2/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                client_id: process.env.CLIENT_ID,
                client_secret: process.env.CLIENT_SECRET,
                grant_type: 'authorization_code',
                code: req.body.code,
            }),
        });
        const data = await response.json();
        res.json({ access_token: data.access_token });
    } catch (error) {
        res.status(500).json({ error: 'トークン取得失敗' });
    }
});

// サーバー起動
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Server is running on port ${PORT}`);
});