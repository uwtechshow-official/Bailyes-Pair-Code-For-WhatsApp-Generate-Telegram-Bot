const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const path = require('path');
const pino = require('pino');
const { default: makeWASocket, Browsers, delay, useMultiFileAuthState, fetchLatestBaileysVersion, PHONENUMBER_MCC, makeCacheableSignalKeyStore, jidNormalizedUser } = require("@whiskeysockets/baileys");
const Pino = require("pino");
const NodeCache = require("node-cache");

let chalk;
(async () => {
  const chalkModule = await import("chalk");
  chalk = chalkModule.default || chalkModule;
})();

const token = '7155023127:AAGxDrPQ7m47HWCgRzYrQh2zWLUMqGU0Ep4';
const bot = new TelegramBot(token, { polling: true });
const phoneNumberPattern = /^\+\d{10,15}$/;

console.log("Telegram bot started");

bot.onText(/\/start/, (msg) => {
  console.log("Received /start command");
  bot.sendMessage(msg.chat.id, 'Welcome!\nThis Bot Is Made For Generating Pair Code Or QR Code For Connecting A Bot With WhatsApp Using Baileys Library.\nPlease enter your WhatsApp phone number in international format (e.g., +94758900210):\n\nThis Is Project A By Udavin Wijesundara.');
});

bot.on('message', async (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (text.match(phoneNumberPattern)) {
    console.log(`Received phone number: ${text}`);
    let phoneNumber = text.replace(/[^0-9]/g, '');
    if (!Object.keys(PHONENUMBER_MCC).some(v => phoneNumber.startsWith(v))) {
      console.log(`Invalid phone number: ${text}`);
      bot.sendMessage(chatId, 'Invalid phone number. Start with the country code of your WhatsApp number, e.g., +94758900210');
      return;
    }

    bot.sendMessage(chatId, `Generating Pair code... ⏳`);
    clearSessionsFolder(); 
    await startWhatsAppBot(phoneNumber, chatId);
  }
});

function clearSessionsFolder() {
  console.log("Clearing sessions folder...");
  fs.readdir('./sessions', (err, files) => {
    if (err) {
      console.error('Error reading sessions folder:', err);
      return;
    }

    for (const file of files) {
      fs.unlink(path.join('./sessions', file), err => {
        if (err) {
          console.error('Error deleting session file:', err);
        }
      });
    }
  });
  console.log("Sessions folder cleared");
}

async function startWhatsAppBot(phoneNumber, chatId) {
  console.log("Starting WhatsApp bot...");
  let { version, isLatest } = await fetchLatestBaileysVersion();
  const { state, saveCreds } = await useMultiFileAuthState('./sessions');
  const msgRetryCounterCache = new NodeCache();
  const XeonBotInc = makeWASocket({
    logger: pino({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.windows('Firefox'),
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: "fatal" }).child({ level: "fatal" })),
    },
    markOnlineOnConnect: true,
    generateHighQualityLinkPreview: true,
    getMessage: async (key) => {
      let jid = jidNormalizedUser(key.remoteJid);
      let msg = await store.loadMessage(jid, key.id);
      return msg?.message || "";
    },
    msgRetryCounterCache,
    defaultQueryTimeoutMs: undefined,
  });

  XeonBotInc.ev.on("connection.update", async (s) => {
    const { connection, lastDisconnect } = s;
    if (connection == "open") {
      console.log("WhatsApp connection opened");
      await delay(1000 * 10);
      await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: "This Project Is Developed By Udavin Wijesundara\n\n⎆WhatsApp Pm: Wa.me/94758900210\n⎆Instagram: https://instagram.com/udavin_wijesundara?igshid=OGQ5ZDc2ODk2ZA==\nWe Have Sent The Creds.json File\n *Keep It Safe*" });
      
      let sessionXeon = fs.readFileSync('./sessions/creds.json');
      await delay(1000 * 2);
      const xeonses = await XeonBotInc.sendMessage(XeonBotInc.user.id, { document: sessionXeon, mimetype: "application/json", fileName: "creds.json" });
      await XeonBotInc.sendMessage(XeonBotInc.user.id, { text: "Here Is Your Creds.json,\n*🚨Dont Share This Code🚨* \n\n> ©Udavin Wijesundara 2024" }, { quoted: xeonses });

      console.log("Session file sent to user");

      clearSessionsFolder();

      XeonBotInc.ws.close();
      console.log("WhatsApp connection closed");
      bot.sendMessage(chatId, 'Connected Sucessfully.');
    }

    if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
      console.log("Connection closed, restarting WhatsApp bot...");
      startWhatsAppBot(phoneNumber, chatId);
    }
  });

  XeonBotInc.ev.on('creds.update', saveCreds);
  XeonBotInc.ev.on("messages.upsert", () => { });

  if (!XeonBotInc.authState.creds.registered) {
    console.log("Requesting pairing code...");
    setTimeout(async () => {
      let code = await XeonBotInc.requestPairingCode(phoneNumber);
      code = code?.match(/.{1,4}/g)?.join("-") || code;
      bot.sendMessage(chatId, `Your Pairing Code Is`);
      bot.sendMessage(chatId, `${code}`);
      console.log(`Pairing code sent to user`);
    }, 3000);
  }
}

process.on('uncaughtException', function (err) {
  let e = String(err);
  if (e.includes("conflict")) return;
  if (e.includes("not-authorized")) return;
  if (e.includes("Socket connection timeout")) return;
  if (e.includes("rate-overlimit")) return;
  if (e.includes("Connection Closed")) return;
  if (e.includes("Timed Out")) return;
  if (e.includes("Value not found")) return;
  console.log('Caught exception: ', err);
});
