var Consumer = require('sqs-consumer');
var AWS = require('aws-sdk');

AWS.config.loadFromPath(__dirname + '/aws-config.json');
 
var app = Consumer.create({
  queueUrl: 'https://sqs.us-west-2.amazonaws.com/942635221058/smarttools',
  attributeNames : ['All'],
  handleMessage: function (message, done) {
    console.log(message);
    done();
  },
  sqs: new AWS.SQS()
});
 
app.on('error', function (err) {
  console.log(err.message);
});
 
app.start();