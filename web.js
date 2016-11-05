var AWS = require('aws-sdk');
var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

var hireFireUrl = '/hirefire/' + process.env.HIREFIRE_TOKEN + '/info';
var queueUrl = 'https://sqs.us-west-2.amazonaws.com/942635221058/smarttools';

// Load your AWS credentials and try to instantiate the object.
AWS.config = new AWS.Config({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-west-2'
});

// Instantiate AWS Services.
var sqs = new AWS.SQS();

app.get(hireFireUrl, function (req, res) {
    var params = {
        AttributeNames: [
            "All"
        ],
        QueueUrl: queueUrl
    };
    sqs.getQueueAttributes(params, function (error, data) {
        if (error) {
            res.send(error);
        } else {
            var response = [
                {
                    name: "videos",
                    quantity: data.Attributes.ApproximateNumberOfMessages
                }
            ];
            res.send(response);
        }
    });
});

app.listen(app.get('port'), function () {
    console.log('app start in posrt: ' + app.get('port'));
});