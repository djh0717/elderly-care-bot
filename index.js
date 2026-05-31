const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

app.post("/webhook", line.middleware(config), async (req, res) => {
  for (const event of req.body.events) {

    if (event.type !== "message") continue;

    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "收到：" + event.message.text
    });
  }

  res.sendStatus(200);
});

app.get("/", (req, res) => {
  res.send("LINE BOT RUNNING");
});

app.listen(process.env.PORT || 3000);
