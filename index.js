var Consumer = require('sqs-consumer');
var AWS = require('aws-sdk');
var _ = require('underscore');
var ffmpeg = require('fluent-ffmpeg');
var file = require('fs');
var zlib = require('zlib');
var path = require('path');
var streamingS3 = require('streaming-s3')

var sender = "da.prieto1@uniandes.edu.co";
var verifiedEmails = [];

// Load your AWS credentials and try to instantiate the object.
var awsconf = JSON.parse(file.readFileSync(__dirname + '/aws-config.json', 'utf8'));
AWS.config.loadFromPath(__dirname + '/aws-config.json');

// Instantiate SES.
var ses = new AWS.SES();
var s3 = new AWS.S3();
var docClient = new AWS.DynamoDB.DocumentClient();
var dynamodb = new AWS.DynamoDB();

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
            uploadObject(done, video);
            console.log('SUCCESS CONVERTING VIDEO');
            updateVideo(videoId);
            if (_.contains(verifiedEmails, video.email)) {
                sendMail(video.email, video.contestId);
            } else {
                console.log('USER MUST VERIFY MAIL');
                verify(video.email);
            }
        })
        .save(__dirname + '/converted/' + videoId + '.mp4');
    return true;
};

function uploadObject(done, video) {


    var fStream = file.createReadStream(__dirname + '/converted/' + video.idVideo + '.mp4');
    var uploader = new streamingS3(fStream, { accessKeyId: awsconf.accessKeyId, secretAccessKey: awsconf.secretAccessKey },
        {
            Bucket: 'smarttools-grupo4',
            Key: video.idVideo + '.mp4',
            ContentType: 'application/octet-stream'
        }, function (err, resp, stats) {
            if (err) return console.log('Upload error: ', e);
            console.log('Upload stats: ', stats);
            console.log('Upload successful: ', resp);
        }
    );
}

function getObject(video) {
    stream = file.createWriteStream(__dirname + '/upload/' + video.idVideo);
    var params = { Bucket: 'smarttools-grupo4', Key: 'upload/' + video.idVideo };
    s3.getObject(params).createReadStream().pipe(stream);
}

var stream
var app = Consumer.create({
    queueUrl: 'https://sqs.us-west-2.amazonaws.com/942635221058/smarttools',
    attributeNames: ['All'],
    handleMessage: function (message, done) {
        console.log('--------------------------------------------------');
        console.time("worker-time");
        console.log('MESSAGE = ' + message.MessageId);
        var video = JSON.parse(message.Body);
        getObject(video);
        stream.on('finish', function () {
            console.log('VIDEO DOWNLOAD SUCCESS');
            convertVideo(video, done);
        });
    },
    sqs: new AWS.SQS()
});

app.on('error', function (err) {
    console.log(err.message);
});

app.start();

var date = new Date();
console.log('\n' + date + ' SmartTools Worker is running now');



