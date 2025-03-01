// ★★★ APIキーはソースコードに直書きしないことが推奨です ★★★
// 必要に応じて、環境変数やサーバー側の設定を利用してください。
// ここでは簡単のために「YOUR_API_KEY_HERE」というプレースホルダを使います。
const apiKey = "YOUR_API_KEY_HERE";

// リトライの遅延を設定（デフォルトは60秒）
const defaultRetryDelay = 60000; // 60秒
const maxRetries = 2;    // 最大2回リトライ

let progressInterval;
let progressStartTime;

/**
 * プログレスバーのアニメーションを開始
 */
function startProgress() {
  const progressBar = document.getElementById("progress-bar");
  progressStartTime = Date.now();
  progressBar.style.width = "0%";

  // 100msごとに進捗を更新
  progressInterval = setInterval(() => {
    const elapsed = Date.now() - progressStartTime;
    // 指数関数的に増やし、最大99%まで
    let progress = 100 * (1 - Math.exp(-elapsed / 2000));
    if (progress > 99) progress = 99;
    progressBar.style.width = progress + "%";
  }, 100);
}

/**
 * プログレスバーを100%にして終了
 */
function finishProgress() {
  clearInterval(progressInterval);
  const progressBar = document.getElementById("progress-bar");
  // APIコール完了時に100%へ
  progressBar.style.width = "100%";
  // 少し待ってからプログレスバーを非表示
  setTimeout(() => {
    document.getElementById("progress-container").classList.add("hidden");
    progressBar.style.width = "0%";
  }, 300);
}

/**
 * フォーム送信イベントを監視
 */
document.getElementById("travel-form").addEventListener("submit", async function(event) {
    event.preventDefault();
    const submitBtn = document.getElementById("submit-btn");

    // ボタンを無効化し、プログレスバーを表示
    submitBtn.disabled = true;
    document.getElementById("progress-container").classList.remove("hidden");
    startProgress();

    // フォームからデータを取得
    const destination = document.getElementById("destination").value;
    const people = document.getElementById("people").value;
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;
    const activities = document.getElementById("activities").value;

    // ChatGPT APIに送るプロンプトを作成
    const prompt = `旅行計画を作成してください: 行きたい場所: ${destination}, 人数: ${people}人, 日程: ${startDate}から${endDate}, やりたいこと: ${activities}`;

    try {
        // リトライ付きでAPIリクエストを送信
        await sendRequestWithRetry(prompt, 0);
    } catch (error) {
        console.error("Error:", error);
        displayPlan(`旅行計画を取得できませんでした。エラー: ${error.message}`);
    } finally {
        finishProgress();
        submitBtn.disabled = false;
    }
});

/**
 * APIリクエストのリトライ処理を行う関数
 */
async function sendRequestWithRetry(prompt, retryCount) {
    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4-turbo",
                messages: [
                  { role: "system", content: "あなたは旅行プランナーです。" },
                  { role: "user", content: prompt }
                ],
                max_tokens: 1000
            })
        });

        if (!response.ok) {
            // レートリミット(429)対応
            if (response.status === 429 && retryCount < maxRetries) {
                const retryAfter = response.headers.get("Retry-After");
                const delayTime = retryAfter
                  ? parseInt(retryAfter, 10) * 1000
                  : defaultRetryDelay * Math.pow(2, retryCount);

                console.log(
                  `429エラー。${delayTime / 1000}秒後にリトライします... (試行回数: ${retryCount + 1}/${maxRetries})`
                );
                await delay(delayTime);
                return sendRequestWithRetry(prompt, retryCount + 1);
            } else {
                throw new Error(`Error: ${response.status} - ${response.statusText}`);
            }
        }

        const data = await response.json();
        if (data.choices && data.choices.length > 0) {
            displayPlan(data.choices[0].message.content);
        } else {
            throw new Error("APIから正しいデータが返されませんでした。");
        }
    } catch (error) {
        throw error;
    }
}

/**
 * 遅延を追加する関数
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 生成された旅行計画を画面に表示する関数
 */
function displayPlan(plan) {
    const planContainer = document.getElementById("travel-plan");
    planContainer.innerText = plan;
}
