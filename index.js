const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// 暫時先用記憶體紀錄，之後再接 Google Sheet
const userRecords = {};

app.post("/webhook", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;

    for (const event of events) {
      if (event.type !== "message") continue;
      if (event.message.type !== "text") continue;

      const userId = event.source.userId;
      const text = event.message.text.trim();

      if (!userRecords[userId]) {
        userRecords[userId] = {
          lastMedicineTime: null
        };
      }

      let replyText = "";

      if (text === "我已吃藥") {
        const now = new Date();
        userRecords[userId].lastMedicineTime = now;

        replyText =
          "✅ 已記錄您吃藥了\n" +
          "時間：" + now.toLocaleString("zh-TW", { timeZone: "Asia/Taipei" });
      } else if (text === "今天提醒") {
        replyText =
          "📅 今天提醒\n\n" +
          "💊 早上 08:00 吃早餐藥\n" +
          "💊 中午 12:00 吃午餐藥\n" +
          "💊 晚上 18:00 吃晚餐藥\n\n" +
          "吃完請按「我已吃藥」。";
      } else if (text === "防詐幫忙") {
        replyText =
          "🛡️ 防詐提醒\n\n" +
          "如果有人要求你：\n" +
          "1. 匯款\n" +
          "2. 提供密碼\n" +
          "3. 操作 ATM\n" +
          "4. 點不明連結\n\n" +
          "請先不要做，先聯絡家人確認。";
      } else if (text === "我要叫車") {
        replyText =
          "🚕 已收到叫車需求\n\n" +
          "請先確認：\n" +
          "1. 目前位置\n" +
          "2. 要去的地方\n\n" +
          "之後可以加入通知家人或叫車連結。";
      } else if (text === "聯絡家人") {
        replyText =
          "👨‍👩‍👧 已收到聯絡家人的需求\n\n" +
          "目前測試版先回覆確認。\n" +
          "下一版會直接推播通知家人。";
      } else if (text === "緊急求助") {
        replyText =
          "🆘 緊急求助已送出\n\n" +
          "請保持手機暢通，家人會盡快聯絡您。";
      } else {
        replyText =
          "請點選下方功能：\n\n" +
          "💊 我已吃藥\n" +
          "📅 今天提醒\n" +
          "🛡️ 防詐幫忙\n" +
          "🚕 我要叫車\n" +
          "👨‍👩‍👧 聯絡家人\n" +
          "🆘 緊急求助";
      }
let replyText = "";

if (userText === "我已吃藥") {
  replyText = "✅ 已記錄您今天的服藥時間";
}

else if (userText === "今日提醒") {
  replyText = "📅 今天提醒：\n1. 早上吃藥\n2. 下午散步30分鐘";
}

else if (userText === "防詐騙") {
  replyText = "🛡️ 防詐騙提醒：\n陌生來電要求匯款請立即掛斷。";
}

else if (userText === "我要叫車") {
  replyText = "🚕 可撥打 55688 台灣大車隊";
}

else if (userText === "聯絡家人") {
  replyText = "👨‍👩‍👧 已通知家人與您聯絡";
}

else if (userText === "緊急求助") {
  replyText = "🚨 緊急求助已送出，請稍候。";
}

else {
  replyText = "收到：" + userText;
}

await client.replyMessage(event.replyToken, {
  type: "text",
  text: replyText
});
    }

    res.sendStatus(200);
  } catch (error) {
    console.error(error);
    res.sendStatus(500);
  }
});

app.get("/", (req, res) => {
  res.send("LINE BOT RUNNING");
});

app.listen(process.env.PORT || 3000);
