const Discord = require("discord.js");
require("require-sql"); // Package needed

const { COLOR, IMG } = require("./ressources.json"); // Ressources required for the system

const { insertSQL } = require("./SQL/INSERT/insertSQL"); // Get the SQL insert function for the Reminder obj
const { dateToString, buildTimeLeft, timeLeft } = require("./dateTools");
const { con } = require("./utils/mysql"); // Get the mysql connexioon object

/** All the READ/SELECT SQL request needed */
const query_Reminder = require("./SQL/READ/SELECT_REMINDER.sql");
const query_Users = require("./SQL/READ/SELECT_USERS.sql");
const query_userHAS = require("./SQL/READ/USER_HAS_REMINDER");
const query_Find = require("./SQL/READ/SELECT_ALL_USERS_REMINDER.sql");

/** All the DELETE SQL request needed */
const query_clear_user = require("./SQL/DELETE/CLEAR_USERS.sql");
const query_clear_concerner = require("./SQL/DELETE/CLEAR_CONCERNER.sql");
const query_clear_reminder = require("./SQL/DELETE/CLEAR_REMINDER.sql");

const { client } = require("./utils/client"); // Get Discord Client

/**
 * remindMe Class
 *
 * @author Zaorhion
 */
module.exports = class createReminderObject {
  /**
   * @typedef {Object} ReminderObject
   * @property {Date} target_date
   * @property {Date} entry_date
   * @property {String} remind
   * @property {Array.<Discord.User>} users_id
   *
   */

  /**
   * Input Reminder
   * @param {Discord.Message} msg
   * @return {ReminderObject} The object with all the reminder's information
   */
  static async remindMe(msg) {
    let args = msg.content.split(" ");
    //*  Checking & validation of the arguments |BEGINING]*/
    //  Check if all argument exists
    if (!args[1]) return msg.reply("Please enter a date !");
    if (!args[2]) return msg.reply("Please enter a time !");
    if (!args[3]) return msg.reply("Please enter a label !");

    // === Date verification ===
    let date = args[1];
    let date_array = date.split("/");

    if (!date_array[1]) return msg.reply("Please enter a month !");
    // Check if all the date input are valid numbers
    let result_test = true;
    for (let i = 0; i < date_array.length; i++) {
      if (isNaN(date_array[i])) {
        result_test = false;
      }
    }
    // If input value are not valid numbers
    if (!result_test)
      return msg.reply("Please enter numeric values ​​for the date !");

    let day = date_array[0]; //Get day
    let splited_day = day.split(""); //Get divided day numbers
    let month = date_array[1]; //Get month
    let splited_month = month.split(""); //Get divided month numbers
    let current_date = new Date(); //Get full current date
    let current_year = current_date.getFullYear(); //Get current year
    let year = date_array[2] || current_year; //Get targeted year, if not, current year

    // Add zero to the day number if necessary
    if (!splited_day[1]) {
      day = "0" + splited_day[0];
    }

    // Add zero to the day month if necessary
    if (!splited_month[1]) {
      month = "0" + splited_month[0];
    }

    let day_byMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Day by month
    // Month Field overrun
    if (month > 12 || month < 1)
      return msg.reply("Please enter a valid month !");
    // Day Field overrun depending on the month
    if (day > day_byMonth[month - 1])
      return msg.reply("Please enter a valid day !");
    // Year Field overrun
    if (year < current_year || year > current_year + 2)
      return msg.reply("Please enter a valid year !");

    // === Time verification ===
    let time = args[2];
    let time_array = time.split("h") || time.split("H");

    // Check if minutes input exit
    if (!time_array[1]) time_array[1] = "00";
    // Check if all time input are number
    result_test = true;
    for (let i = 0; i < time_array.length; i++) {
      if (isNaN(time_array[i])) {
        result_test = false;
      }
    }
    if (!result_test)
      return msg.reply("Please enter numeric values ​​for time !");

    let hour = time_array[0]; // Get hour
    let splited_hour = hour.split(""); // Get spilted hour numbers
    let minute = time_array[1]; // Get minutes
    let splited_minute = minute.split(""); // Get splited minutes numbers

    // Add zero to the hour number if necessary
    if (!splited_hour[1]) {
      hour = "0" + splited_hour[0];
    }

    // Add zero to the minutes number if necessary
    if (!splited_minute[1]) {
      minute = "0" + splited_minute[0];
    }

    // Hour Field overrun
    if (hour > 23 || hour < 0) return msg.reply("Please enter valid hours !");
    // Minutes Field overrun
    if (minute > 59 || minute < 0)
      return msg.reply("Please enter valid minutes!");

    // Formated date
    let target_date = new Date(`${year}-${month}-${day}T${hour}:${minute}:00`);

    // Check if date is before the current date
    if (target_date < current_date)
      return msg.reply("Please enter a future date !");
    //*  Checking & validation of the arguments |END]*/

    let remind = args.slice(3).join(" "); // Reminder title

    let users_id = [msg.author.id]; // Array of user who'll receive the reminder

    await insertSQL({ target_date, current_date, remind, users_id }); // Add the Reminder object to the SQL Databse

    // Validation Embed
    let embed = new Discord.MessageEmbed()
      .setTitle("⚙️ | Your reminder has been added !")
      .setColor(COLOR.MAIN_COLOR)
      .setFooter({
        text: `Asked by : ${msg.author.tag}`,
        iconURL: msg.author.avatarURL(),
      })
      .setTimestamp()
      .setThumbnail(IMG.REMINDER_LOGO);

    msg.channel.send({ embeds: [embed] }); // Send the confirmation embed
  }

  /**
   * Loop checking reminders to launch
   *
   * @public
   *
   */
  static remindCheck() {
    setTimeout(function () {
      let REMINDER;
      con.query(
        // Check if Reminder have to be launched
        query_Reminder,
        [new Date()],
        async function (err, results, fields) {
          if (!err) REMINDER = JSON.parse(JSON.stringify(results));
          if (!REMINDER) return;
          if (REMINDER.length === 0) return;
          console.log(`${REMINDER.length} rappel(s) demandé(s)`);

          for (let i = 0; i < REMINDER.length; i++) {
            // Loop on all the valid reminder

            let embedReminder = new Discord.MessageEmbed() // Embed Reminder Constructor
              .setTitle("You have a reminder !")
              .setColor("RANDOM")
              .addField("🗨️ | Reminder Label : ", REMINDER[i].remind)
              .addField(
                "🕔 | Reminder Date : ",
                "``" + REMINDER[i].c_date + "``",
                true
              )
              .addField(
                "🕣 | Reminder Target Date  : ",
                "``" + REMINDER[i].t_date + "``",
                true
              )
              .addField("#️⃣ | Reminder ID : ", `#${REMINDER[i].id_reminder}`)
              .setFooter({ text: "Provided by Kairos | Reminder Bot" })
              .setThumbnail(IMG.REMINDER_LOGO);

            let USER;
            con.query(
              // Find all targeted user for the Reminder
              query_Users,
              [REMINDER[i].id_reminder],
              async function (err, results, fields) {
                if (!err) USER = JSON.parse(JSON.stringify(results));
                if (USER.length === 0) return;
                for (let u = 0; u < USER.length; u++) {
                  // Loop on all the users to send the reminder
                  try {
                    let user = await client.users.cache.find(
                      (user) => user.id === USER[u].id_user
                    );
                    await user.send({ embeds: [embedReminder] });
                  } catch (err) {
                    console.log(err);
                  }
                  con.query(
                    // Clear the row of the Join table
                    // This need to be clear the first
                    //because of the foreign keys
                    query_clear_concerner,
                    [REMINDER[i].id_reminder],
                    function (err, result, fileds) {
                      con.query(
                        //Check if the user got another reminder
                        query_userHAS,
                        [USER[u].id_user],
                        function (err, result, fields) {
                          if (result.length === 0) {
                            // If user got another reminder, don't erase it
                            con.query(query_clear_user, [USER[u].id_user]);
                          }
                        }
                      );
                    }
                  );
                }
                con.query(
                  // Clear the Reminder Object from de Database
                  query_clear_reminder,
                  [REMINDER[i].id_reminder],
                  function (err, result, fields) {
                    if (err) throw err;
                  }
                );
              }
            );
          }
        }
      );
      createReminderObject.remindCheck(); // Recursive Function
    }, 60 * 1000); // Check every minutes
  }

  /**
   * Display all the reminders from the message author
   * @param {Discord.Message} msg
   */
  static myReminder(msg) {
    let id_user = msg.author.id;

    con.query(query_Find, [id_user], async function (err, results, fields) {
      if (err) return msg.reply("An error has occurred !");

      let reminders = JSON.parse(JSON.stringify(results));

      if (reminders.length == 0) return msg.reply("You have no reminder !");

      let embed = new Discord.MessageEmbed()
        .setTitle("My ongoing reminders : ")
        .setColor("DARK_BUT_NOT_BLACK")
        .setFooter({ text: "Provided by Kairos | Reminder Bot" })
        .setTimestamp();
      let new_text = "";
      for (let i = 0; i < reminders.length; i++) {
        new_text +=
          `**- ${reminders[i].remind}** \n ${dateToString(
            new Date(reminders[i].t_date)
          )} \n` +
          "``" +
          buildTimeLeft(
            new Date(reminders[i].t_date),
            new Date(reminders[i].c_date)
          ) +
          "``" +
          timeLeft(new Date(reminders[i].t_date).getTime()) +
          "\n";
      }
      embed.setDescription(new_text);
      msg.channel.send({ embeds: [embed] });
    });
  }

  /**
   *
   * @param {Discord.Message} msg
   */
  static deleteReminder(msg) {
    let id_user = msg.author.id;

    con.query(query_Find, [id_user], async function (err, results, fields) {
      if (err) return msg.reply("An error has occurred !");

      let reminders = JSON.parse(JSON.stringify(results));

      if (reminders.length == 0)
        return msg.reply("You have no reminder to delete !");

      let embed = new Discord.MessageEmbed()
        .setTitle("My ongoing Reminders : ")
        .setColor("DARK_RED")
        .setFooter({ text: "Provided by Kairos | Reminder Bot" })
        .setTimestamp();
      let final_text = "";
      let reminders_objects = [];

      for (let i = 0; i < reminders.length; i++) {
        final_text =
          final_text +
          `**- [${i + 1}] ${reminders[i].remind}** \n` +
          "``" +
          `${dateToString(new Date(reminders[i].t_date))}` +
          "``\n\n";

        reminders_objects[i] = {
          remind: reminders[i].remind,
          id_reminder: reminders[i].id_reminder,
        };
      }

      embed.setDescription(final_text);

      let msg_embed = await msg.channel.send({ embeds: [embed] });

      const filter = (m) => {
        if (!isNaN(Number(m.content))) {
          if (Number(m.content) <= reminders.length && Number(m.content >= 1)) {
            return true;
          }
        }
      };

      const collector = msg.channel.createMessageCollector({
        filter: filter,
        max: 1,
        time: 1000 * 60 * 10,
        errors: ["time"],
      });

      collector.on("collect", async (m) => {
        let target_reminder = reminders_objects[Number(m.content) - 1];
        let id_reminder = target_reminder.id_reminder;

        try {
          await con.query(
            query_clear_concerner,
            [id_reminder],
            function (err, result, fileds) {
              con.query(
                query_userHAS,
                [id_user],
                function (err, result, fields) {
                  if (result.length === 0) {
                    // If user got another reminder, don't erase it
                    con.query(query_clear_user, [id_user]);
                  }
                }
              );
            }
          );

          await con.query(
            // Clear the Reminder Object from de Database
            query_clear_reminder,
            [id_reminder],
            function (err, result, fields) {
              if (err) throw err;
            }
          );

          await msg.reply(
            `Reminder number ${m.content} has been successfully deleted !`
          );
          await m.delete();
          await msg_embed.delete();
        } catch (err) {
          console.log(err);
          msg.reply("An error has occurred !");
        }
      });
    });
  }

  static clearReminder(id_reminder) {}
};
