import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnection,
} from "@discordjs/voice";
import { Channel, Guild } from "discord.js";
import ytdl from "ytdl-core-discord";

// import * as path from "path";

class Player {
  queue: string[] = [];
  connection: VoiceConnection;
  audioPlayer: AudioPlayer;
  guild: Guild;
  channelId: string;

  constructor(guild: Guild, channel: Channel) {
    this.guild = guild;
    this.channelId = channel.id;

    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Play,
      },
    });
    this.audioPlayer.on(AudioPlayerStatus.Idle, () => {
      this.checkPlay();
    });

    this.connection = joinVoiceChannel({
      guildId: this.guild.id,
      channelId: channel.id,
      adapterCreator: this.guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false,
    });
    this.connection.subscribe(this.audioPlayer);
  }

  public setVoiceChannel = (channel: Channel, move: boolean): boolean => {
    if (this.channelId === channel.id) return true;
    if (!move) return false;
    this.connection = joinVoiceChannel({
      guildId: this.guild.id,
      channelId: channel.id,
      adapterCreator: this.guild.voiceAdapterCreator,
    });
    this.connection.subscribe(this.audioPlayer);
    this.channelId = channel.id;
    return true;
  };

  public addToQueue = (youtubeId: string): void => {
    this.queue.push(youtubeId);
    this.checkPlay();
  };

  public destroy = () => {
    this.connection.destroy();
    this.audioPlayer.stop();
  };

  public skip = () => {
    this.audioPlayer.stop(true);
  };

  private checkPlay = () => {
    if (this.isIdle()) {
      const nextId = this.queuePop();
      if (nextId === undefined) return;

      ytdl("https://www.youtube.com/watch?v=" + nextId, {
        quality: "highestaudio",
      }).then((data) => {
        const resource = createAudioResource(data);
        this.audioPlayer.play(resource);
      });
    }
  };

  private isIdle = () => {
    return this.audioPlayer.state.status === AudioPlayerStatus.Idle;
  };

  private queuePop = (): string | undefined => {
    return this.queue.shift();
  };
}

const players: Map<string, Player> = new Map();

const getOrCreatePlayer = (
  guild: Guild,
  channel: Channel,
  moveChannel: boolean = false
): Player | undefined => {
  const player = players.get(guild.id);
  if (player !== undefined) {
    if (!player.setVoiceChannel(channel, moveChannel)) return undefined;
    return player;
  }
  const newPlayer = new Player(guild, channel);
  players.set(guild.id, newPlayer);
  return newPlayer;
};

const getPlayer = (guild: Guild, channel: Channel): Player | undefined => {
  const player = players.get(guild.id);
  if (player === undefined || player.channelId !== channel.id) {
    return undefined;
  }
  return player;
};

const destroyAllPlayers = () => {
  for (const player of players.values()) {
    player.destroy();
  }
};

const destroyPlayer = (guild: Guild, channel: Channel): void => {
  const player = players.get(guild.id);
  if (player === undefined) return;
  player.destroy();
  players.delete(guild.id);
};

export { getOrCreatePlayer, destroyAllPlayers, getPlayer, destroyPlayer };
