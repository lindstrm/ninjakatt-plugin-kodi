const EventEmitter = require('events');
const kodi = require('kodi-ws');

module.exports = class Client extends EventEmitter {
  constructor(host, port) {
    super();

    this.host = host;
    this.port = port;

    this.connected = false;
    this.scrobbled = false;
    this.playing = {
      item: {},
      percent: 0,
      tvdbid: 0,
      duration: {},
      date: null
    };
    this.connection = null;

    this.openConnection();
  }
  connectTimer() {
    setTimeout(() => {
      this.openConnection();
    }, 10000);
  }

  async openConnection() {
    const connection = (this.connection = await kodi(
      this.host,
      this.port
    ).catch(() => this.connectTimer()));

    if (connection === undefined) {
      return;
    }

    this.connected = true;
    this.getPlaying();

    this.emit('connected');

    connection.Player.OnPlay(() => {
      this.getPlaying();
    });

    connection.Player.OnPause(() => {
      this.emitComplete();
    });

    connection.Player.OnStop(() => {
      this.emitComplete();
      this.clearPlaying();
    });

    connection.on('close', () => {
      this.connected = false;
      this.clearPlaying();
      this.connectTimer();
      this.emit('disconnected');
    });

    connection.on('error', () => {
      this.emitComplete();
      this.clearPlaying();
    });
  }

  async getPlaying() {
    const players = await this.connection.Player.GetActivePlayers();
    players.map(async player => {
      const playing = await this.connection.Player.GetItem(player.playerid, [
        'showtitle',
        'episode',
        'season',
        'tvshowid'
      ]);

      this.playing.item = playing.item;

      const properties = await this.connection.Player.GetProperties(
        player.playerid,
        ['percentage', 'time', 'totaltime']
      );

      let percent = Math.round(properties.percentage);

      this.playing.percent = percent;
      this.playing.duration = properties.totaltime;

      this.emitComplete();

      setTimeout(_ => {
        this.getPlaying();
      }, 5000);

      if (this.tvdbIdNotSet()) {
        this.getTVDBiD();
      }
    });
  }

  tvdbIdNotSet() {
    return this.playing.tvdbid == 0 || this.playing.tvdbid == undefined;
  }

  async getTVDBiD() {
    let info = await this.connection.VideoLibrary.GetTVShowDetails(
      this.playing.item.tvshowid,
      ['imdbnumber']
    );

    this.playing.tvdbid = info.tvshowdetails.imdbnumber;
  }

  emitComplete() {
    if (
      this.playing.percent >= 90 &&
      this.scrobbled === false &&
      this.playing.tvdbid !== 0
    ) {
      this.playing.date = new Date();
      this.emit('complete', this.playing);
      this.scrobbled = true;
    }
  }

  clearPlaying() {
    this.playing = {
      item: {},
      percent: 0,
      tvdbid: 0,
      duration: {},
      date: null
    };
    this.scrobbled = false;
  }
};
