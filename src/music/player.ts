import {
  AudioPlayer,
  AudioPlayerStatus,
  createAudioPlayer,
  createAudioResource,
  entersState,
  joinVoiceChannel,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionStatus,
} from "@discordjs/voice";
import { RBTree } from "bintrees";
import { Channel, Guild } from "discord.js";
import ytdl from "ytdl-core-discord";

interface QueueEntry {
  id: bigint;
  youtubeId: string;
}

class Player {
  queue: RBTree<QueueEntry> = new RBTree((a, b) => {
    if (a.id > b.id) return 1;
    if (a.id < b.id) return -1;
    return 0;
  });
  connection: VoiceConnection;
  audioPlayer: AudioPlayer;
  guild: Guild;
  channelId: string;
  nextId: bigint = 1n;
  nextFrontId: bigint = -1n;

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
    this.connection.on(
      VoiceConnectionStatus.Disconnected,
      async (oldState, newState) => {
        try {
          this.channelId = "";
          await Promise.race([
            entersState(
              this.connection,
              VoiceConnectionStatus.Signalling,
              10_000
            ),
            entersState(
              this.connection,
              VoiceConnectionStatus.Connecting,
              10_000
            ),
          ]);
          const channelId = this.connection.joinConfig.channelId;
          if (channelId !== null) this.channelId = channelId;
        } catch (error) {
          this.connection.destroy();
        }
      }
    );
  }

  public setVoiceChannel = (channel: Channel, move: boolean): boolean => {
    if (this.channelId === channel.id) return true;
    if (!move) return false;
    this.connection = joinVoiceChannel({
      guildId: this.guild.id,
      channelId: channel.id,
      adapterCreator: this.guild.voiceAdapterCreator,
      selfMute: false,
      selfDeaf: false,
    });
    this.connection.subscribe(this.audioPlayer);
    this.channelId = channel.id;
    return true;
  };

  public addToQueue = (youtubeId: string): bigint => {
    const id = this.nextId;
    this.nextId++;
    this.queue.insert({ id, youtubeId });
    this.checkPlay();
    return id;
  };

  public bumpToFront = (id: bigint): bigint => {
    const entry = this.queue.find({ id, youtubeId: "" });
    if (entry === null) return 0n;
    if (!this.queue.remove(entry)) return 0n;
    const newId = this.nextFrontId;
    this.nextFrontId--;
    entry.id = newId;
    if (!this.queue.insert(entry)) return 0n;
    return newId;
  };

  public queueSize = () => this.queue.size;

  public destroy = () => {
    this.connection.destroy();
    this.audioPlayer.stop();
    unloadPlayer(this.guild.id);
  };

  public skip = () => {
    this.audioPlayer.stop(true);
  };

  public removeFromQueue = (id: bigint): boolean => {
    const entry: QueueEntry = { id, youtubeId: "" };
    return this.queue.remove(entry);
  };

  private checkPlay = () => {
    if (this.isIdle()) {
      const nextId = this.queuePop();
      if (nextId === undefined) return;

      ytdl("https://www.youtube.com/watch?v=" + nextId, {
        quality: "highestaudio",
        filter: "audioonly",
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
    const entry = this.queue.min();
    if (entry === null) return undefined;
    this.queue.remove(entry);
    return entry.youtubeId;
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

const unloadPlayer = (guildId: string) => {
  players.delete(guildId);
};

const destroyPlayer = (guild: Guild, channel: Channel): boolean => {
  const player = players.get(guild.id);
  if (player === undefined) return false;
  player.destroy();
  return true;
};

export {
  getOrCreatePlayer,
  destroyAllPlayers,
  getPlayer,
  destroyPlayer,
  Player,
};
