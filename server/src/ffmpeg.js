// Class to handle child process used for running FFmpeg

const child_process = require('child_process');
const { EventEmitter } = require('events');
const FFmpegStatic = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');

const { createSdpText } = require('./sdp');

const RECORD_FILE_LOCATION_PATH =
  process.env.RECORD_FILE_LOCATION_PATH || './files';

module.exports = class FFmpeg {
  constructor(rtpParameters) {
    this._rtpParameters = rtpParameters;
    this._process = undefined;
    this._observer = new EventEmitter();
    this._createProcess();

    const logsPath = path.join(
      __dirname,
      `../logs/ffmpeg-log-${Date.now()}.txt`
    );

    this._fileLog = fs.createWriteStream(logsPath, { flags: 'a' });
  }

  _createProcess() {
    const startTime = Date.now();

    // generating sdp for each stream
    for (let p of this._rtpParameters.peers) {
      const peer = p[1];
      const peerId = p[0];

      const sdpString = createSdpText(peer);
      peer.sdpString = sdpString;
      console.log(
        `createSdpText() for [${peerId}] with [sdpString:%s]`,
        sdpString
      );
    }

    const commandArgs = this._commandArgs;

    console.log(`ffmpeg command: \n ${commandArgs}`);

    this._process = child_process.spawn(FFmpegStatic, commandArgs);

    const dataHandler = (data) => {
      console.log(
        `[${Date.now()}:${
          Date.now() - startTime
        }]ffmpeg::process::data [data:%o]`,
        data
      );
      this._fileLog.write(data);
    };

    if (this._process.stderr) {
      this._process.stderr.setEncoding('utf-8');

      this._process.stderr.on('data', dataHandler);
    }

    if (this._process.stdout) {
      this._process.stdout.setEncoding('utf-8');

      this._process.stdout.on('data', dataHandler);
    }

    this._process.on('message', (message) => {
      console.log('ffmpeg::process::message [message:%o]', message);
      this._fileLog.write(message);
    });

    this._process.on('error', (error) => {
      console.error('ffmpeg::process::error [error:%o]', error);
      this._fileLog.write(message);
    });

    this._process.once('close', () => {
      console.log('ffmpeg::process::close');
      this._observer.emit('process-close');
      this._fileLog.write('close.');
    });
  }

  kill() {
    console.log('kill() [pid:%d]', this._process.pid);
    this._process.kill('SIGINT');
  }

  get _commandArgs() {
    let inputs = [];

    this._rtpParameters.peers.forEach((p, i) => {
      console.log('PEER joined at ' + p.joinedAt);
      // if (i === 0) return;
      console.log('generating input for ', i);
      inputs = [
        ...inputs,
        // '-analyzeduration',
        // '9000000',
        // '-probesize',
        // '10000000',
        '-protocol_whitelist',
        'data,rtp,udp',
        '-fflags',
        '+genpts',
        // '-s:v',
        // '640x480',
        '-f',
        'sdp',
        '-i',
        `data:application/sdp;charset=UTF-8,${p.sdpString}`,
      ];
      console.log('sdp:', p.sdpString);
    });

    let commandArgs = [
      '-loglevel',
      'debug',
      // '-nostdin',

      ...inputs,
      '-protocol_whitelist',
      'data,rtp,udp,file',
      '-filter_complex',
      // '[0:v][1:v]hstack=inputs=2:shortest=1[v];[0:a][1:a]amerge=inputs=2[a]',

      // '[0:v][0:v]hstack=inputs=2:shortest=1[v];[0:a][0:a]amerge=inputs=2[a]',
      // '[0:v][0:v]hstack=inputs=2:shortest=1[v]', // - works
      // '[0:v][0:v]hstack=inputs=2:shortest=1[v];amix=inputs=1[a]', // - works
      'amix=inputs=2[a]', // - works
      // '[0:v]pad=iw*2:ih[int];[int][1:v]overlay=W/2:0[vid];amix=inputs=2[a]',
      // '[0:v][1:v]hstack=inputs=2:shortest=1[v];amix=inputs=2[a]',
      // '[0:v][1:v]hstack=inputs=2:shortest=1[v];',

      ...this._videoArgs,
      ...this._audioArgs,

      '-flags',
      '+global_header',
      // '-shortest',
      `${RECORD_FILE_LOCATION_PATH}/${this._rtpParameters.fileName}.webm`,
    ];

    console.log('commandArgs:%o', commandArgs);

    return commandArgs;
  }

  get _videoArgs() {
    // return ['-map', '0:v:0', '-c:v', 'copy'];
    // return ['-map', '[v]'];
    return [];
    // return ['-map', '[vid]'];
  }

  get _audioArgs() {
    // return [
    //   '-map',
    //   '0:a:0',
    //   '-strict', // libvorbis is experimental
    //   '-2',
    //   '-c:a',
    //   'copy',
    // ];
    return ['-map', '[a]'];
  }
};
