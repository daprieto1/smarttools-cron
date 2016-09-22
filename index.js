var cron = require('node-cron');
var aws = require('aws-sdk');
var mongo = require('mongodb');
var MongoClient = require('mongodb').MongoClient;
var _ = require('underscore');
var ffmpeg = require('fluent-ffmpeg');

// Connection URL 
var url = 'mongodb://localhost:27017/smarttools-dev';

var sender   = "da.prieto1@uniandes.edu.co";
var verifiedEmails = [];

// Load your AWS credentials and try to instantiate the object.
aws.config.loadFromPath(__dirname + '/config.json');

// Instantiate SES.
var ses = new aws.SES();

var verify = function (email) {
	var params = {
        EmailAddress: email
    };
    
    ses.verifyEmailAddress(params, function(err, data) {
        if(err) {
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
    	Destinations: [ email ],
    	Source: "'SmartTools Team' <" + email + ">'"
	};

	ses.sendRawEmail(params, function(err, data) {
    	if(err) {
        	console.log('ERROR SENDING MAIL: ' + err);
    	} 
    	else {
        	console.log('SUCCESS SENDING MAIL');
    	}           
	});		
}

var list = function() {
	verifiedEmails = [];
	ses.listVerifiedEmailAddresses(function(err, data) {
        if(err) {
            console.log(err);
        } 
        else {
            verifiedEmails = data.VerifiedEmailAddresses;        } 
    });
}

list();

var findVideos = function(db, callback) {
  // Get the documents collection 
  var collection = db.collection('videos');
  // Find some documents 
  collection.find({state: 'InProcess'}).toArray(function(err, videos) {   
    callback(videos);
  });
}

var updateVideo = function (videoId, db) {
	var collection = db.collection('videos');
  
	collection.updateOne(
		{ _id : new mongo.ObjectID(videoId) } ,
	    { $set: { state : 'Converted' } }, function(err, result) {
	    	if(err){
	    		console.log('ERROR UPDATING VIDEO STATE: ' + err);  
	    	}else{
	    		console.log('SUCCESS UPDATING VIDEO STATE');  
	    	}
	});  
}

var convertVideo = function (video, db) {
	console.log('--------------------------------------------------');
	
	var videoId = video._id.toJSON();		
	console.log('CONVERT video ID = ' + videoId);
	ffmpeg('/Users/Diego/Documents/programs/smarttools/uploads/' + videoId)
        .audioCodec('aac')
        .videoCodec('libx264')
        .size('320x200')
        .on('error', function (err) {
          console.log('ERROR CONVERTING VIDEO: ' + err.message);
        })
        .on('end', function (file) {
          console.log('SUCCESS CONVERTING VIDEO');
          updateVideo(videoId, db);
          if(_.contains(verifiedEmails, video.email)){	    
          	sendMail(video.email, video.contestId);
          } else {
          	console.log('USER MUST VERIFY MAIL');
			verify(video.email);
          }
        })
        .save('/Users/Diego/Documents/programs/smarttools/convertedVideos/' + videoId + '.mp4');  
	
	  
};



cron.schedule('* * * * *', function(){
  	var date = new Date();
  	console.log('\n' + date + ' SmartTools CRON is running now');  	

  	MongoClient.connect(url, function(err, db) {
	  	console.log("Connected correctly to DB server");
	 	
	 	findVideos(db, function(videos) {
	 		console.log('NUMBER OF VIDEOS: ' + videos.length);
          	_.each(videos, function (video) {
          		convertVideo(video, db)
          	});
          	//db.close();
        });
	  
	});

	list();

});

