import { Awaitable, ButtonInteraction, Channel, Guild } from "discord.js";
import { getPlayer, Player } from "../music/player";
import { createResponse } from "./common";

interface Handler {
  match: RegExp;
  func: (message: ButtonInteraction) => Awaitable<void>;
}

const withGuildAndChannel = async (
  message: ButtonInteraction,
  func: (guild: Guild, channel: Channel) => Awaitable<void>
) => {
  const guild = message.guild;
  const member = guild?.members.cache.get(message.user.id);
  const voiceChannel = member?.voice.channel;
  if (voiceChannel !== undefined && voiceChannel !== null && guild !== null) {
    await func(guild, voiceChannel);
  }
};

const withPlayer = async (
  message: ButtonInteraction,
  func: (player: Player) => Awaitable<void>
) => {
  await withGuildAndChannel(message, async (guild, channel) => {
    const player = getPlayer(guild, channel);
    if (player === undefined) return;
    await func(player);
  });
};

const updateMessage = async (
  message: ButtonInteraction,
  id: bigint = 0n,
  deleted: boolean = false,
  bumped: boolean = false
) => {
  const oldMessage = message.message.content;
  const newMessage = createResponse(oldMessage, id, deleted, bumped);
  await message.update(newMessage);
};

const removeSongMatch = /^song_remove_(-)?[0-9]+$/gi;
const removeSong = async (message: ButtonInteraction) => {
  const splits = message.customId.split("_");
  const id = BigInt(splits[splits.length - 1]);
  withPlayer(message, async (player) => {
    await updateMessage(message, 0n, true);
    await player.removeFromQueue(id);
  });
};

const bumpSongMatch = /^song_bump_(-)?[0-9]+$/gi;
const bumpSong = (message: ButtonInteraction) => {
  const splits = message.customId.split("_");
  const id = BigInt(splits[splits.length - 1]);
  withPlayer(message, async (player) => {
    const newId = await player.bumpToFront(id);
    if (newId !== 0n) {
      await updateMessage(message, newId, false, true);
    } else {
      await updateMessage(message, 0n, true);
    }
  });
};

const handlers: Handler[] = [
  { match: removeSongMatch, func: removeSong },
  { match: bumpSongMatch, func: bumpSong },
];

const buttonRouter = async (message: ButtonInteraction) => {
  const customId = message.customId;
  for (const { match, func } of handlers) {
    if (customId.match(match)) {
      await func(message);
      break;
    }
  }
};

export { buttonRouter };
