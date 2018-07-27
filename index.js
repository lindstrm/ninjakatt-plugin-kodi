const Base = require('ninjakatt-plugin-base');
const Client = require('./Client');
const emitter = global.emitter;
module.exports = class Kodi extends Base {
  constructor() {
    super(__dirname);
    this.clients = [];
    this.scrobbled = [];
  }

  setup() {
    this.settings.hosts.forEach(host => {
      const client = new Client(host.host, host.port);

      client.on('complete', playing => {
        this.emitComplete(playing);
        this.scrobbled.push(playing);
      });

      client.on('connected', () => {
        emitter.emit(
          'message',
          `Connected to ${host.host}:${host.port}`,
          'connect',
          Kodi.name
        );
      });

      client.on('disconnected', () => {
        emitter.emit(
          'message',
          `Disconnected from ${host.host}:${host.port}`,
          'connect',
          Kodi.name
        );
      });

      this.clients.push();
    });

    setTimeout(() => {
      if (global.Ninjakatt.plugins.has('Webserver')) {
        this.addWebroutes();
      }
    }, 0);
  }

  emitComplete(playing) {
    switch (playing.item.type) {
      case 'episode':
        emitter.emit('kodi.completed.episode', playing);
        break;

      default:
        break;
    }
  }

  addWebroutes() {
    const prefix = Kodi.name.toLowerCase();

    emitter.emit(
      'webserver.add-route',
      'get',
      `/${prefix}/scrobbled`,
      (req, res) => {
        res.status(200).send(this.scrobbled);
      }
    );
  }
};
