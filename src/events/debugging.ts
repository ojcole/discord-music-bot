import { Client } from "discord.js";

const registerDebuggingEvents = (client: Client) => {
  client.on("debug", (info) => {
    // console.log(`debug -> ${info}`);
  });

  client.on("disconnect", (event) => {
    console.log(
      `The WebSocket has closed and will no longer attempt to reconnect`
    );
  });

  client.on("error", (error) => {
    console.error(
      `client's WebSocket encountered a connection error: ${error}`
    );
  });

  client.on("reconnecting", () => {
    console.log(`client tries to reconnect to the WebSocket`);
  });

  client.on("resume", (replayed) => {
    console.log(`whenever a WebSocket resumes, ${replayed} replays`);
  });

  client.on("warn", (info) => {
    console.log(`warn: ${info}`);
  });
};

export { registerDebuggingEvents };
