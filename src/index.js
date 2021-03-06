#!/usr/bin/env node
require('dotenv').config()
const path = require('path')
const express = require('express')
const nofavicon = require('express-no-favicons')
const youtube = require('./youtube')
const downloader = require('./downloader')
const app = express()
const fs = require('fs');
const ytdl = require('ytdl-core');
const sanitize = require('sanitize-filename');
const ffmpeg = require('fluent-ffmpeg');


function listen (port, callback = () => {}) {
  app.use(nofavicon())

    // Add headers
  app.use(function (req, res, next) {
      var origin = req.headers.origin;
      var allowedOrigins = process.env.ACCESS_ORIGIN || 'http://localhost:3000';
console.log(allowedOrigins);
      if(allowedOrigins.indexOf(origin) > -1){
          res.setHeader('Access-Control-Allow-Origin', origin);
       }

      // Request methods you wish to allow
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST');

      // Request headers you wish to allow
      res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type');

      // Set to true if you need the website to include cookies in the requests sent
      // to the API (e.g. in case you use sessions)
      res.setHeader('Access-Control-Allow-Credentials', true);

      // Pass to next layer of middleware
      next();

  });

  app.use('/public/:videoId', function(req, res){

    const filename = __dirname.replace('src', '') + '/public/' + req.params.videoId;
    res.setHeader('Content-type', 'text/html');
    res.download(filename);
  });

  app.get('/quick/:videoId', (req, res) => {
    const id = req.params.videoId;
    const stream = ytdl(id);

    youtube.get(id, (err, data) => {
      const youtubeClipInfo = data.items[0].snippet;
      const mp3Name = sanitize(youtubeClipInfo.title) + '.mp3';
      const file = './public/' + mp3Name;

      const returnObject = {
        file,
        youtubeClipInfo: youtubeClipInfo
      };

      const proc = new ffmpeg({
        source: stream
      })
      .on('error', function(err) {
        console.log('An error occurred: ' + err.message);
      })
      .on('end', function() {
        console.log('Conversion done');
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(returnObject));
      })
      .save(file);
    });

  });

  app.get('/convert/:videoId', (req, res) => {
    const id = req.params.videoId;

    // Get info about file
    youtube.get(id, (err, data) => {
      if (err) {
        console.log(err)
        res.sendStatus(500, err)
        return;
      }

      const youtubeClipInfo = data.items[0].snippet;
      const mp3Name = sanitize(youtubeClipInfo.title) + '.mp3';
      const file = './public/' + mp3Name;

      const to = path.normalize(file);
      const writeOpts = { highWaterMark: 10000 * 1024 };

      const ws = fs.createWriteStream(to, writeOpts);
      const returnObject = {
        file: mp3Name,
        downloadPath: 'public/' + mp3Name,
        youtubeClipInfo: youtubeClipInfo
      };
      ws.on('open', () => {
        console.log('Starting conversion');
      });
      ws.on('finish', () => {
        console.log('Conversion done');
        res.writeHead(200, {'Content-Type': 'application/json'});
        res.end(JSON.stringify(returnObject));
      });

      try {
        youtube.stream(id).pipe(ws);
      } catch (e) {
        console.error(e);
        res.sendStatus(500, e);
      }
    });
  });

  app.get('/search/:query/:page?', (req, res) => {
    const {query, page} = req.params
    youtube.search({query, page}, (err, data) => {
      if (err) {
        console.log(err)
        res.sendStatus(500, err)
        return
      }

      res.json(data)
    })
  })

  app.get('/get/:id', (req, res) => {
    const id = req.params.id

    youtube.get(id, (err, data) => {
      if (err) {
        console.log(err)
        res.sendStatus(500, err)
        return
      }

      res.json(data)
    })
  })

  app.get('/popular', (req, res) => {
    youtube.popular((err, data) => {
      if (err) {
        console.log(err)
        res.sendStatus(500, err)
        return
      }
      res.json(data);
    });

  });

  app.use((req, res) => {
    res.sendStatus(404)
  })

  app.listen(port, callback)
}

module.exports = {
  listen,
  downloader,
  get: (id, callback) => youtube.get(id, callback),
  search: ({query, page}, callback) => youtube.search({query, page}, callback)
}
