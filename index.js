var cron = require('node-cron');
var aws = require('aws-sdk');
var _ = require('underscore');
var ffmpeg = require('fluent-ffmpeg');
var mysql = require('mysql');
var fs = require('fs');

//Database credentials
var databaseConf = JSON.parse(fs.readFileSync('relational-conf.json', 'utf8'));

//DataBase connection
var connection = mysql.createConnection({
  host: databaseConf.host,
  user: databaseConf.user,
  password: databaseConf.password,
  database: databaseConf.database,
  port: 3306,
  timeout: 60000
});

connection.connect(function (err) {
  if (err) {
    console.error('error connecting: ' + err.stack);
    return;
  }

  console.log('connected as id ' + connection.threadId);
});

var sender = "da.prieto1@uniandes.edu.co";
var verifiedEmails = [];

// Load your AWS credentials and try to instantiate the object.
aws.config.loadFromPath(__dirname + '/aws-config.json');

// Instantiate SES.
var ses = new aws.SES();

var verify = function (email) {
  var params = {
    EmailAddress: email
  };

  ses.verifyEmailAddress(params, function (err, data) {
    if (err) {
      console.log('ERROR VERIFYING MAIL: ' + err);
    }
    else {
      console.log('SUCCESS VERIFYING MAIL');
    }
  });
}

var sendMail = function (email, constestId) {

  var ses_mail = "From: 'AWS Tutorial Series' <" + sender + ">\n";
  ses_mail = ses_mail + "To: " + email + "\n";
  ses_mail = ses_mail + "Subject: Video Successfully converted\n";
  ses_mail = ses_mail + "--NextPart\n";
  ses_mail = ses_mail + "Content-Type: text/html; charset=us-ascii\n\n";
  ses_mail = ses_mail + "<b>Tu video ha sido publicado porfavor visitanos en <a>http://localhost:3000/smarttools/" + constestId + "</a></b>\n\n";
  ses_mail = ses_mail + "--NextPart\n";

  var params = {
    RawMessage: { Data: new Buffer(ses_mail) },
    Destinations: [email],
    Source: "'SmartTools Team' <" + email + ">'"
  };

  ses.sendRawEmail(params, function (err, data) {
    if (err) {
      console.log('ERROR SENDING MAIL: ' + err);
    }
    else {
      console.log('SUCCESS SENDING MAIL');
    }
  });
}

var list = function () {
  verifiedEmails = [];
  ses.listVerifiedEmailAddresses(function (err, data) {
    if (err) {
      console.log(err);
    }
    else {
      verifiedEmails = data.VerifiedEmailAddresses;
    }
  });
}

list();

var updateVideo = function (videoId, state) {

  connection.query("UPDATE smarttools.video SET state = '" + state + "' WHERE videoId = '" + videoId + "'", function (err, videos, fields) {
    if (!err)
      console.log('SUCCESS UPDATING VIDEO STATE');
    else
      console.log('ERROR UPDATING VIDEO STATE: ' + err);
  });
}

var convertVideo = function (video) {
  console.log('--------------------------------------------------');

  var videoId = video.id;
  console.log('CONVERT video ID = ' + videoId);
  ffmpeg(__dirname + '/../efs/upload/' + videoId)
    .audioCodec('aac')
    .videoCodec('libx264')
    .size('320x200')
    .on('error', function (err) {
      console.log('ERROR CONVERTING VIDEO: ' + err.message);
    })
    .on('end', function (file) {
      console.log('SUCCESS CONVERTING VIDEO');
      updateVideo(videoId, "Converted");
      if (_.contains(verifiedEmails, video.email)) {
        sendMail(video.email, video.contestId);
      } else {
        console.log('USER MUST VERIFY MAIL');
        verify(video.email);
      }
    })
    .save(__dirname + '/../efs/converted/' + videoId + '.mp4');
};


connection.query("SELECT * FROM smarttools.video WHERE state = 'InProcess'", function (err, videos, fields) {
    if (!err) {
      console.log('NUMBER OF VIDEOS: ' + videos.length);
      console.log(videos);
      
    }
    else {
      console.log('ERROR LOADING VIDEOS : ' + err);
    }
  });

cron.schedule('* * * * *', function () {
  var date = new Date();
  console.log('\n' + date + ' SmartTools CRON is running now');

  connection.query("SELECT * FROM smarttools.video WHERE state = 'InProcess'", function (err, videos, fields) {
    if (!err) {
      console.log('NUMBER OF VIDEOS: ' + videos.length);
      console.log(videos);
      _.each(videos, function (video) {
        updateVideo(video.videoId, "Process");
      });
      _.each(videos, function (video) {
        convertVideo(video)
      });
    }
    else {
      console.log('ERROR LOADING VIDEOS : ' + err);
    }
  });

  list();

});

