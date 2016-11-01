var AWS = require('aws-sdk');

AWS.config.loadFromPath(__dirname + '/aws-config.json');

var sqs = new AWS.SQS();

var body = {
  idVideo: '2288757293999',
  email: 'diego@mensajerosurbanos.com'
};
var params = {
  MessageAttributes: {
    "video": {
      DataType: "String",
      StringValue: "2288757293999"
    }
  },
  MessageBody: JSON.stringify(body),
  QueueUrl: "https://sqs.us-west-2.amazonaws.com/942635221058/smarttools"
};
for (var i = 0; i < 1000; i++) {
  sqs.sendMessage(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}
 
