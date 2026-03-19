// esm.sh を使って Discord SDK を直接インポート（ビルド不要で初心者向け）
import { DiscordSDK } from "/sdk.js";
// Client ID を設定（Developer Portalで確認可能）
const discordSdk = new DiscordSDK('1456185139267768407');
const socket = io(); // Socket.ioの接続

let currentUserId = null;

async function setupActivity() {
    try {
        console.log("🔴ステップ0: ready待機...");
        await discordSdk.ready();
        console.log("🟢ステップ1: ready完了！");

        document.getElementById('status').innerText = '認証中 (1/3)...';

        console.log("🔴ステップ2: authorizeリクエスト...");
        const { code } = await discordSdk.commands.authorize({
            client_id: '1456185139267768407', // ★ここはあなたのIDのままです
            response_type: "code",
            state: "",
            prompt: "none",
            scope: ["identify"]
        });
        console.log("🟢ステップ2完了: code取得成功 ->", code);

        document.getElementById('status').innerText = '認証中 (2/3)...';

        console.log("🔴ステップ3: tokenリクエスト...");
        const response = await fetch("/api/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code })
        });
        const data = await response.json();
        console.log("🟢ステップ3完了: tokenデータ取得 ->", data);

        // ★もしサーバー側でエラーが起きて鍵がもらえなかったら、ここで止める
        if (!data.access_token) {
            throw new Error(`サーバーから鍵がもらえませんでした！中身: ${JSON.stringify(data)}`);
        }

        document.getElementById('status').innerText = '認証中 (3/3)...';

        console.log("🔴ステップ4: authenticateリクエスト...");
        const authResult = await discordSdk.commands.authenticate({ access_token: data.access_token });
        console.log("🟢ステップ4完了: 認証成功！", authResult);

        currentUserId = authResult.user.id;
        document.getElementById('status').innerText = `ユーザー名: ${authResult.user.username} (同期完了)`;

        fetchFP();

    } catch (error) {
        console.error("💥エラー発生💥:", error);
        if (error.message) console.error("詳細:", error.message);
        document.getElementById('status').innerText = 'エラー：処理が途中で止まりました';
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