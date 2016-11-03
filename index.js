var Consumer = require('sqs-consumer');
var AWS = require('aws-sdk');
var ffmpeg = require('fluent-ffmpeg');
var file = require('fs');
var zlib = require('zlib');
var path = require('path');
var streamingS3 = require('streaming-s3')
var helper = require('sendgrid').mail;
var sg = require('sendgrid')(process.env.SENDGRID_APIKEY);
var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

var sender = "da.prieto1@uniandes.edu.co";
var verifiedEmails = [];

// Load your AWS credentials and try to instantiate the object.
AWS.config = new AWS.Config({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-west-2'
});

// Instantiate SES.
var s3 = new AWS.S3();
var docClient = new AWS.DynamoDB.DocumentClient();
var dynamodb = new AWS.DynamoDB();

/**
 * Send Mail using sendgrid
 */
function sendMail(email, constestId) {

    var from_email = new helper.Email('da.prieto1@uniandes.edu.co');
    var to_email = new helper.Email(email);
    var subject = 'Hello World from the SendGrid Node.js Library!';
    var content = new helper.Content('text/html', '<b>Tu video ha sido publicado porfavor visitanos en <a>http://localhost:3000/smarttools/' + constestId + '</a></b>\n\n');
    var mail = new helper.Mail(from_email, subject, to_email, content);

    var request = sg.emptyRequest({
        method: 'POST',
        path: '/v3/mail/send',
        body: mail.toJSON(),
    });

    sg.API(request, function (error, response) {
        if (error) {
            console.log('ERROR SENDING MAIL: ' + error);
        }
        else {
            console.log('SUCCESS SENDING MAIL');
        }
    });
}

var updateVideo = function (videoId) {

    var params = {
        TableName: 'videos',
        Key: {
            'id': parseInt(videoId)
        },
        UpdateExpression: "set #state = :state",
        ExpressionAttributeNames: {
            '#state': "state"
        },
        ExpressionAttributeValues: {
            ":state": 'Converted'
        }
    };

    docClient.update(params, function (err, data) {
        if (err) {
            console.log("Unable to update item. Error JSON:", JSON.stringify(err, null, 2));
            console.log('ERROR UPDATING VIDEO STATE: ' + err);
        } else {
            console.log('SUCCESS UPDATING VIDEO STATE');
        }
    });

}

function convertVideo(video, done) {
    console.time('convertVideo');
    var videoId = video.idVideo;
    console.log('CONVERT video ID = ' + videoId);
    ffmpeg(__dirname + '/upload/' + videoId)
        .audioCodec('aac')
        .videoCodec('libx264')
        .size('320x200')
        .on('error', function (err) {
            console.log('ERROR CONVERTING VIDEO: ' + err.message);
        })
        .on('end', function (file) {
            console.timeEnd('convertVideo');
            uploadObject(done, video);
            console.log('SUCCESS CONVERTING VIDEO');
            updateVideo(videoId);
            sendMail(video.email, video.contestId);
        })
        .save(__dirname + '/converted/' + videoId + '.mp4');
    return true;
};

function uploadObject(done, video) {
    console.time('uploadObject');
    var fStream = file.createReadStream(__dirname + '/converted/' + video.idVideo + '.mp4');
    var uploader = new streamingS3(fStream, { accessKeyId: process.env.AWS_ACCESS_KEY_ID, secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY },
        {
            Bucket: 'smarttools-grupo4',
            Key: video.idVideo + '.mp4',
            ContentType: 'application/octet-stream'
        }, function (error, resp, stats) {
            if (error) {
                console.log('ERROR UPLOADING VIDEO: ' + error);
            }
            else {
                console.log('SUCCESS UPLOADING VIDEO');
                console.timeEnd('uploadObject');
                done();
                console.timeEnd('worker-time');
            }
        }
    );
}

function getObject(video) {
    console.time('getObject');
    stream = file.createWriteStream(__dirname + '/upload/' + video.idVideo);
    var params = { Bucket: 'smarttools-grupo4', Key: 'upload/' + video.idVideo };
    s3.getObject(params).createReadStream().pipe(stream);
}

var stream
var consumer = Consumer.create({
    queueUrl: 'https://sqs.us-west-2.amazonaws.com/942635221058/smarttools',
    attributeNames: ['All'],
    handleMessage: function (message, done) {
        console.log('--------------------------------------------------');
        console.time('worker-time');
        console.log('MESSAGE = ' + message.MessageId);
        var video = JSON.parse(message.Body);
        getObject(video);
        stream.on('finish', function () {
            console.timeEnd('getObject');
            console.log('VIDEO DOWNLOAD SUCCESS');
            convertVideo(video, done);
        });
    },
    sqs: new AWS.SQS()
});

consumer.on('error', function (err) {
    console.log(err.message);
});

app.listen(app.get('port'), function () {
    console.log('\n' + new Date() + ' SmartTools Worker is running now y');
    consumer.start();
});