// esm.sh を使って Discord SDK を直接インポート（ビルド不要で初心者向け）
import { DiscordSDK } from "/sdk.js";
// Client ID を設定（Developer Portalで確認可能）
const discordSdk = new DiscordSDK('1457823497937096836');
const socket = io(); // Socket.ioの接続

let currentUserId = null;

async function setupActivity() {
    try {
        await discordSdk.ready();
        document.getElementById('status').innerText = '認証中...';

        // 1. Discordから認証コードを取得
        const { code } = await discordSdk.commands.authorize({
            client_id: '1457823497937096836',
            response_type: "code",
            state: "",
            prompt: "none",
            scope: ["identify"]
        });

        // 2. 自作APIサーバー経由でアクセストークンを取得
        const response = await fetch("/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
        });
        const { access_token } = await response.json();

        // 3. Discord SDKを認証し、自分のユーザーIDを特定
        const authResult = await discordSdk.commands.authenticate({ access_token });
        currentUserId = authResult.user.id;
        
        document.getElementById('status').innerText = `ユーザー名: ${authResult.user.username} (同期完了)`;

        // 4. 初回のFP取得
        fetchFP();

    } catch (error) {
        console.error("SDK Setup Error:", error);
        document.getElementById('status').innerText = 'エラー：Discord内で起動してください';
    }
}

// サーバーからFPを取得して画面を更新する関数
async function fetchFP() {
    if (!currentUserId) return;
    const res = await fetch(`/api/fp/${currentUserId}`);
    const data = await res.json();
    document.getElementById('fp-text').innerText = `${data.fp} FP`;
}

// ★ リアルタイム更新の魔法：サーバーから 'fp_updated' イベントを受信
socket.on('fp_updated', (data) => {
    // もし更新されたデータが「自分」のものだったら、画面を書き換える
    if (data.userId === currentUserId) {
        document.getElementById('fp-text').innerText = `${data.fp} FP`;
        
        // 少しアニメーション効果（色を変えて戻すなど）を入れるとリアルタイム感が増します
        const el = document.getElementById('fp-text');
        el.style.color = '#57F287';
        setTimeout(() => el.style.color = '#fee75c', 1000);
    }
});

// 起動！
setupActivity();