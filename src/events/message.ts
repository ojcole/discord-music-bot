import { Client } from "discord.js";
import { messageRouter } from "../handlers/message";

const registerMessageEvents = (client: Client) => {
  client.on("messageCreate", async (message) => {
    if (message.author.bot) {
      return;
    }
    await messageRouter(message);
  });

  client.on("messageDelete", async (message) => {
    console.log(`message is deleted -> ${message}`);
  });

  client.on("messageDeleteBulk", async (messages) => {
    console.log(`messages are deleted -> ${messages}`);
  });

  client.on("messageReactionAdd", async (messageReaction, user) => {
    console.log(`a reaction is added to a message`);
  });

  client.on("messageReactionRemove", async (messageReaction, user) => {
    console.log(`a reaction is removed from a message`);
  });

  client.on("messageReactionRemoveAll", async (message) => {
    console.error(`all reactions are removed from a message`);
  });

  client.on("messageUpdate", async (oldMessage, newMessage) => {
    console.log(`a message is updated`);
  });

  client.on("typingStart", async (typing) => {
    console.log(`${typing.user.username} has started typing`);
  });

  client.on("typingStop", async (channel, user) => {
    console.log(`${user.tag} has stopped typing`);
  });
};

export { registerMessageEvents };
