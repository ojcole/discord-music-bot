import { Client } from "discord.js";

const registerChannelEvents = (client: Client) => {
  client.on("channelDelete", (channel) => {
    console.log(`channelDelete: ${channel}`);
  });

  client.on("channelPinsUpdate", (channel, time) => {
    console.log(`channelPinsUpdate: ${channel}:${time}`);
  });

  client.on("channelUpdate", (oldChannel, newChannel) => {
    console.log(
      `channelUpdate -> a channel is updated - e.g. name change, topic change`
    );
  });
};

export { registerChannelEvents };
