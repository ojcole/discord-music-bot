import { Awaitable, ButtonInteraction, Channel, Guild } from "discord.js";
import { getPlayer, Player } from "../music/player";
import { createResponse } from "./common";

interface Handler {
  match: RegExp;
  func: (message: ButtonInteraction) => Awaitable<void>;
}

const withGuildAndChannel = (
  message: ButtonInteraction,
  func: (guild: Guild, channel: Channel) => void
) => {
  const guild = message.guild;
  const member = guild?.members.cache.get(message.user.id);
  const voiceChannel = member?.voice.channel;
  if (voiceChannel !== undefined && voiceChannel !== null && guild !== null) {
    func(guild, voiceChannel);
  }
};

const withPlayer = (
  message: ButtonInteraction,
  func: (player: Player) => void
) => {
  withGuildAndChannel(message, (guild, channel) => {
    const player = getPlayer(guild, channel);
    if (player === undefined) return;
    func(player);
  });
};

const updateMessage = (
  message: ButtonInteraction,
  id: bigint = 0n,
  deleted: boolean = false,
  bumped: boolean = false
) => {
  const oldMessage = message.message.content;
  const newMessage = createResponse(oldMessage, id, deleted, bumped);
  message.update(newMessage);
};

const removeSongMatch = /^song_remove_(-)?[0-9]+$/gi;
const removeSong = (message: ButtonInteraction) => {
  const splits = message.customId.split("_");
  const id = BigInt(splits[splits.length - 1]);
  withPlayer(message, (player) => {
    updateMessage(message, 0n, true);
    player.removeFromQueue(id);
  });
};

const bumpSongMatch = /^song_bump_(-)?[0-9]+$/gi;
const bumpSong = (message: ButtonInteraction) => {
  const splits = message.customId.split("_");
  const id = BigInt(splits[splits.length - 1]);
  withPlayer(message, (player) => {
    const newId = player.bumpToFront(id);
    if (newId !== 0n) {
      updateMessage(message, newId, false, true);
    } else {
      updateMessage(message, 0n, true);
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
      func(message);
      break;
    }
  }
};

export { buttonRouter };
