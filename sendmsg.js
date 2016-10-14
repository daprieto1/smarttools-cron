var AWS = require('aws-sdk');

AWS.config.loadFromPath(__dirname + '/aws-config.json');

var sqs = new AWS.SQS();

var body = {
  idVideo: 1,
  email: 'diego@mensajerosurbanos.com'
};
var params = {
  MessageAttributes: {
    "video": {
      DataType: "String",
      StringValue: "1"
    }
  },
  MessageBody: JSON.stringify(body),
  QueueUrl: "https://sqs.us-west-2.amazonaws.com/942635221058/smarttools"
};
sqs.sendMessage(params, function (err, data) {
  if (err) console.log(err, err.stack); // an error occurred
  else console.log(data);           // successful response
});