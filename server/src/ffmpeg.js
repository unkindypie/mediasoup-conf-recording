// Class to handle child process used for running FFmpeg

const child_process = require('child_process');
const { EventEmitter } = require('events');
const FFmpegStatic = require('ffmpeg-static');

const { createSdpText } = require('./sdp');
const { convertStringToStream } = require('./utils');

const RECORD_FILE_LOCATION_PATH =
  process.env.RECORD_FILE_LOCATION_PATH || './files';

module.exports = class FFmpeg {
  constructor(rtpParameters) {
    this._rtpParameters = rtpParameters;
    this._process = undefined;
    this._observer = new EventEmitter();
    this._createProcess();
  }

  _createProcess() {
    const startTime = Date.now();
    const sdpString = createSdpText(this._rtpParameters);
    const sdpStream = convertStringToStream(sdpString);

    console.log('createProcess() [sdpString:%s]', sdpString);

    this._process = child_process.spawn(FFmpegStatic, this._commandArgs);

    const dataHandler = (data) => {
      console.log(
        `[${Date.now() - startTime}]ffmpeg::process::data [data:%o]`,
        data
      );
    };

    if (this._process.stderr) {
      this._process.stderr.setEncoding('utf-8');

      this._process.stderr.on('data', dataHandler);
    }

    if (this._process.stdout) {
      this._process.stdout.setEncoding('utf-8');

      this._process.stdout.on('data', dataHandler);
    }

    this._process.on('message', (message) =>
      console.log('ffmpeg::process::message [message:%o]', message)
    );

    this._process.on('error', (error) =>
      console.error('ffmpeg::process::error [error:%o]', error)
    );

    this._process.once('close', () => {
      console.log('ffmpeg::process::close');
      this._observer.emit('process-close');
    });

    sdpStream.on('error', (error) =>
      console.error('sdpStream::error [error:%o]', error)
    );

    // Pipe sdp stream to the ffmpeg process
    sdpStream.resume();
    sdpStream.pipe(this._process.stdin);
  }

  kill() {
    console.log('kill() [pid:%d]', this._process.pid);
    this._process.kill('SIGINT');
  }

  get _commandArgs() {
    let commandArgs = [
      '-loglevel',
      'debug',
      '-protocol_whitelist',
      'pipe,udp,rtp',
      '-fflags',
      '+genpts',
      '-f',
      'sdp',
      '-i',
      'pipe:0',
    ];

    commandArgs = commandArgs.concat(this._videoArgs);
    commandArgs = commandArgs.concat(this._audioArgs);

    commandArgs = commandArgs.concat([
      '-flags',
      '+global_header',
      `${RECORD_FILE_LOCATION_PATH}/${this._rtpParameters.fileName}.webm`,
    ]);

    console.log('commandArgs:%o', commandArgs);

    return commandArgs;
  }

  get _videoArgs() {
    return ['-map', '0:v:0', '-c:v', 'copy'];
    // return ['-map', '[v]'];
  }

  get _audioArgs() {
    return [
      '-map',
      '0:a:0',
      '-strict', // libvorbis is experimental
      '-2',
      '-c:a',
      'copy',
    ];
    // return ['-map', '[a]'];
  }
};
