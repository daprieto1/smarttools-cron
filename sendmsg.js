var AWS = require('aws-sdk');

AWS.config = new AWS.Config({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: 'us-west-2'
});

var sqs = new AWS.SQS();

var body = {
  idVideo: '2288757293999',
  email: 'da.prieto1@uniandes.edu.co'
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

for (var i = 0; i < 10; i++) {
  sqs.sendMessage(params, function (err, data) {
    if (err) console.log(err, err.stack); // an error occurred
    else console.log(data);           // successful response
  });
}
 
