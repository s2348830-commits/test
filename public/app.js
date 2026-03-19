import { DiscordSDK } from "/sdk.js";
const discordSdk = new DiscordSDK('1456185139267768407');
const socket = io();
let currentUserId = null;

async function setupActivity() {
    try {
        console.log("--- Activity Setup Start ---");
        await discordSdk.ready();
        
        document.getElementById('status').innerText = '認証中...';

        // 1. 認可コードの取得
        const auth = await discordSdk.commands.authorize({
            client_id: '1456185139267768407',
            response_type: "code",
            state: "",
            prompt: "none",
            scope: ["identify"]
        });

        if (!auth.code) {
            throw new Error("Discordから認可コードを受け取れませんでした。");
        }
        console.log("Step 1: Authorization Code obtained.");

        // 2. サーバー経由でトークン交換
        const response = await fetch("/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code: auth.code })
        });

        const data = await response.json();
        
        if (!response.ok || !data.access_token) {
            console.error("Server Token Error Details:", data);
            throw new Error(`サーバーでのトークン交換に失敗しました: ${data.error || 'Unknown Error'}`);
        }
        console.log("Step 2: Access Token received from server.");

        // 3. 最終認証
        const authResult = await discordSdk.commands.authenticate({ 
            access_token: data.access_token 
        });
        
        console.log("Step 3: Authentication successful!");
        currentUserId = authResult.user.id;
        document.getElementById('status').innerText = `ユーザー名: ${authResult.user.username} (同期完了)`;

        fetchFP();

    } catch (error) {
        console.error("💥詳細ログ:", error);
        
        // 画面上の「認証中...」の文字をエラー内容に書き換えてしまう
        const errorDetail = error.message || JSON.stringify(error);
        document.getElementById('status').innerText = `致命的エラー: ${errorDetail}`;
        
        // もしエラーオブジェクトの中に詳細があればそれも出す
        if (error.error_description) {
            document.getElementById('status').innerText += ` (${error.error_description})`;
        }
    }
}

async function fetchFP() {
    if (!currentUserId) return;
    const res = await fetch(`/api/fp/${currentUserId}`);
    const data = await res.json();
    document.getElementById('fp-text').innerText = `${data.fp} FP`;
}

socket.on('fp_updated', (data) => {
    if (data.userId === currentUserId) {
        document.getElementById('fp-text').innerText = `${data.fp} FP`;
    }
});

setupActivity();