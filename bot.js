/* Copyright (C) 2020 Yusuf Usta.
Licensed under the  GPL-3.0 License;
you may not use this file except in compliance with the License.
WhatsAsena - Yusuf Usta
*/

const fs = require("fs");
const path = require("path");
const events = require("./events");
const chalk = require('chalk');
const config = require('./config');
const {WAConnection, MessageOptions, MessageType, Mimetype, Presence} = require('@adiwajshing/baileys');
const {Message, StringSession, Image, Video} = require('./julie/');
const { DataTypes } = require('sequelize');
const { getMessage } = require("./plugins/sql/greetings");
const axios = require('axios');
const got = require('got');

// Sql
const WhatsAsenaDB = config.DATABASE.define('WhatsAsena', {
    info: {
      type: DataTypes.STRING,
      allowNull: false
    },
    value: {
        type: DataTypes.TEXT,
        allowNull: false
    }
});

fs.readdirSync('./plugins/sql/').forEach(plugin => {
    if(path.extname(plugin).toLowerCase() == '.js') {
        require('./plugins/sql/' + plugin);
    }
});

const plugindb = require('./plugins/sql/plugin');

// Yalnızca bir kolaylık. https://stackoverflow.com/questions/4974238/javascript-equivalent-of-pythons-format-function //
String.prototype.format = function () {
  var i = 0,
    args = arguments
  return this.replace(/{}/g, function () {
    return typeof args[i] != "undefined" ? args[i++] : ""
  })
}

if (!Date.now) {
  Date.now = function () {
    return new Date().getTime()
  }
}

Array.prototype.remove = function () {
  var what,
    a = arguments,
    L = a.length,
    ax
  while (L && this.length) {
    what = a[--L]
    while ((ax = this.indexOf(what)) !== -1) {
      this.splice(ax, 1)
    }
  }
  return this
}

async function whatsAsena(version) {
  await config.DATABASE.sync()
  let StrSes_Db = await WhatsAsenaDB.findAll({
    where: {
      info: "StringSession",
    },
  })
  const conn = new WAConnection()
  conn.version = version
  const Session = new StringSession()
  conn.logger.level = config.DEBUG ? "debug" : "warn"
  var nodb

  if (StrSes_Db.length < 1 || config.CLR_SESSION) {
    nodb = true
    conn.loadAuthInfo(Session.deCrypt(config.SESSION))
  } else {
    conn.loadAuthInfo(Session.deCrypt(StrSes_Db[0].dataValues.value))
  }

  conn.on("connecting", () => {
    console.log(`${chalk.red.bgBlack("B")}${chalk.green.bgBlack(
      "o"
    )}${chalk.blue.bgBlack("t")}${chalk.yellow.bgBlack(
      "t"
    )}${chalk.white.bgBlack("u")}${chalk.magenta.bgBlack("s")}
${chalk.white.bold.bgBlack("Version:")} ${chalk.red.bold.bgBlack(
      config.VERSION
    )}
${chalk.blue.italic.bgBlack("ℹ️ Connecting to WhatsApp... Please wait.")}`)
  })
  conn.on("open", async () => {
    console.log(chalk.green.bold("✅ Login successful!"))
    console.log(chalk.blueBright.italic("⬇️ Installing external plugins..."))
    console.log(chalk.blueBright.italic("✅ Login information updated!"))

    const authInfo = conn.base64EncodedAuthInfo()
    if (StrSes_Db.length < 1) {
      await WhatsAsenaDB.create({
        info: "StringSession",
        value: Session.createStringSession(authInfo),
      })
    } else {
      await StrSes_Db[0].update({
        value: Session.createStringSession(authInfo),
      })
    }

    let plugins = await PluginDB.findAll()
    plugins.map(async (plugin) => {
      try {
        if (!fs.existsSync("./plugins/" + plugin.dataValues.name + ".js")) {
          console.log(plugin.dataValues.name)
          let response = await got(plugin.dataValues.url)
          if (response.statusCode == 200) {
            fs.writeFileSync(
              "./plugins/" + plugin.dataValues.name + ".js",
              response.body
            )
            require("./plugins/" + plugin.dataValues.name + ".js")
          }
        }
      } catch (error) {
        console.log(
          `failed to load external plugin : ${plugin.dataValues.name}`
        )
      }
    })
    console.log(chalk.blueBright.italic("⬇️  Installing plugins..."))

    fs.readdirSync("./plugins").forEach((plugin) => {
      if (path.extname(plugin).toLowerCase() == ".js") {
        require("./plugins/" + plugin)
      }
    })

    console.log(chalk.green.bold("✅ Plugins installed!"))
    await conn.sendMessage(
      conn.user.jid,
      await startMessage(),
      MessageType.text,
      { detectLinks: false }
    )
  })
  conn.on("close", (e) => console.log(e.reason))

  await groupMuteSchuler(conn)
  await groupUnmuteSchuler(conn)
  await customMessageScheduler(conn)

  conn.on("chat-update", (m) => {
    if (!m.hasNewMessage) return
    if (!m.messages && !m.count) return
    const { messages } = m
    const all = messages.all()
    handleMessages(all[0], conn)
  })

  try {
    await conn.connect()
  } catch (e) {
    if (!nodb) {
      console.log(chalk.red.bold("Eski sürüm stringiniz yenileniyor..."))
      conn.loadAuthInfo(Session.deCrypt(config.SESSION))
      try {
        await conn.connect()
      } catch (e) {
        return
      }
    } else console.log(`${e.message}`)
  }
}

;(async () => {
  await prepareGreetingMedia()
  whatsAsena(await waWebVersion())
})()
